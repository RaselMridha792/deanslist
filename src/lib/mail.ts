import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendMail({ to, subject, html, replyTo }: SendArgs) {
  if (!resend) {
    // No key configured yet (free tier not connected). Log instead of failing.
    console.warn("[mail] RESEND_API_KEY missing, skipped sending:", subject);
    return { skipped: true as const };
  }

  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM ?? "Dean's List <onboarding@resend.dev>",
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
      <p style="color:#D4AF37;letter-spacing:2px;font-size:12px;margin:0 0 8px">THE DEAN'S LIST</p>
      <h1 style="margin:0 0 16px;font-size:24px">Entry received, ${firstName}</h1>
      <p style="color:#C9C9D1;line-height:1.6">
        Thanks for entering${showTitle ? ` ${showTitle}` : ""}. Our team reviews every submission.
        If you are selected, we will contact you by email with the next steps.
      </p>
      <p style="color:#C9C9D1;line-height:1.6">Keep an eye on your inbox and our channels.</p>
    </div>
  </div>`;
}
