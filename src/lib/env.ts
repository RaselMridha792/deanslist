import { z } from "zod";

/**
 * Validated environment. Imported by anything that reads process.env.
 *
 * Edge-safe: no Node APIs, so `src/middleware.ts` can import it too.
 *
 * The rule that matters: AUTH_SECRET has no fallback in production. A shared
 * default would let anyone who has read this repository forge an admin session.
 */

const isProd = process.env.NODE_ENV === "production";

// Long enough that HS256 cannot be brute forced. 32 bytes hex = 64 chars.
const MIN_SECRET_LENGTH = 32;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: isProd
    ? z
        .string()
        .min(
          MIN_SECRET_LENGTH,
          `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production. ` +
            `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
        )
        .refine(
          (v) => !v.toLowerCase().includes("change-me") && !v.includes("dev-only"),
          "AUTH_SECRET is still set to a placeholder value. Replace it before deploying.",
        )
    : z.string().min(1).default("dev-only-insecure-secret-not-for-production"),

  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  // Where images and video are served from. Empty serves them from /public on
  // the app server. Set to an R2 or Cloudinary base to move them off it without
  // touching any component. Separate because Cloudinary splits image and video
  // into different delivery paths. See src/lib/media.ts.
  NEXT_PUBLIC_MEDIA_IMAGE_BASE: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_MEDIA_VIDEO_BASE: z.string().url().optional().or(z.literal("")),

  // Credentials for scripts/upload-media.mjs only, which pushes /public/media
  // to Cloudinary if a CDN is ever wanted again. The site itself never uses it.
  // Format: cloudinary://<api_key>:<api_secret>@<cloud_name>
  CLOUDINARY_URL: z.string().optional(),

  // Where dashboard uploads are written. Unset: ./uploads beside the app. The
  // Docker image sets /app/uploads, which is the `uploads` volume. See
  // src/lib/uploads.ts.
  UPLOAD_DIR: z.string().optional(),

  // Email. Absent in development: src/lib/mail.ts no-ops with a warning.
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  MAIL_FROM: z.string().default("Dean's List <noreply@deanslist.live>"),
  TEAM_NOTIFY_EMAIL: z.string().email().optional(),

  // Chatbot (Phase 8). Absent means the widget serves knowledge base answers only.
  ANTHROPIC_API_KEY: z.string().optional(),
  CHAT_DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(2_000_000),

  // Scheduled campaigns and reminder sequences (Phase 7.6).
  CRON_SECRET: z.string().optional(),
});

/**
 * Build-time escape hatch, and only that.
 *
 * `next build` runs with NODE_ENV=production and imports this module, so the
 * production rules above would fail a Docker build: there is no AUTH_SECRET and
 * no DATABASE_URL inside the build, and there must not be. An image is a file
 * that gets cached, copied and pushed to a registry, and a secret baked into
 * one is a secret published.
 *
 * So the Dockerfile's builder stage sets SKIP_ENV_VALIDATION=1. The two
 * required values get inert placeholders for the length of the build, every
 * other rule and default still applies, and real validation runs when the
 * container starts — which is when a missing secret should fail.
 *
 * It is honoured ONLY during the build phase. Set by mistake on a running
 * server it would mean a placeholder AUTH_SECRET, which means anyone who has
 * read this file can forge an admin session; so outside `next build` the flag
 * is ignored and the strict schema applies regardless.
 */
const buildOnlySkip =
  process.env.SKIP_ENV_VALIDATION === "1" &&
  process.env.NEXT_PHASE === "phase-production-build";

const parsed = (
  buildOnlySkip
    ? schema.extend({
        DATABASE_URL: z.string().default("postgresql://build:build@localhost:5432/build"),
        AUTH_SECRET: z.string().default("build-phase-placeholder-not-valid-at-runtime-0000"),
      })
    : schema
).safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\n\nSee .env.example.`);
}

export const env = parsed.data;

/** True once an email provider is wired up. */
export const mailEnabled = Boolean(env.RESEND_API_KEY);

/** True once an AI provider is wired up. */
export const chatEnabled = Boolean(env.ANTHROPIC_API_KEY);
