import { z } from "zod";
import { serviceSlugs } from "@/content/services";

/** "ebay-course": enrollment requests for the paid eBay course (featured on the homepage). */
export const INQUIRY_SERVICE_OPTIONS = [...serviceSlugs, "ebay-course", "general"] as const;

const trimmed = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

const optionalTrimmed = (max: number, label: string) =>
  trimmed(max, label)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Shared by the API route (authoritative) and the client form (UX hints). */
export const inquiryInputSchema = z.object({
  name: trimmed(120, "Name").min(2, "Please enter your name"),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Please enter a valid email address")),
  phone: optionalTrimmed(40, "Phone").refine(
    (v) => v === undefined || /^[+()\-\s\d]{6,40}$/.test(v),
    "Please enter a valid phone number",
  ),
  company: optionalTrimmed(160, "Company"),
  service: z.enum(INQUIRY_SERVICE_OPTIONS, { error: "Please choose a service" }),
  message: trimmed(5000, "Message").min(10, "Please tell us a little more (at least 10 characters)"),
  source: optionalTrimmed(200, "Source"),
  /** Language of the page the form was sent from. */
  locale: z.enum(["en", "ur"]).optional().catch(undefined),
  /** Campaign attribution captured from the landing URL (utm_* parameters). Invalid values are dropped, never rejected. */
  utmSource: optionalTrimmed(100, "utm_source").catch(undefined),
  utmMedium: optionalTrimmed(100, "utm_medium").catch(undefined),
  utmCampaign: optionalTrimmed(150, "utm_campaign").catch(undefined),
  /** Honeypot: hidden from real users. Checked in the route before validation. */
  website: z.string().max(500).optional(),
});

export type InquiryInput = z.infer<typeof inquiryInputSchema>;
