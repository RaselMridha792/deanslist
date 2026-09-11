import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { SITE } from "@/content/site";
import { getSettings, maskSecret } from "@/lib/settings";
import { AdminPageHeader, Checkbox, CrudForm, Field } from "@/components/admin/crud";
import { saveSiteSettings } from "@/app/admin/settings-actions";

export const dynamic = "force-dynamic";

/**
 * Site settings: the handful of values the client should be able to change
 * without a developer.
 *
 * Each row says where the live value is coming from — this screen, the
 * server's .env, or the value the site shipped with — because "it is blank"
 * and "it is unset" are different states and only one of them is a problem.
 */
export default async function SiteSettingsPage() {
  await requireRole("OWNER");
  const values = await getSettings();

  const source = (fromDashboard: string | undefined, fallback: string | null, fallbackLabel: string) =>
    fromDashboard
      ? "Set here."
      : fallback
        ? `Not set here, so the site uses ${fallbackLabel}: ${fallback}`
        : `Not set. ${fallbackLabel}`;

  const resend = values["mail.resendApiKey"];
  const resendFromEnv = !resend && Boolean(env.RESEND_API_KEY);

  return (
    <>
      <AdminPageHeader
        title="Site settings"
        description="Links, the ad pixel and the email key. Changes are live as soon as they save — no developer, no deploy."
      />

      <div className="card mt-8 max-w-3xl p-7">
        <CrudForm action={saveSiteSettings} submitLabel="Save settings">
          <div className="sm:col-span-2">
            <p className="eyebrow">Channels</p>
            <p className="mt-2 max-w-[70ch] text-sm text-admin-muted">
              These are the links behind every YouTube, Facebook and Instagram button on the
              site, in the chat panel and in the share previews. Leave one blank to go back to
              the built-in link.
            </p>
          </div>

          <Field
            label="YouTube"
            name="youtube"
            span
            defaultValue={values["social.youtube"] ?? ""}
            placeholder={SITE.socials.youtube}
            help={source(values["social.youtube"], SITE.socials.youtube, "the built-in link")}
          />

          <Field
            label="Facebook"
            name="facebook"
            span
            defaultValue={values["social.facebook"] ?? ""}
            placeholder={SITE.socials.facebook}
            help={source(values["social.facebook"], SITE.socials.facebook, "the built-in link")}
          />

          <Field
            label="Instagram"
            name="instagram"
            span
            defaultValue={values["social.instagram"] ?? ""}
            placeholder="https://www.instagram.com/yourpage"
            help={
              values["social.instagram"]
                ? "Set here. The Instagram button appears in the footer and on the contact page."
                : "Not set, so no Instagram button is shown anywhere."
            }
          />

          <div className="sm:col-span-2 border-t-2 border-admin-line pt-6">
            <p className="eyebrow">Meta ads</p>
            <p className="mt-2 max-w-[70ch] text-sm text-admin-muted">
              The Pixel ID from Meta Events Manager, a long number. With it set, the pixel
              loads on the public pages and reports which ad an entry came from. With it
              blank, no tracking code is loaded at all.
            </p>
          </div>

          <Field
            label="Meta Pixel ID"
            name="pixelId"
            span
            defaultValue={values["meta.pixelId"] ?? ""}
            placeholder="1234567890123456"
            help={
              values["meta.pixelId"]
                ? "Set here. The pixel is live on the public pages."
                : "Not set, so no pixel is loaded."
            }
          />

          <div className="sm:col-span-2 border-t-2 border-admin-line pt-6">
            <p className="eyebrow">Email</p>
            <p className="mt-2 max-w-[70ch] text-sm text-admin-muted">
              The Resend API key, which is what lets the site send anything at all:
              confirmations to entrants, new-entry alerts to the team, show reminders and
              campaigns. It is stored encrypted, and this screen never shows it again.
            </p>
          </div>

          <Field
            label="Resend API key"
            name="resendApiKey"
            span
            type="password"
            placeholder={resend ? "Leave blank to keep the saved key" : "re_..."}
            help={
              resend
                ? `Saved (${maskSecret(resend)}). Type a new key to replace it, or leave blank to keep it.`
                : resendFromEnv
                  ? "Not set here, so the site uses the key in the server's .env file."
                  : "Not set, so no email is sent. The site keeps recording entries either way."
            }
          />

          {resend && (
            <Checkbox
              label="Remove the saved key"
              name="clearResendApiKey"
              help="Ticked, this deletes the key on save. Email stops until a new one is entered."
            />
          )}

          <div className="sm:col-span-2 border-t-2 border-admin-line pt-5">
            <p className="max-w-[70ch] text-xs text-admin-faint">
              The key is encrypted with the server&apos;s own secret, so a copy of the
              database alone cannot reveal it. If that server secret is ever changed, the
              saved key can no longer be read and has to be entered here again.
            </p>
          </div>
        </CrudForm>
      </div>
    </>
  );
}
