#!/usr/bin/env node
// Switches the Prisma datasource provider in schema.prisma.
//
// Local development uses SQLite (zero setup); hosted deployments use
// PostgreSQL. The schema itself is written to be compatible with both, so
// the only difference is this one provider line. Vercel builds run
// `node scripts/set-db-provider.mjs postgresql` before prisma generate.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const provider = process.argv[2];
if (!["sqlite", "postgresql"].includes(provider)) {
  console.error("Usage: node scripts/set-db-provider.mjs <sqlite|postgresql>");
  process.exit(1);
}

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "schema.prisma",
);

const schema = readFileSync(schemaPath, "utf8");
const updated = schema.replace(
  /(datasource db \{\s*\n\s*provider\s*=\s*)"(?:sqlite|postgresql)"/,
  `$1"${provider}"`,
);
if (updated === schema && !schema.includes(`"${provider}"`)) {
  console.error("Could not find datasource provider line in schema.prisma");
  process.exit(1);
}
writeFileSync(schemaPath, updated);
console.log(`prisma/schema.prisma datasource provider set to "${provider}"`);
