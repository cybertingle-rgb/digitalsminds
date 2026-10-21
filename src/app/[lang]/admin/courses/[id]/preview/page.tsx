import { redirect } from "next/navigation";

/** The student lesson preview was retired. */
export default async function PreviewRedirect({ params }: PageProps<"/[lang]/admin/courses/[id]/preview">) {
  redirect(`/admin/courses/${(await params).id}`);
}
