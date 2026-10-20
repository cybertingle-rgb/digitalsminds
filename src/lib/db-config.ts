/**
 * MariaDB driver settings from DATABASE_URL (mysql:// or mariadb://).
 *
 * Every connection starts with SET NAMES so text values and the tables use the
 * same collation (utf8mb4_unicode_ci), whatever the server's defaults are; some
 * hosts (e.g. newer MariaDB on Hostinger) default to a different one, which
 * breaks text comparisons with "Illegal mix of collations".
 */
export const CONNECTION_INIT_SQL = "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci";

export function connectionConfig(databaseUrl: string): Record<string, unknown> {
  const u = new URL(databaseUrl);
  const config: Record<string, unknown> = {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
  // Extra driver options in the URL (e.g. ?connectionLimit=5) keep working.
  for (const [key, value] of u.searchParams) {
    config[key] = /^\d+$/.test(value) ? Number(value) : value === "true" ? true : value === "false" ? false : value;
  }
  config.initSql = CONNECTION_INIT_SQL;
  return config;
}
