"use client";

import { useRouter } from "next/navigation";
import { deleteLessonAction } from "./actions";
import { ConfirmButton } from "./CourseForms";

export function ConfirmDeleteLesson({ lessonId, courseId, title }: { lessonId: string; courseId: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete lesson"
      question={`Delete the lesson “${title}” and its resource links?`}
      confirmLabel="Delete lesson"
      run={() => deleteLessonAction(lessonId)}
      onResult={() => router.push(`/admin/courses/${courseId}`)}
    />
  );
}
