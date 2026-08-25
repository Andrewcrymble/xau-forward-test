import { prisma } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";
import { VercelBlobStorage } from "@/lib/storage/vercel-blob-storage";

// Storage maintenance — keeps the app inside tight storage quotas (Vercel
// Blob's free tier is 1GB):
//   - pruneOldExports: superseded interior/cover/package builds are deleted,
//     keeping only the newest of each type per project
//   - cleanupStorage: full sweep — prune exports, then delete every stored
//     file that no database row references any more (deleted projects,
//     deleted pages, replaced artwork)

/** Delete all but the newest export of each type for a project. */
export async function pruneOldExports(projectId: string): Promise<number> {
  const storage = getImageStorage();
  const rows = await prisma.export.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const seenTypes = new Set<string>();
  let removed = 0;
  for (const row of rows) {
    if (!seenTypes.has(row.type)) {
      seenTypes.add(row.type);
      continue; // newest of its type — keep
    }
    try {
      await storage.delete(row.filePath);
    } catch {
      // Deleting a missing blob is fine; DB row still goes.
    }
    await prisma.export.delete({ where: { id: row.id } });
    removed++;
  }
  return removed;
}

export interface CleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  exportsPruned: number;
  totalFiles: number;
  totalBytes: number;
}

/** Every URL the database still references — anything else is orphaned. */
async function referencedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();
  const add = (u: string | null | undefined) => {
    if (u) urls.add(u);
  };

  const pages = await prisma.colouringPage.findMany({
    select: { originalImage: true, processedImage: true, completedReference: true, referenceImage: true, cbnData: true },
  });
  for (const p of pages) {
    add(p.originalImage);
    add(p.processedImage);
    add(p.completedReference);
    add(p.referenceImage);
    // CBN data can reference extra rendered images (numbered page, key strip).
    if (p.cbnData) {
      try {
        const data = JSON.parse(p.cbnData) as Record<string, unknown>;
        for (const v of Object.values(data)) {
          if (typeof v === "string" && (v.startsWith("/api/files/") || v.startsWith("http"))) {
            add(v);
          }
        }
      } catch {
        // Unparseable cbnData never blocks cleanup.
      }
    }
  }

  const versions = await prisma.imageVersion.findMany({
    select: { originalImage: true, processedImage: true },
  });
  for (const v of versions) {
    add(v.originalImage);
    add(v.processedImage);
  }

  const covers = await prisma.cover.findMany({
    select: { artwork: true, settings: true },
  });
  for (const c of covers) {
    add(c.artwork);
    try {
      const settings = JSON.parse(c.settings || "{}") as { artworkVersions?: string[] };
      for (const u of settings.artworkVersions ?? []) add(u);
    } catch {
      // ignore
    }
  }

  const exports = await prisma.export.findMany({ select: { filePath: true } });
  for (const e of exports) add(e.filePath);

  return urls;
}

/** Full storage sweep. Returns what was removed and what remains. */
export async function cleanupStorage(): Promise<CleanupResult> {
  const storage = getImageStorage();

  let exportsPruned = 0;
  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const p of projects) {
    exportsPruned += await pruneOldExports(p.id);
  }

  const referenced = await referencedUrls();
  const stored = await storage.list("projects/");

  let filesDeleted = 0;
  let bytesFreed = 0;
  for (const file of stored) {
    if (referenced.has(file.url)) continue;
    try {
      await storage.delete(file.url);
      filesDeleted++;
      bytesFreed += file.sizeBytes;
    } catch {
      // Best-effort: skip files that refuse to delete.
    }
  }

  const remaining = await storage.list("projects/");
  return {
    filesDeleted,
    bytesFreed,
    exportsPruned,
    totalFiles: remaining.length,
    totalBytes: remaining.reduce((s, f) => s + f.sizeBytes, 0),
  };
}

/** Current storage usage summary for the ACTIVE backend. */
export async function storageUsage(): Promise<{
  backend: string;
  totalFiles: number;
  totalBytes: number;
  /** Referenced files still living on another backend (needs migration). */
  foreignFiles: number;
}> {
  const storage = getImageStorage();
  const stored = await storage.list("projects/");
  const referenced = await referencedUrls();
  let foreignFiles = 0;
  for (const url of referenced) {
    if (!storage.ownsUrl(url)) foreignFiles++;
  }
  return {
    backend: storage.name,
    totalFiles: stored.length,
    totalBytes: stored.reduce((s, f) => s + f.sizeBytes, 0),
    foreignFiles,
  };
}

// ---------------------------------------------------------------------------
// Storage migration — move every referenced file onto the active backend
// (e.g. Vercel Blob → Cloudflare R2), rewriting database references and
// best-effort deleting the old copy so the old quota is actually freed.
// ---------------------------------------------------------------------------

export interface MigrateResult {
  migrated: number;
  bytesMoved: number;
  failed: number;
  /** Foreign files still to move — run again while > 0. */
  remaining: number;
  backend: string;
}

const MIGRATE_BUDGET_MS = 220_000;

