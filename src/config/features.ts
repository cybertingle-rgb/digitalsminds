/**
 * Feature flags for modules that are planned but not yet live.
 * Flip a flag only once the module described in docs/STUDENT_PORTAL.md exists.
 */
export const features = {
  /** Phase 2: student registration/login, courses, lessons, enrollment, progress. */
  studentPortal: false,
  /** Phase 2: internal admin dashboard (inquiries, courses, students). */
  adminDashboard: false,
} as const;
