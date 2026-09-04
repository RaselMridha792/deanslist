import { z } from "zod";

export const leadSchema = z.object({
  type: z
    .enum(["CONTESTANT", "FAN", "SPONSOR", "CREW", "GENERAL", "PRESS"])
    .default("GENERAL"),
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email("A valid email is required"),
  phone: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  talentCategory: z.string().max(80).optional(),
  performanceUrl: z.string().url("Enter a valid link").optional().or(z.literal("")),
  stageName: z.string().max(80).optional(),
  ageRange: z.string().max(20).optional(),
  message: z.string().max(2000).optional(),
  showSlug: z.string().max(120).optional(),
  marketingOptIn: z.boolean().default(false),
  smsOptIn: z.boolean().default(false),
  // honeypot: must stay empty
  website: z.string().max(0).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

export const subscribeSchema = z.object({
  firstName: z.string().min(1).max(80).default("Friend"),
  email: z.string().email(),
  country: z.string().max(80).optional(),
  website: z.string().max(0).optional(),
});
