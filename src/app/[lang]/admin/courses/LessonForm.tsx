"use client";

import { useState } from "react";
import { describedBy, Field, inputClass } from "@/components/forms/Field";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { driveEmbedUrl, driveFileId, driveViewUrl } from "@/modules/courses/drive";
import { RichText } from "@/modules/courses/richtext";
import { saveLessonAction, type CourseState } from "./actions";
import { Result } from "./CourseForms";

export type LessonValues = { id: string; title: string; videoUrl: string; content: string; durationMinutes: string; isPreview: boolean };

const idle: CourseState = { status: "idle" };

export function LessonForm({ lesson }: { lesson: LessonValues }) {
  const [state, onSubmit, pending] = useFormAction(saveLessonAction.bind(null, lesson.id), idle);
  const [video, setVideo] = useState(lesson.videoUrl);
  const [content, setContent] = useState(lesson.content);
  const fileId = video.trim() ? driveFileId(video) : null;
  const videoError = state.errors?.videoUrl ?? (video.trim() && !fileId ? "This doesn't look like a Google Drive file link. In Drive: right-click the video → Share → Copy link." : undefined);
  const e = (name: string) => state.errors?.[name];

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Field label="Lesson title" name="title" error={e("title")}>
        <input id="title" name="title" defaultValue={lesson.title} maxLength={200} required dir="auto" className={inputClass} aria-invalid={e("title") ? true : undefined} aria-describedby={describedBy("title", e("title"))} />
      </Field>

      <div className="space-y-3">
        <Field label="Google Drive video link (optional)" name="videoUrl" error={videoError} hint="Paste the link from Drive → Share → Copy link.">
          <input
            id="videoUrl"
            name="videoUrl"
            type="url"
            dir="ltr"
            value={video}
            onChange={(ev) => setVideo(ev.target.value)}
            placeholder="https://drive.google.com/file/d/…/view"
            maxLength={1000}
            className={inputClass}
            aria-invalid={videoError ? true : undefined}
            aria-describedby={describedBy("videoUrl", videoError, "hint")}
          />
        </Field>
        {fileId && (
          <div className="space-y-2">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-charcoal-900">
              <iframe
                src={driveEmbedUrl(fileId)}
                title="Video preview"
                allow="autoplay; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <p className="text-xs text-muted">
              Not playing? You may not have access with the Google account you&apos;re signed in to in this browser.{" "}
              <a href={driveViewUrl(fileId)} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">Open in Google Drive</a>
            </p>
          </div>
        )}
        <p className="rounded-lg bg-sun-50 p-3 text-xs text-charcoal-800">
          Videos stay private in your Google Drive. Share each video (or its folder) with an enrolled student&apos;s Google email so they can watch it.
          Some browsers (notably Safari on iPhone) block embedded Drive players; students always get an “Open in Google Drive” button too.
        </p>
      </div>

      <Field label="Lesson text (optional)" name="content" error={e("content")} hint="Blank line = new paragraph · “## ” = heading · “- ” = bullet · links are clickable.">
        <textarea
          id="content"
          name="content"
          rows={12}
          maxLength={50000}
          dir="auto"
          value={content}
          onChange={(ev) => setContent(ev.target.value)}
          className={inputClass}
          aria-describedby={describedBy("content", e("content"), "hint")}
        />
      </Field>
      {content.trim() && (
        <details className="rounded-xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Formatted preview</summary>
          <RichText text={content} className="mt-4 text-charcoal-800" />
        </details>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Length (minutes, optional)" name="durationMinutes" error={e("durationMinutes")}>
          <input id="durationMinutes" name="durationMinutes" type="number" min={1} inputMode="numeric" defaultValue={lesson.durationMinutes} className={inputClass} />
        </Field>
        <label className="flex items-start gap-3 self-end pb-2 text-sm text-charcoal-900">
          <input type="checkbox" name="isPreview" defaultChecked={lesson.isPreview} className="mt-0.5 h-5 w-5 accent-charcoal-900" />
          <span>
            Free preview
            <span className="block text-xs text-muted">Shown on the public course page to anyone. The video must then be shared as “Anyone with the link”.</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="dark" disabled={pending}>{pending ? "Saving…" : "Save lesson"}</Button>
        <Result state={state} />
      </div>
    </form>
  );
}
