import { defineConfig, devices } from "playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Playwright configuration for the Dean's List smoke suite.
 *
 * Two rules shape this file.
 *
 * 1. NO `webServer` BLOCK. The developer runs `npm run dev` (or the suite points
 *    at a deployment). Letting Playwright spawn its own server on Windows means
 *    a second process fighting the running dev server over the Prisma query
 *    engine DLL, which is the same collision that makes `npm run build` unsafe
 *    here. Start the server yourself, then run the tests.
 *
 * 2. ONE TARGET, FROM THE ENVIRONMENT. `BASE_URL` selects what is under test, so
 *    the identical suite runs against localhost and against the Vercel preview:
 *
 *      npm test
 *      BASE_URL=https://deanslist.vercel.app npm test
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * When the target is this machine, load `.env` so the test process sees the same
 * AUTH_SECRET as the dev server. tests/admin.spec.ts mints a REVIEWER session to
 * prove the role-gated navigation, and that only works if both sides agree on
 * the signing key.
 *
 * Deliberately NOT loaded for a remote target: the local secret would not match
 * the deployment's, and a silently wrong key produces a confusing failure. In
 * that case the minted-session test skips unless AUTH_SECRET is exported
 * explicitly. Playwright loads this config in every worker process, so the
 * variables land where the specs read them.
 */
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(BASE_URL);
const envFile = resolve(__dirname, ".env");

if (isLocalTarget && existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // A malformed or unreadable .env is not a reason to refuse to run: only the
    // one minted-session test depends on it, and that test skips without it.
  }
}

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  /**
   * Generous. A cold Next dev server compiles each route on first request, and
   * the first hit on a heavy page can take tens of seconds. A tight timeout here
   * would show up as flake and teach the team to ignore red.
   */
  timeout: 90_000,
  expect: { timeout: 15_000 },

  /**
   * Serial by default. Two reasons, both real:
   *   - the rate limiter in src/lib/rate-limit.ts is a single in-memory Map in
   *     the server process, so parallel form submissions collide in it;
   *   - a dev server compiling several routes at once is slow enough to look
   *     broken.
   * Override with PW_WORKERS=4 against a built deployment.
   */
  workers: Number(process.env.PW_WORKERS ?? 1),
  fullyParallel: false,

  /**
   * No retries. A retry turns an intermittent failure into a green run, and the
   * whole point of this suite is that a silently broken form is invisible.
   */
  retries: 0,

  // Nothing may be committed with a stray test.only in it.
  forbidOnly: Boolean(process.env.CI),

  // `list` for the terminal, `html` for the trace of whatever failed. Never
  // auto-opens: this runs in CI and over SSH as often as on a desktop.
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: "chromium",
      // Only Chromium is downloaded on this machine. `npx playwright install
      // firefox webkit` then add projects here if cross-browser cover is wanted.
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
