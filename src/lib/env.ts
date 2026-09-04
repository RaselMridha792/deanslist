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
  // the app server; set to an R2 or Cloudinary base to move them off it without
  // touching any component. See src/lib/media.ts.
  NEXT_PUBLIC_MEDIA_BASE_URL: z.string().url().optional().or(z.literal("")),

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

  // S3-compatible storage for uploads (Phase 1 Asset model).
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

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

/** True once object storage is wired up, so entry forms can accept file uploads. */
export const uploadsEnabled = Boolean(
  env.STORAGE_ENDPOINT && env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY_ID,
);
