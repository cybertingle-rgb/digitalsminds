# Phase 2: Student Portal (plan only)

Status: **not built.** This document defines the modules and integration points so the portal
can be added without restructuring the Phase 1 site. Gate everything behind
`features.studentPortal` / `features.adminDashboard` in `src/config/features.ts`.

## Modules

| Module | Responsibility | Location |
| --- | --- | --- |
| `auth` | Registration, login/logout, email verification, password reset, sessions | `src/modules/auth/`, `src/app/(auth)/login`, `/register`, `/forgot-password` |
| `users` | Profiles, roles (`STUDENT`, `INSTRUCTOR`, `ADMIN`) | `src/modules/users/` |
| `courses` | Courses, modules/sections, publishing workflow | `src/modules/courses/` |
| `lessons` | Lesson content (text/video/resources), ordering, previews | `src/modules/lessons/` |
| `enrollments` | Enrol/unenrol, access checks, (later) payments | `src/modules/enrollments/` |
| `progress` | Lesson completion, course progress %, resume point | `src/modules/progress/` |
| `admin` | Dashboard: inquiries (existing `Inquiry` table), students, courses, enrollments | `src/app/admin/` |

## Routes

```
src/app/
  (marketing)/       existing public site; adds /courses catalogue + /courses/[slug]
  (auth)/            login, register, verify, forgot/reset password
  (portal)/          authenticated student area: /dashboard, /learn/[course]/[lesson], /account
  admin/             role ADMIN only: /admin, /admin/inquiries, /admin/courses, /admin/students
  api/               JSON endpoints per module where a client/mobile app needs them
src/proxy.ts         optimistic redirect for /dashboard, /learn, /admin when no session cookie
```

Authorisation must be enforced again in every server action / route handler / data access
function (via a `requireUser()` / `requireRole("ADMIN")` helper in `src/modules/auth`), not only in `proxy.ts`.

## Auth approach

Use a maintained library with a Prisma adapter instead of hand-rolled crypto. Candidates:
**Better Auth** or **Auth.js (NextAuth v5)**. Requirements: database sessions or short-lived
signed cookies (`HttpOnly`, `Secure`, `SameSite=Lax`), password hashing with argon2/bcrypt,
email verification, rate-limited login and reset endpoints, and optional Google sign-in.
New env vars: `AUTH_SECRET`, email provider credentials (e.g. `SMTP_*` or `RESEND_API_KEY`), optional OAuth IDs.

## Proposed data model (add via migrations when Phase 2 starts)

```prisma
enum Role { STUDENT INSTRUCTOR ADMIN }
enum CourseStatus { DRAFT PUBLISHED ARCHIVED }
enum EnrollmentStatus { ACTIVE COMPLETED CANCELLED }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  role          Role     @default(STUDENT)
  emailVerified DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  enrollments   Enrollment[]
  progress      LessonProgress[]
  // + auth library tables: Account, Session, VerificationToken
}

model Course {
  id          String       @id @default(cuid())
  slug        String       @unique
  title       String
  summary     String
  division    String?      // optional link to a service slug in src/content/services.ts
  status      CourseStatus @default(DRAFT)
  modules     CourseModule[]
  enrollments Enrollment[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model CourseModule {
  id       String   @id @default(cuid())
  courseId String
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title    String
  position Int
  lessons  Lesson[]
  @@unique([courseId, position])
}

model Lesson {
  id        String   @id @default(cuid())
  moduleId  String
  module    CourseModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  slug      String
  title     String
  content   String   // rich text / markdown
  videoUrl  String?
  position  Int
  isPreview Boolean  @default(false)
  progress  LessonProgress[]
  @@unique([moduleId, position])
}

model Enrollment {
  id          String           @id @default(cuid())
  userId      String
  courseId    String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  course      Course           @relation(fields: [courseId], references: [id], onDelete: Cascade)
  status      EnrollmentStatus @default(ACTIVE)
  enrolledAt  DateTime         @default(now())
  completedAt DateTime?
  @@unique([userId, courseId])
}

model LessonProgress {
  userId      String
  lessonId    String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completedAt DateTime @default(now())
  @@id([userId, lessonId])
}
```

Optional later: `Inquiry.assignedToId → User` for lead ownership in the admin dashboard; `Payment`/`Order` for paid courses.

## Integration points already in place

- **Route groups:** public pages live in `(marketing)`, so `(auth)`, `(portal)` and `admin` can each have their own layout.
- **Modules pattern:** `src/modules/<feature>/{schema,service}.ts` with shared Zod schemas, as in `inquiries`.
- **Infrastructure:** `lib/db` (Prisma singleton), `lib/env` (add `AUTH_SECRET` etc.), `lib/http` (`ApiError`), `lib/rate-limit` (reuse for login/reset).
- **Navigation:** add "Courses" and a "Student Login" CTA in `src/config/site.ts` when `features.studentPortal` is on.
- **Security headers / CSP** already apply to all routes; cookies will need HTTPS (already required for production).
- **Leads:** the admin dashboard's first screen can list and update `Inquiry.status` with no schema change.

## Suggested build order

1. Auth + users + roles; protected layout; `requireUser`/`requireRole` helpers
2. Admin: inquiries list/status (quick win using existing data)
3. Courses + modules + lessons (admin CRUD), public catalogue
4. Enrollment + student dashboard + lesson player
5. Progress tracking + completion
6. Payments (if courses are paid)
