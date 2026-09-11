import { test, expect, type Page } from "playwright/test";
import sharp from "sharp";
import { rm } from "node:fs/promises";
import path from "node:path";

/**
 * Dashboard image uploads, stored on the server's own disk.
 *
 * What is checked is what would hurt if it broke:
 *
 *   only staff can write to the disk, and the middleware bypass header does
 *   not change that;
 *   a file that is not an image is refused however it is named;
 *   an upload produces all three encodings, because <picture> does not fall
 *   back when the one it picked is missing;
 *   what the camera wrote into the file (EXIF, which can hold GPS) is gone;
 *   the serving route cannot be walked out of its directory.
 *
 * Runs against a local server only: it writes files and database rows, and
 * cleans both up afterwards, which it can only do on this machine.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@deanslist.live";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";
const TARGET = process.env.BASE_URL ?? "http://localhost:3000";
const IS_LOCAL_TARGET = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(TARGET);
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

test.skip(!IS_LOCAL_TARGET, "writes files and rows; local server only");

/** Own rate-limit bucket, clear of the ranges admin.spec.ts and forms.spec.ts use. */
let ipCounter = 0;
function nextClientIp(): string {
  ipCounter += 1;
  const worker = Number(process.env.TEST_WORKER_INDEX ?? 0);
  return `203.0.${113 + (worker % 100)}.${(ipCounter % 250) + 1}`;
}

async function signIn(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": nextClientIp() });
  await page.goto("/admin/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/login") && r.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  expect(res.status(), "admin sign in").toBe(200);
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
}

const created: string[] = [];

test.afterAll(async () => {
  if (!created.length) return;
  for (const p of created) {
    const id = p.split("/").pop()!;
    for (const ext of ["avif", "webp", "jpg"]) {
      await rm(path.join(UPLOAD_DIR, "images", `${id}.${ext}`), { force: true });
    }
  }
  // The rows, too: this suite runs against whatever database .env points at.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const assets = await prisma.asset.findMany({ where: { url: { in: created } }, select: { id: true } });
    const ids = assets.map((a) => a.id);
    await prisma.auditLog.deleteMany({ where: { entityType: "Asset", entityId: { in: ids } } });
    await prisma.asset.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
});

test("an upload needs a staff session, even with the middleware bypass header", async ({ request }) => {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#f00" } }).png().toBuffer();
  const attempts: Record<string, string>[] = [
    {},
    { "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware" },
  ];
  for (const headers of attempts) {
    const res = await request.post("/api/admin/uploads", {
      headers,
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: png } },
    });
    expect(res.status()).toBe(401);
  }
});

test("an image is resized, cleaned, stored in three encodings and served", async ({ page }) => {
  await signIn(page);

  // Wider than the 2400px cap, and carrying EXIF that must not survive.
  const input = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#c33" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "exif-must-be-stripped", Artist: "gps-stand-in" } })
    .toBuffer();
  expect((await sharp(input).metadata()).exif, "the fixture really carries EXIF").toBeTruthy();

  const res = await page.request.post("/api/admin/uploads", {
    multipart: { file: { name: "portrait.jpg", mimeType: "image/jpeg", buffer: input } },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as { path: string; width: number; height: number };
  created.push(body.path);

  expect(body.path).toMatch(/^\/uploads\/images\/[a-f0-9]{24}$/);
  expect(body.width).toBe(2400);
  expect(body.height).toBe(1200);

  for (const [ext, type] of [["avif", "image/avif"], ["webp", "image/webp"], ["jpg", "image/jpeg"]]) {
    const file = await page.request.get(`${body.path}.${ext}`);
    expect(file.status(), `${ext} is served`).toBe(200);
    expect(file.headers()["content-type"]).toBe(type);
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect(file.headers()["content-security-policy"]).toContain("sandbox");

    const meta = await sharp(await file.body()).metadata();
    expect(meta.width, `${ext} width`).toBe(2400);
    expect(meta.exif, `${ext} carries no EXIF`).toBeUndefined();
  }
});

test("a file that is not an image is refused, whatever it is called", async ({ page }) => {
  await signIn(page);
  const res = await page.request.post("/api/admin/uploads", {
    multipart: {
      file: { name: "poster.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") },
    },
  });
  expect(res.status()).toBe(422);
  expect(((await res.json()) as { error: string }).error).toMatch(/not an image/i);
});

test("the serving route cannot be walked out of its directory", async ({ request }) => {
  for (const p of [
    "/uploads/images/..%2f..%2fpackage.json",
    "/uploads/..%2fpackage.json",
    "/uploads/images/.0123456789abcdef01234567.jpg.tmp",
    "/uploads/images/0123456789abcdef01234567.svg",
    "/uploads/images/0123456789abcdef01234567.jpg",
  ]) {
    const res = await request.get(p);
    expect(res.status(), p).toBe(404);
  }
});
