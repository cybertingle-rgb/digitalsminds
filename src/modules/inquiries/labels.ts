import { en } from "@/i18n/dictionaries/en";
import { isServiceSlug } from "@/content/services";

export const statusLabels = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
  SPAM: "Spam",
} as const;
export type InquiryStatus = keyof typeof statusLabels;
export const inquiryStatuses = Object.keys(statusLabels) as InquiryStatus[];

export function serviceLabel(slug: string): string {
  return isServiceSlug(slug) ? en.services[slug].title : "General inquiry";
}
