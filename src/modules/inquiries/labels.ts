import { extraInquiryTopics } from "@/content/service-defaults";

export const statusLabels = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
  SPAM: "Spam",
} as const;
export type InquiryStatus = keyof typeof statusLabels;
export const inquiryStatuses = Object.keys(statusLabels) as InquiryStatus[];

/** Name of an inquiry topic; `labels` comes from inquiryTopicLabels() (services are edited in the admin). */
export function serviceLabel(slug: string, labels?: Map<string, string>): string {
  return labels?.get(slug) ?? extraInquiryTopics[slug] ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
