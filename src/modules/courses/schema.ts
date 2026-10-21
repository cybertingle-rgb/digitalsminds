import { z } from "zod";
import { serviceSlugs } from "@/content/services";

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().transform((v) => (v ? v : null));

/** ASCII slug from a title; Urdu-only titles fall back to the caller's default. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only (e.g. digital-marketing-basics)")
  .max(80);

export const newCourseInput = z.object({
  title: text(200).min(3, "Enter a program title"),
  language: z.enum(["en", "ur"]),
  summary: text(500).min(10, "Write a short summary (at least 10 characters)"),
});

export const courseDetailsInput = z.object({
  title: text(200).min(3, "Enter a course title"),
  titleUr: optional(200),
  slug: slugSchema,
  language: z.enum(["en", "ur"]),
  summary: text(500).min(10, "Write a short summary (at least 10 characters)"),
  summaryUr: optional(500),
  description: optional(20_000),
  /** One objective per line. */
  objectives: text(5000).optional().transform((v) =>
    (v ?? "")
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 30),
  ),
  prerequisites: optional(5000),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"]),
  /** e.g. "8 weeks · 3 live classes a week". */
  durationText: optional(160),
  format: z.enum(["ONLINE_LIVE", "IN_PERSON", "HYBRID"]),
  thumbnailId: z.string().max(64).optional().transform((v) => (v ? v : null)),
  serviceSlug: z.enum([...serviceSlugs, ""] as [string, ...string[]]).optional().transform((v) => (v ? v : null)),
  certificateEnabled: z.boolean(),
  seoTitle: optional(200),
  seoDescription: optional(320),
});

export const moduleInput = z.object({ title: text(200).min(2, "Enter a module title") });

export const lessonInput = z.object({
  title: text(200).min(2, "Enter a lesson title"),
  content: optional(50_000),
  videoUrl: text(1000).optional().transform((v) => (v ? v : null)),
  durationMinutes: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(1).max(10_000).optional()).transform((v) => v ?? null),
  isPreview: z.boolean(),
});

export const resourceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("FILE"), title: text(200).min(2, "Enter a title"), mediaAssetId: z.string().min(1).max(64) }),
  z.object({
    kind: z.literal("LINK"),
    title: text(200).min(2, "Enter a title"),
    url: z.url({ protocol: /^https$/, error: "Enter a full https:// link" }).max(1000),
  }),
]);
