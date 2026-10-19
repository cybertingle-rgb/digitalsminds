import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { can, type Permission, type Role } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  googleEmail: string | null;
  preferredLocale: "en" | "ur";
};

/** The signed-in, active user for this request, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & Record<string, unknown>;
  if (u.status === "SUSPENDED") return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as Role) ?? "STUDENT",
    googleEmail: (u.googleEmail as string | null) ?? null,
    preferredLocale: u.preferredLocale === "ur" ? "ur" : "en",
  };
}

/** For pages: sends anonymous visitors to login and hides the page from users without permission. */
export async function requirePagePermission(permission: Permission, returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!can(user.role, permission)) notFound();
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("You don't have permission to do that.");
    this.name = "ForbiddenError";
  }
}

/** For server actions and route handlers: throws unless the user has the permission. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, permission)) throw new ForbiddenError();
  return user;
}

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNext(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
