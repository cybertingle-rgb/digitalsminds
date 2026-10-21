# Student portal

The portal (`/account`) is for **enrollment administration, not online learning**. A student account exists only
after a Super Admin has verified the enrollment payment (see docs/ENROLLMENT.md).

| Page | What the student sees |
| --- | --- |
| Dashboard | Enrollment stage and next step per program, next session, latest notices, quick links; profile-completion reminder |
| My program | Program and batch details (dates, class times, format, coordinator, application reference), joining instructions and class link (current students), payments with receipts, stage timeline |
| Schedule | Classes (join button from 15 minutes before, add to calendar), holidays and events for their batch |
| Onboarding | Checklist for everyone / their program / their batch; students tick their own steps, staff confirm the rest |
| Documents | Published files for everyone / their program / their batch (private downloads) |
| Notices | Announcements for all students, their program or their batch |
| Certificates | Certificates issued after completion, with public verification |
| Notifications, Support, Profile | As before |

Students only ever see their own records. Batch content requires a current enrollment (confirmed, onboarding or
active; documents and certificates also when completed). Code: `src/modules/portal/service.ts`,
`src/app/[lang]/(marketing)/account/`.
