/**
 * The visitor's answer to the cookie banner, and what it covered.
 *
 * Consent is for something specific. Someone who allowed Google Analytics has
 * not allowed a Meta Pixel the client switches on next month, so the stored
 * answer records which tools were on the banner when it was given, and the
 * banner asks again when a tool is added that the answer does not cover.
 *
 * Stored in localStorage as "granted:ga,pixel" or "denied:ga". The value from
 * before tools were recorded, a bare "granted" or "denied", was only ever
 * shown for the pixel, so it is read as covering the pixel alone.
 *
 * src/components/site/GoogleTag.tsx reads the same value in an inline script,
 * before React loads, so a returning visitor's choice applies to the very first
 * hit. That parser is a copy of readConsent below; change both together.
 */

export const CONSENT_KEY = "dl_ads_consent";

export type Tool = "ga" | "pixel";
export type Choice = "granted" | "denied";
export type Consent = { choice: Choice; tools: Tool[] };

export function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const [choice, list] = raw.split(":");
    if (choice !== "granted" && choice !== "denied") return null;
    const tools = (list === undefined ? ["pixel"] : list.split(",")).filter(
      (t): t is Tool => t === "ga" || t === "pixel",
    );
    return { choice, tools };
  } catch {
    // Private mode or storage blocked: no stored answer, so nothing is allowed.
    return null;
  }
}

export function writeConsent(choice: Choice, tools: Tool[]): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, `${choice}:${tools.join(",")}`);
  } catch {
    // Not storable. The choice still holds for this page view.
  }
}

/** True when the stored answer is yes and was given with this tool on the banner. */
export function allows(consent: Consent | null, tool: Tool): boolean {
  return consent?.choice === "granted" && consent.tools.includes(tool);
}

/** True when every tool now on the site was on the banner when the visitor answered. */
export function answered(consent: Consent | null, tools: Tool[]): boolean {
  return Boolean(consent) && tools.every((t) => consent!.tools.includes(t));
}
