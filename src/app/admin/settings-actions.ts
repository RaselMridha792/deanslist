"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { saveSettings, type SettingKey } from "@/lib/settings";

/**
 * The Site settings screen.
 *
 * OWNER only. These values reach every visitor (the links), every ad report
 * (the pixel) and the mail account (the Resend key), which is a different
 * class of thing from editing a show.
 *
 * The rules below are deliberately strict about hosts. "instagram.com/deans"
 * pasted into the YouTube box is the kind of mistake nobody notices for a
 * week, and a link typed one character wrong is a link that sends the
 * audience somewhere the client does not control.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const hosted = (label: string, hosts: string[]) =>
  z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : ""))
    .refine((v) => v === "" || /^https:\/\//i.test(v), `${label} must start with https://`)
    .refine((v) => {
      if (v === "") return true;
      try {
        const host = new URL(v).hostname.toLowerCase().replace(/^www\./, "");
        return hosts.includes(host);
      } catch {
        return false;
      }
    }, `${label} must be a link on ${hosts.join(" or ")}`);

const schema = z.object({
  youtube: hosted("The YouTube link", ["youtube.com", "youtu.be"]),
  facebook: hosted("The Facebook link", ["facebook.com", "fb.com", "fb.watch"]),
  instagram: hosted("The Instagram link", ["instagram.com", "instagr.am"]),
  // Meta writes it as a long number. Letters here mean someone pasted a whole
  // script tag or the ad account id.
  pixelId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9]{10,20}$/.test(v), "The Meta Pixel ID is a number, 10 to 20 digits. Copy it from Events Manager."),
  // Resend keys look like re_xxxxxxxx. Checking the shape catches a pasted
  // webhook secret or a truncated copy before the first send fails.
  resendApiKey: z
    .string()
    .trim()
    .refine((v) => v === "" || /^re_[A-Za-z0-9_-]{10,}$/.test(v), "A Resend API key starts with re_ . Copy it from Resend > API Keys."),
  clearResendApiKey: z.boolean(),
});

export async function saveSiteSettings(formData: FormData): Promise<ActionResult> {
  const user = await requireRole("OWNER");

  const parsed = schema.safeParse({
    youtube: String(formData.get("youtube") ?? ""),
    facebook: String(formData.get("facebook") ?? ""),
    instagram: String(formData.get("instagram") ?? ""),
    pixelId: String(formData.get("pixelId") ?? ""),
    resendApiKey: String(formData.get("resendApiKey") ?? ""),
    clearResendApiKey: formData.get("clearResendApiKey") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const d = parsed.data;

  /*
   * A blank ordinary field clears the row, which puts the built-in value back.
   * A blank SECRET field changes nothing: the screen never shows the key, so
   * an empty box means "leave it alone" rather than "delete it". Clearing a
   * key is the checkbox, which has to be ticked on purpose.
   */
  const changes: Partial<Record<SettingKey, string | null>> = {
    "social.youtube": d.youtube === "" ? null : d.youtube,
    "social.facebook": d.facebook === "" ? null : d.facebook,
    "social.instagram": d.instagram === "" ? null : d.instagram,
    "meta.pixelId": d.pixelId === "" ? null : d.pixelId,
  };

  if (d.clearResendApiKey) changes["mail.resendApiKey"] = null;
  else if (d.resendApiKey !== "") changes["mail.resendApiKey"] = d.resendApiKey;

  try {
    await saveSettings(changes, { id: user.id, email: user.email });
  } catch (err) {
    console.error("[settings] save failed", err);
    return { ok: false, error: "Could not save. Try again, and tell the developer if it keeps failing." };
  }

  // The links and the pixel are in the layout, so every page carries them.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { ok: true };
}
