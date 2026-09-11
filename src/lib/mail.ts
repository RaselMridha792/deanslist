import { Resend } from "resend";
import { env } from "@/lib/env";
import { getResendApiKey } from "@/lib/settings";

/**
 * The key is read per send, not at import.
 *
 * It can now come from the dashboard (/admin/settings) as well as from .env,
 * and the client can add or replace it while the server is running. Reading it
 * once at module load would have meant a restart before the first email ever
 * sent, which is exactly the kind of thing nobody remembers at 8pm on a show
 * night. The Resend client is still reused between sends, and rebuilt only
 * when the key changes.
 */
let cached: { key: string; client: Resend } | null = null;

function clientFor(key: string): Resend {
  if (!cached || cached.key !== key) cached = { key, client: new Resend(key) };
  return cached.client;
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendMail({ to, subject, html, replyTo }: SendArgs) {
  const key = await getResendApiKey();
  if (!key) {
    // No key yet, in the dashboard or in .env. Log instead of failing: the lead
    // is already saved, and losing the record over a missing email would be the
    // worse outcome.
    console.warn("[mail] no Resend key configured, skipped sending:", subject);
    return { skipped: true as const };
  }

  const { data, error } = await clientFor(key).emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    replyTo,
  });

  if (error) throw new Error(error.message);
  return { id: data?.id, skipped: false as const };
}

export function entryConfirmationEmail(firstName: string, showTitle?: string) {
  return `
  <div style="font-family:Helvetica,Arial,sans-serif;background:#0B0B0F;padding:32px;color:#fff">
    <div style="max-width:560px;margin:0 auto;background:#14141B;border:1px solid #26262F;border-radius:12px;padding:32px">
      <p style="color:#C8102E;letter-spacing:2px;font-size:12px;margin:0 0 8px">THE DEAN'S LIST</p>
      <h1 style="margin:0 0 16px;font-size:24px">Entry received, ${firstName}</h1>
      <p style="color:#C9C9D1;line-height:1.6">
        Thanks for entering${showTitle ? ` ${showTitle}` : ""}. Our team reviews every submission.
        If you are selected, we will contact you by email with the next steps.
      </p>
      <p style="color:#C9C9D1;line-height:1.6">Keep an eye on your inbox and our channels.</p>
    </div>
  </div>`;
}
