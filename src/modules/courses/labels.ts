export const courseStatusLabels = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" } as const;

export const levelLabels = {
  ALL_LEVELS: "All levels",
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
} as const;

export const languageLabels = { en: "English", ur: "Urdu" } as const;

export const formatLabels = { ONLINE_LIVE: "Online live classes (Zoom / Google Meet)", IN_PERSON: "In person", HYBRID: "Online and in person" } as const;

/** "45 min", "2 h", "1 h 30 min". */
export function formatMinutes(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}
