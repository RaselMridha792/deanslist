import { z } from "zod";

/**
 * Campaign markers, spread into a lead body by the forms.
 *
 * Every one is optional and length-capped. They are attacker-controlled — a
 * `utm_campaign` is whatever was in the URL — so they are treated as labels,
 * never as anything that decides behaviour, and the cap keeps a crafted URL
 * from writing a novel into the database.
 */
const attributionShape = {
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  clickId: z.string().max(500).optional(),
  landingPath: z.string().max(300).optional(),
};

export const leadSchema = z.object({
  type: z
    .enum(["CONTESTANT", "FAN", "SPONSOR", "CREW", "GENERAL", "PRESS"])
    .default("GENERAL"),
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email("A valid email is required"),
  phone: z.string().max(40).optional(),
  // Postal address — the client requires it on every lead (session.md).
  addressLine1: z.string().max(160).optional(),
  addressLine2: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(80).optional(),
  talentCategory: z.string().max(80).optional(),
  performanceUrl: z
    .string()
    .url("Enter a valid link")
    .optional()
    .or(z.literal("")),
  stageName: z.string().max(80).optional(),
  ageRange: z.string().max(20).optional(),
  message: z.string().max(2000).optional(),
  showSlug: z.string().max(120).optional(),
  marketingOptIn: z.boolean().default(false),

  // Contest consents. Optional on the schema because only the entry funnel
  // collects them, but see the route: an entry that claims to be a CONTESTANT
  // is rejected without both. Client-side `required` is a prompt, not a
  // guarantee — a crafted POST skips it entirely.
  rulesAccepted: z.boolean().optional(),
  broadcastConsent: z.boolean().optional(),
  smsOptIn: z.boolean().default(false),
  /**
   * Honeypot. Deliberately NOT constrained to max(0).
   *
   * A Zod rejection answers 400 "Invalid submission", which tells a bot exactly
   * which field caught it. The route instead accepts a filled honeypot with a
   * cheerful 200 and writes nothing, so the bot records a success and moves on.
   * Constraining it here made that branch unreachable dead code — and made the
   * tests that claimed to prove the honeypot works pass for the wrong reason.
   */
  website: z.string().max(200).optional(),

  ...attributionShape,
});

export type LeadInput = z.infer<typeof leadSchema>;

export const subscribeSchema = z.object({
  firstName: z.string().min(1).max(80).default("Friend"),
  email: z.string().email(),
  country: z.string().max(80).optional(),
  // Honeypot. See the note in leadSchema — the route answers 200 and writes
  // nothing rather than telling a bot which field caught it.
  website: z.string().max(200).optional(),

  ...attributionShape,
});
