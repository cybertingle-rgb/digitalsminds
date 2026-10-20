import "server-only";
import { db } from "@/lib/db";

/**
 * Database backup as a plain SQL file (like mysqldump), so it can be restored
 * with phpMyAdmin → Import on Hostinger, or `mysql < file.sql` anywhere.
 *
 * Login sessions, one-time tokens and rate-limit counters are left out (only
 * their empty tables are recreated): restoring signs everyone out, and no
 * live session or reset link ever sits in a backup file.
 */

const STRUCTURE_ONLY = new Set(["Session", "Verification", "RateLimit"]);
const BATCH = 500;

type Row = Record<string, unknown>;

const ident = (name: string) => "`" + name.replace(/`/g, "``") + "`";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** DATETIME(3) literal in UTC (Prisma stores UTC). */
function sqlDate(d: Date) {
  return `'${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}'`;
}

/** MySQL string literal (default SQL mode, backslash escapes on). */
export function sqlString(s: string) {
  return (
    "'" +
    s.replace(/[\0\n\r\x1a'"\\]/g, (c) => ({ "\0": "\\0", "\n": "\\n", "\r": "\\r", "\x1a": "\\Z", "'": "\\'", '"': '\\"', "\\": "\\\\" })[c]!) +
    "'"
  );
}

export function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("Cannot back up a non-finite number");
    return String(v);
  }
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return sqlDate(v);
  if (v instanceof Uint8Array) return v.length ? `X'${Buffer.from(v).toString("hex")}'` : "''";
  if (typeof v === "string") return sqlString(v);
  // JSON columns, and Decimal-like objects that print themselves.
  if (typeof v === "object" && v !== null && "toFixed" in v) return String(v);
  return sqlString(JSON.stringify(v));
}

async function tables(): Promise<string[]> {
  const rows = await db().$queryRawUnsafe<Row[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  return rows.map((r) => String(Object.values(r)[0])).sort();
}

async function createStatement(table: string): Promise<string> {
  const [row] = await db().$queryRawUnsafe<Row[]>(`SHOW CREATE TABLE ${ident(table)}`);
  return String(row?.["Create Table"] ?? Object.values(row ?? {})[1]);
}

async function primaryKey(table: string): Promise<string[]> {
  const rows = await db().$queryRawUnsafe<Row[]>(`SHOW KEYS FROM ${ident(table)} WHERE Key_name = 'PRIMARY'`);
  return rows.sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index)).map((r) => String(r.Column_name));
}

async function columns(table: string): Promise<string[]> {
  const rows = await db().$queryRawUnsafe<Row[]>(`SHOW COLUMNS FROM ${ident(table)}`);
  return rows.map((r) => String(r.Field));
}

/** Streams the SQL text, table by table, in batches (memory stays small). */
export async function* sqlDump(meta: { createdAt: Date; site: string }): AsyncGenerator<string> {
  yield [
    `-- Digitals Minds database backup`,
    `-- Site: ${meta.site.replace(/[\r\n]/g, "")}`,
    `-- Created (UTC): ${meta.createdAt.toISOString()}`,
    `-- Restore: phpMyAdmin → select the (empty) database → Import → this file. Or: gunzip -c file.sql.gz | mysql -u USER -p DATABASE`,
    `-- Login sessions and one-time links are not included; everyone signs in again after a restore.`,
    "",
    "SET NAMES utf8mb4;",
    "SET time_zone = '+00:00';",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "SET UNIQUE_CHECKS = 0;",
    "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
    "",
  ].join("\n");

  for (const table of await tables()) {
    yield `\n-- Table ${table}\nDROP TABLE IF EXISTS ${ident(table)};\n${await createStatement(table)};\n`;
    if (STRUCTURE_ONLY.has(table)) continue;
    const cols = await columns(table);
    const pk = await primaryKey(table);
    const order = (pk.length ? pk : cols).map(ident).join(", ");
    const colList = cols.map(ident).join(", ");
    for (let offset = 0; ; offset += BATCH) {
      const rows = await db().$queryRawUnsafe<Row[]>(`SELECT ${colList} FROM ${ident(table)} ORDER BY ${order} LIMIT ${BATCH} OFFSET ${offset}`);
      if (rows.length === 0) break;
      const values = rows.map((r) => "(" + cols.map((c) => sqlValue(r[c])).join(",") + ")").join(",\n");
      yield `INSERT INTO ${ident(table)} (${colList}) VALUES\n${values};\n`;
      if (rows.length < BATCH) break;
    }
  }

  yield "\nSET FOREIGN_KEY_CHECKS = 1;\nSET UNIQUE_CHECKS = 1;\n-- End of backup\n";
}
