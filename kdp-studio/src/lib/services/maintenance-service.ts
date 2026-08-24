import { prisma } from "@/lib/db";
import { getImageStorage } from "@/lib/storage";

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
    select: { originalImage: true, processedImage: true, completedReference: true, cbnData: true },
  });
  for (const p of pages) {
    add(p.originalImage);
    add(p.processedImage);
    add(p.completedReference);
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

/** Current storage usage summary. */
export async function storageUsage(): Promise<{ totalFiles: number; totalBytes: number }> {
  const stored = await getImageStorage().list("projects/");
  return {
    totalFiles: stored.length,
    totalBytes: stored.reduce((s, f) => s + f.sizeBytes, 0),
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
