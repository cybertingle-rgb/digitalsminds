import "server-only";
import { db } from "@/lib/db";

/**
 * "Contains" search that works on every MySQL/MariaDB setup.
 *
 * Prisma turns `contains`/`startsWith` into `col LIKE CONCAT(?, '%')`. On some
 * servers (e.g. Hostinger's MariaDB) the bound value and the '%' literal get
 * different collations and the query fails with "Illegal mix of collations".
 * Here the whole pattern is one value, converted and collated explicitly to
 * the tables' collation, so the server's defaults never matter.
 */

const SEARCHABLE = {
  User: ["name", "email", "googleEmail", "phone", "city"],
  Inquiry: ["name", "email", "company", "message"],
  MediaAsset: ["originalName", "altText"],
  Certificate: ["code", "recipientName", "courseTitle"],
  SupportTicket: ["subject"],
  NewsletterSubscriber: ["email"],
} as const;

type Table = keyof typeof SEARCHABLE;
const MAX_MATCHES = 5000;

/** Escapes LIKE wildcards so the visitor's text is matched literally. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Ids of rows where any of the given columns contains `q` (case-insensitive, like the column collation). */
export async function idsContaining<T extends Table>(table: T, columns: readonly (typeof SEARCHABLE)[T][number][], q: string): Promise<string[]> {
  const allowed = SEARCHABLE[table] as readonly string[];
  const cols = columns.filter((c) => allowed.includes(c));
  if (cols.length === 0 || !q.trim()) return [];
  const where = cols.map((c) => `\`${c}\` LIKE CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci`).join(" OR ");
  const rows = await db().$queryRawUnsafe<{ id: string }[]>(`SELECT \`id\` FROM \`${table}\` WHERE ${where} LIMIT ${MAX_MATCHES}`, ...cols.map(() => likePattern(q.trim())));
  return rows.map((r) => r.id);
}

/** Image types the Media library accepts (uploads are checked and re-encoded to these). */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
