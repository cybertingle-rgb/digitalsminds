/** Admin labels for batch values (safe for client components). */
export const batchStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const availabilityLabels: Record<string, string> = {
  open: "Taking applications",
  full: "Full",
  deadline: "Deadline passed",
  closed: "Not taking applications",
};
