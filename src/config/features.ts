/**
 * Feature flags for modules that are planned but not yet live.
 */
export const features = {
  /**
   * Show the English/Urdu switcher and let search engines index /ur pages.
   * Keep false until the Urdu translation in src/i18n/dictionaries/ur.ts is
   * complete; /ur pages stay reachable for preview but are marked noindex.
   */
  urduPublic: false,
  /** Phase 2: student registration/login, courses, lessons, enrollment, progress. */
  studentPortal: false,
  /** Phase 2: internal admin dashboard (inquiries, courses, students). */
  adminDashboard: false,
} as const;
