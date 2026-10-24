"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { CatalogError, categoryInput, deleteCategory, deleteService, saveCategory, saveService, serviceInput } from "@/modules/catalog/service";

export type CatalogState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string>; redirectTo?: string };

async function run(permission: Permission, fn: (actor: CurrentUser) => Promise<CatalogState>): Promise<CatalogState> {
  try {
    const result = await fn(await assertPermission(permission));
    // Services and categories appear in the header, footer, home page and programs page.
    revalidatePath("/[lang]", "layout");
    return result;
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof CatalogError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[catalog] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const id = z.string().min(1).max(64);

const readService = (fd: FormData) =>
  serviceInput.parse({
    slug: str(fd, "slug"),
    title: str(fd, "title"),
    shortTitle: str(fd, "shortTitle"),
    summary: str(fd, "summary"),
    description: str(fd, "description"),
    offerings: str(fd, "offerings"),
    idealFor: str(fd, "idealFor"),
    notice: str(fd, "notice"),
    categoryId: str(fd, "categoryId"),
    sortOrder: str(fd, "sortOrder") || "0",
    status: str(fd, "status"),
    seoTitle: str(fd, "seoTitle"),
    seoDescription: str(fd, "seoDescription"),
  });

export async function saveServiceAction(serviceId: string | null, _prev: CatalogState, fd: FormData): Promise<CatalogState> {
  return run("content.manage", async (actor) => {
    const row = await saveService(serviceId ? id.parse(serviceId) : null, readService(fd), actor);
    return serviceId ? { status: "success", message: "Service saved." } : { status: "success", message: "Service created.", redirectTo: `/admin/services/${row.id}` };
  });
}

export async function deleteServiceAction(serviceId: string): Promise<CatalogState> {
  return run("content.manage", async (actor) => {
    await deleteService(id.parse(serviceId), actor);
    return { status: "success", message: "Service deleted.", redirectTo: "/admin/services" };
  });
}

const readCategory = (fd: FormData) =>
  categoryInput.parse({
    slug: str(fd, "slug"),
    title: str(fd, "title"),
    titleUr: str(fd, "titleUr"),
    summary: str(fd, "summary"),
    summaryUr: str(fd, "summaryUr"),
    notice: str(fd, "notice"),
    sortOrder: str(fd, "sortOrder") || "0",
    active: fd.get("active") === "on",
  });

export async function saveCategoryAction(categoryId: string | null, _prev: CatalogState, fd: FormData): Promise<CatalogState> {
  return run("courses.manage.all", async (actor) => {
    await saveCategory(categoryId ? id.parse(categoryId) : null, readCategory(fd), actor);
    return { status: "success", message: categoryId ? "Category saved." : "Category added." };
  });
}

export async function deleteCategoryAction(categoryId: string): Promise<CatalogState> {
  return run("courses.manage.all", async (actor) => {
    await deleteCategory(id.parse(categoryId), actor);
    return { status: "success", message: "Category deleted. Its programs and services are now uncategorised." };
  });
}
