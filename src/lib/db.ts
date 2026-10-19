import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Works with both MySQL and MariaDB servers (e.g. Hostinger/cPanel databases).
  const adapter = new PrismaMariaDb(serverEnv().DATABASE_URL);
  return new PrismaClient({ adapter });
}

/** Shared Prisma client; reused across hot reloads in development. */
export function db(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}
