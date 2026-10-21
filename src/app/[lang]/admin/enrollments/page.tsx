import { redirect } from "next/navigation";

/** The old access-request queue was replaced by Applications (apply → pay → verify). */
export default function EnrollmentsRedirect() {
  redirect("/admin/applications");
}
