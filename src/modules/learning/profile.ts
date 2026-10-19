import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

export const profileInput = z.object({
  name: z.string().trim().min(2).max(120),
  googleEmail: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  phone: z.string().trim().regex(/^[+()\-\s\d]{6,40}$/).or(z.literal("")).transform((v) => v || null),
  city: z.string().trim().max(80).transform((v) => v || null),
  preferredLocale: z.enum(["en", "ur"]),
});

/** Students edit their own profile; role and status are never touched here. */
export async function updateProfile(userId: string, input: z.infer<typeof profileInput>) {
  await db().user.update({ where: { id: userId }, data: input });
}

export function profileOf(userId: string) {
  return db().user.findUnique({ where: { id: userId }, select: { name: true, email: true, googleEmail: true, phone: true, city: true, preferredLocale: true } });
}
