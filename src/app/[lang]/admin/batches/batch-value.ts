/** Form values for the batch editor (strings, as in the form). */
export type BatchValue = {
  courseId: string;
  name: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  scheduleText: string;
  capacity: string;
  meetingUrl: string;
  joiningInfo: string;
  internalNotes: string;
  coordinatorId: string;
};

export const emptyBatch: BatchValue = {
  courseId: "",
  name: "",
  code: "",
  status: "DRAFT",
  startDate: "",
  endDate: "",
  applicationDeadline: "",
  scheduleText: "",
  capacity: "30",
  meetingUrl: "",
  joiningInfo: "",
  internalNotes: "",
  coordinatorId: "",
};
