import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { SITE } from "@/content/site";

/**
 * Configuration the client owns.
 *
 * Social links, the Meta Pixel id, the Google Analytics id and the Resend key
 * used to live in the code and in .env, so changing one meant a developer, a
 * commit and a deploy. They are rows now, edited on /admin/settings.
 *
 * Two rules hold the whole thing together:
 *
 *   .env still works. A setting with no row falls back to the environment, or
 *   to src/content/site.ts, so nothing that ran before this existed changes
 *   behaviour until someone actually saves something.
 *
 *   A secret is never stored in the clear. The Resend key is encrypted with a
 *   key derived from AUTH_SECRET, which lives on the server and never in the
 *   database. A leaked dump or a copied backup is then not a leaked mail
 *   account. The flip side: change AUTH_SECRET and the stored key can no
 *   longer be read, so it has to be entered again. The dashboard says so.
 *
 * Server only. It reads the database and uses node:crypto, so a client
 * component must take what it needs as a prop.
 */

export type SettingKey =
  | "social.youtube"
  | "social.facebook"
  | "social.instagram"
  | "meta.pixelId"
  | "google.analyticsId"
  | "mail.resendApiKey";

export const SETTING_KEYS: readonly SettingKey[] = [
  "social.youtube",
  "social.facebook",
  "social.instagram",
  "meta.pixelId",
  "google.analyticsId",
  "mail.resendApiKey",
] as const;

const SECRET_KEYS = new Set<SettingKey>(["mail.resendApiKey"]);

export function isSecretKey(key: SettingKey): boolean {
  return SECRET_KEYS.has(key);
}

/* ----------------------------------------------------------- encryption */

const ENC_PREFIX = "enc:v1:";

/** AES-256-GCM: authenticated, so a tampered row fails to decrypt rather than decrypting to something else. */
function encryptionKey(): Buffer {
  return scryptSync(env.AUTH_SECRET, "deanslist:settings:v1", 32);
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return (
    ENC_PREFIX +
    [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(":")
  );
}

function decrypt(stored: string): string | null {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const [ivPart, tagPart, dataPart] = stored.slice(ENC_PREFIX.length).split(":");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Almost always one thing: AUTH_SECRET is not the one this was saved with.
    console.error(
      "[settings] a stored secret could not be decrypted. If AUTH_SECRET was changed, enter the value again on /admin/settings.",
    );
    return null;
  }
}

/** "re_abc…4f9a" — enough to recognise a key, never enough to use one. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}

/* --------------------------------------------------------------- reading */

type Values = Partial<Record<SettingKey, string>>;

/**
 * Fifteen seconds. Long enough that a page render does not query for every
 * link on it, short enough that a save is visible immediately after the
 * redirect even without the explicit clear below.
 */
const TTL_MS = 15_000;
let cache: { at: number; values: Values } | null = null;

export function clearSettingsCache(): void {
  cache = null;
}

export async function getSettings(): Promise<Values> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;

  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.setting.findMany({ select: { key: true, value: true } });
  } catch (err) {
    // The public pages have their own fallbacks, so a database fault here costs
    // the dashboard's values and not the page.
    console.error(
      `[settings] unavailable, using .env and the built-in defaults: ${err instanceof Error ? err.message : String(err)}`,
    );
    return cache?.values ?? {};
  }

  const values: Values = {};
  for (const row of rows) {
    if (!SETTING_KEYS.includes(row.key as SettingKey)) continue;
    const key = row.key as SettingKey;
    const value = isSecretKey(key) ? decrypt(row.value) : row.value;
    if (value) values[key] = value;
  }

  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  return (await getSettings())[key] ?? null;
}

/* --------------------------------------------------------------- writing */

type Actor = { id?: string | null; email: string };

/**
 * Save what changed, and only that.
 *
 * `undefined` leaves a setting alone — that is what an untouched secret field
 * sends. `null` or "" deletes the row, which puts the .env or built-in value
 * back. The audit row records which keys moved, never the values: this is the
 * one table where a "before" would put a live API key in the log.
 */
export async function saveSettings(
  changes: Partial<Record<SettingKey, string | null>>,
  actor: Actor,
): Promise<void> {
  const before = await getSettings();
  const touched: string[] = [];

  for (const key of SETTING_KEYS) {
    if (!(key in changes)) continue;
    const next = changes[key];

    if (next === null || next === "") {
      const deleted = await prisma.setting.deleteMany({ where: { key } });
      if (deleted.count > 0) touched.push(`${key}: cleared`);
      continue;
    }
    if (next === undefined) continue;
    if (before[key] === next) continue;

    const value = isSecretKey(key) ? encrypt(next) : next;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value, updatedBy: actor.email },
      update: { value, updatedBy: actor.email },
    });
    touched.push(`${key}: ${isSecretKey(key) ? "set" : next}`);
  }

  clearSettingsCache();

  if (touched.length > 0) {
    await prisma.auditLog.create({
      data: {
        userId: actor.id ?? null,
        userEmail: actor.email,
        action: "settings.update",
        entityType: "Setting",
        // Keys and what happened to them. A secret's value never appears.
        after: { changed: touched } as never,
      },
    });
  }
}

/* ------------------------------------------------------- what the app asks */

export type SiteLinks = {
  youtube: string;
  facebook: string;
  instagram: string | null;
};

/** The channels, dashboard first, then the values the site shipped with. */
export async function getSiteLinks(): Promise<SiteLinks> {
  const values = await getSettings();
  return {
    youtube: values["social.youtube"] ?? SITE.socials.youtube,
    facebook: values["social.facebook"] ?? SITE.socials.facebook,
    instagram: values["social.instagram"] ?? null,
  };
}

/** The Meta Pixel id, or null. Null means no tracking code is rendered at all. */
export async function getMetaPixelId(): Promise<string | null> {
  return (await getSettings())["meta.pixelId"] ?? null;
}

/**
 * The Google Analytics measurement id (G-XXXXXXXXXX), or null. Null means the
 * Google tag is not on the page at all.
 */
export async function getGoogleAnalyticsId(): Promise<string | null> {
  const id = (await getSettings())["google.analyticsId"];
  // Checked again on the way out, not only when saved: the id is written into
  // an inline script, and a row edited straight in the database must not be
  // able to put anything else there.
  return id && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** The mail key: the dashboard's if there is one, otherwise .env. */
export async function getResendApiKey(): Promise<string | null> {
  return (await getSettings())["mail.resendApiKey"] ?? env.RESEND_API_KEY ?? null;
}

/** True once mail can actually send. The dashboard says which pieces are missing. */
export async function mailConfigured(): Promise<boolean> {
  return Boolean(await getResendApiKey());
}
