#!/usr/bin/env node
// Runs `prisma db push` against the DIRECT database endpoint.
//
// Neon (and similar providers) hand out pooled connection strings
// ("-pooler" in the hostname) that are right for the app at runtime but
// unsuitable for schema DDL. This derives the direct URL from DATABASE_URL
// so deploys work no matter which variant was configured.

import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const directUrl = url.replace("-pooler.", ".");
if (directUrl !== url) {
  console.log("Using direct (non-pooled) database endpoint for schema push.");
}

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: directUrl },
  },
);
process.exit(result.status ?? 1);
