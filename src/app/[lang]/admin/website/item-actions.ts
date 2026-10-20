"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@/i18n/get-dictionary";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import {
  caseStudyInput,
  ContentError,
  deleteCaseStudy,
  deleteFaq,
  deleteTestimonial,
  faqInput,
  importDefaultFaqs,
  moveItem,
  saveCaseStudy,
  saveTestimonial,
  testimonialInput,
  createFaq,
  updateFaq,
} from "@/modules/content/items";
import type { WebsiteState } from "./actions";

async function run(fn: (actor: CurrentUser) => Promise<string | WebsiteState>): Promise<WebsiteState> {
  try {
    const actor = await assertPermission("content.manage");
    const r = await fn(actor);
    revalidatePath("/[lang]", "layout");
    return typeof r === "string" ? { status: "success", message: r } : r;
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ContentError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[website] item action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const on = (fd: FormData, k: string) => fd.get(k) === "on";
const optionalId = (id: string | null) => (id ? z.string().max(64).parse(id) : null);

export async function saveFaqAction(id: string | null, _prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run(async (actor) => {
    const input = faqInput.parse({ question: str(fd, "question"), questionUr: str(fd, "questionUr"), answer: str(fd, "answer"), answerUr: str(fd, "answerUr"), published: on(fd, "published") });
    if (id) await updateFaq(optionalId(id)!, input, actor.id);
    else await createFaq(input, actor.id);
    return input.published ? "Saved and published." : "Saved as a draft.";
  });
}

export async function importFaqsAction(): Promise<WebsiteState> {
  return run(async (actor) => {
    await importDefaultFaqs(getDictionary("en"), actor.id);
    return "The current FAQs were copied here. You can now edit them.";
  });
}

export async function saveTestimonialAction(id: string | null, _prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run(async (actor) => {
    const input = testimonialInput.parse({
      name: str(fd, "name"),
      roleTitle: str(fd, "roleTitle"),
      company: str(fd, "company"),
      quote: str(fd, "quote"),
      quoteUr: str(fd, "quoteUr"),
      photoId: str(fd, "photoId"),
      consentConfirmed: on(fd, "consentConfirmed"),
      published: on(fd, "published"),
      featured: on(fd, "featured"),
    });
    await saveTestimonial(optionalId(id), input, actor.id);
    return input.published ? "Saved and published." : "Saved as a draft.";
  });
}

export async function saveCaseStudyAction(id: string | null, _prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  return run(async (actor) => {
    const input = caseStudyInput.parse({
      title: str(fd, "title"),
      titleUr: str(fd, "titleUr"),
      slug: str(fd, "slug"),
      client: str(fd, "client"),
      summary: str(fd, "summary"),
      summaryUr: str(fd, "summaryUr"),
      body: str(fd, "body"),
      bodyUr: str(fd, "bodyUr"),
      serviceSlug: str(fd, "serviceSlug"),
      coverImageId: str(fd, "coverImageId"),
      consentConfirmed: on(fd, "consentConfirmed"),
      published: on(fd, "published"),
    });
    const c = await saveCaseStudy(optionalId(id), input, actor.id);
    return { status: "success", message: c.published ? "Saved and published." : "Saved as a draft.", ...(id ? {} : { redirectTo: `/admin/website/case-studies/${c.id}` }) };
  });
}

export async function moveItemAction(kind: "faq" | "testimonial" | "caseStudy", id: string, direction: "up" | "down"): Promise<WebsiteState> {
  return run(async () => {
    await moveItem(z.enum(["faq", "testimonial", "caseStudy"]).parse(kind), optionalId(id)!, z.enum(["up", "down"]).parse(direction));
    return "Moved.";
  });
}

export async function deleteItemAction(kind: "faq" | "testimonial" | "caseStudy", id: string): Promise<WebsiteState> {
  return run(async (actor) => {
    const k = z.enum(["faq", "testimonial", "caseStudy"]).parse(kind);
    const itemId = optionalId(id)!;
    if (k === "faq") await deleteFaq(itemId, actor.id);
    else if (k === "testimonial") await deleteTestimonial(itemId, actor.id);
    else await deleteCaseStudy(itemId, actor.id);
    return "Deleted.";
  });
}