function contentTypeFor(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

/** Recover the original storage key from a foreign URL. */
function keyFromForeignUrl(url: string): string {
  if (url.startsWith("/api/files/")) return url.slice("/api/files/".length);
  try {
    const path = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
    return path.startsWith("projects/") ? path : `projects/migrated/${path}`;
  } catch {
    return `projects/migrated/${url.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-180)}`;
  }
}

/** Rewrite one old URL to its new location across every table. */
async function rewriteUrl(oldUrl: string, newUrl: string): Promise<void> {
  await prisma.colouringPage.updateMany({
    where: { originalImage: oldUrl },
    data: { originalImage: newUrl },
  });
  await prisma.colouringPage.updateMany({
    where: { processedImage: oldUrl },
    data: { processedImage: newUrl },
  });
  await prisma.colouringPage.updateMany({
    where: { completedReference: oldUrl },
    data: { completedReference: newUrl },
  });
  await prisma.colouringPage.updateMany({
    where: { referenceImage: oldUrl },
    data: { referenceImage: newUrl },
  });
  await prisma.imageVersion.updateMany({
    where: { originalImage: oldUrl },
    data: { originalImage: newUrl },
  });
  await prisma.imageVersion.updateMany({
    where: { processedImage: oldUrl },
    data: { processedImage: newUrl },
  });
  await prisma.export.updateMany({
    where: { filePath: oldUrl },
    data: { filePath: newUrl },
  });
  await prisma.cover.updateMany({
    where: { artwork: oldUrl },
    data: { artwork: newUrl },
  });
  // Cover artwork version lists live inside the settings JSON string.
  const covers = await prisma.cover.findMany({
    where: { settings: { contains: oldUrl } },
    select: { id: true, settings: true },
  });
  for (const c of covers) {
    await prisma.cover.update({
      where: { id: c.id },
      data: { settings: c.settings.split(oldUrl).join(newUrl) },
    });
  }
}

export async function migrateStorage(): Promise<MigrateResult> {
  const storage = getImageStorage();
  const started = Date.now();

  const referenced = await referencedUrls();
  const foreign = [...referenced].filter((url) => !storage.ownsUrl(url));

  // Old copies in Vercel Blob can be deleted once moved (frees that quota).
  const blob = process.env.BLOB_READ_WRITE_TOKEN ? new VercelBlobStorage() : null;

  let migrated = 0;
  let bytesMoved = 0;
  let failed = 0;
  for (const oldUrl of foreign) {
    if (Date.now() - started > MIGRATE_BUDGET_MS) break;
    try {
      const bytes = await storage.readBytes(oldUrl); // handles foreign URLs
      const key = keyFromForeignUrl(oldUrl);
      const newUrl = await storage.put(key, bytes, contentTypeFor(key));
      await rewriteUrl(oldUrl, newUrl);
      migrated++;
      bytesMoved += bytes.length;
      if (blob && blob.ownsUrl(oldUrl)) {
        await blob.delete(oldUrl).catch(() => {});
      }
    } catch {
      failed++;
    }
  }

  return {
    migrated,
    bytesMoved,
    failed,
    remaining: Math.max(0, foreign.length - migrated - failed),
    backend: storage.name,
  };
}

export interface RecompressResult {
  processed: number;
  shrunk: number;
  bytesSaved: number;
  /** PNGs still worth trying — run again while > 0. */
  remaining: number;
  totalBytes: number;
}

/** Anything under this is already small enough to leave alone. */
const RECOMPRESS_MIN_BYTES = 300 * 1024;
/** Stay safely inside the serverless time limit; callers re-run for the rest. */
const RECOMPRESS_BUDGET_MS = 220_000;

/**
 * Re-encode stored page/cover PNGs as palette PNGs at max compression —
 * visually lossless for line art and typically 60-80% smaller. Files keep
 * their key (and therefore their URL), so no database rows change. Books
 * saved before compressed storage shipped are the big win here.
 */
export async function recompressImages(): Promise<RecompressResult> {
  const sharp = (await import("sharp")).default;
  const storage = getImageStorage();
  const started = Date.now();

  const referenced = await referencedUrls();
  const stored = await storage.list("projects/");
  const candidates = stored.filter(
    (f) =>
      f.key.endsWith(".png") &&
      f.sizeBytes >= RECOMPRESS_MIN_BYTES &&
      referenced.has(f.url),
  );

  let processed = 0;
  let shrunk = 0;
  let bytesSaved = 0;
  for (const file of candidates) {
    if (Date.now() - started > RECOMPRESS_BUDGET_MS) break;
    processed++;
    try {
      const bytes = await storage.readBytes(file.url);
      const re = await sharp(bytes)
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      // Only replace on a real saving — re-encoding an already-palette PNG
      // usually lands within a few percent and is not worth a write.
      if (re.length < bytes.length * 0.9) {
        await storage.put(file.key, re, "image/png");
        shrunk++;
        bytesSaved += bytes.length - re.length;
      }
    } catch {
      // A single unreadable file must not stop the sweep.
    }
  }

  const after = await storage.list("projects/");
  return {
    processed,
    shrunk,
    bytesSaved,
    remaining: Math.max(0, candidates.length - processed),
    totalBytes: after.reduce((s, f) => s + f.sizeBytes, 0),
  };
}
