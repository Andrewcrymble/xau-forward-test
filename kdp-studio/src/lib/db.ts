import { PrismaClient } from "@prisma/client";

// Prisma client singleton — avoids exhausting connections during Next.js
// dev-server hot reloads.
//
// When DATABASE_URL points at a PgBouncer-style pooled endpoint (e.g. a
// Neon "-pooler" host), Prisma must disable prepared statements; append
// pgbouncer=true automatically so either connection-string variant works.
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (
    url.startsWith("postgres") &&
    url.includes("-pooler.") &&
    !url.includes("pgbouncer=")
  ) {
    return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
