"use client";

// Settings → Storage: shows current usage and offers a one-tap cleanup that
// prunes superseded PDF/ZIP builds and deletes files no longer referenced by
// any project (deleted books, deleted pages, replaced artwork).

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { ApiResponse } from "@/lib/types";
import type {
  CleanupResult,
  MigrateResult,
  RecompressResult,
} from "@/lib/services/maintenance-service";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

interface Usage {
  backend: string;
  totalFiles: number;
  totalBytes: number;
  foreignFiles: number;
}

const BACKEND_LABELS: Record<string, string> = {
  local: "Local disk (development)",
  "vercel-blob": "Vercel Blob (1 GB free)",
  "cloudflare-r2": "Cloudflare R2 (10 GB free)",
};

export function StorageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<MigrateResult | null>(null);

  const refreshUsage = () =>
    fetch("/api/maintenance/storage")
      .then((r) => r.json())
      .then((j: ApiResponse<Usage>) => {
        if (j.ok) setUsage(j.data);
      })
      .catch(() => {});

  useEffect(() => {
    refreshUsage();
  }, []);

  const migrate = async () => {
    setMigrating(true);
    setError(null);
    setMigrateResult(null);
    try {
      const res = await fetch("/api/maintenance/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "migrate" }),
      });
      const json: ApiResponse<MigrateResult> = await res.json();
      if (!json.ok) throw new Error(json.error);
      setMigrateResult(json.data);
      await refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  const [compressing, setCompressing] = useState(false);
  const [compressResult, setCompressResult] = useState<RecompressResult | null>(null);

  const cleanup = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/maintenance/storage", { method: "POST" });
      const json: ApiResponse<CleanupResult> = await res.json();
      if (!json.ok) throw new Error(json.error);
      setResult(json.data);
      await refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setRunning(false);
    }
  };

  const recompress = async () => {
    setCompressing(true);
    setError(null);
    setCompressResult(null);
    try {
      const res = await fetch("/api/maintenance/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recompress" }),
      });
      const json: ApiResponse<RecompressResult> = await res.json();
      if (!json.ok) throw new Error(json.error);
      setCompressResult(json.data);
      await refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compression failed");
    } finally {
      setCompressing(false);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold text-stone-900">Storage</h2>
      <p className="text-sm text-stone-600">
        {usage
          ? `Backend: ${BACKEND_LABELS[usage.backend] ?? usage.backend} — storing ${usage.totalFiles} files (${fmtBytes(usage.totalBytes)}).`
          : "Measuring storage usage…"}{" "}
        Free up space removes superseded PDF/ZIP builds and files left behind
        by deleted books and pages. Current artwork, approved images and their
        version history are never touched.
      </p>
      {usage && usage.foreignFiles > 0 && (
        <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <p className="text-sm text-sky-900">
            <strong>{usage.foreignFiles} files</strong> still live on the
            previous storage backend. Migrate them to move everything onto{" "}
            {BACKEND_LABELS[usage.backend] ?? usage.backend} and free the old
            quota (links update automatically; nothing is lost).
          </p>
          <Button onClick={migrate} disabled={migrating || running}>
            {migrating ? "Migrating…" : "Migrate files to current storage"}
          </Button>
        </div>
      )}
      {migrateResult && (
        <p className="text-sm text-emerald-700">
          Moved {migrateResult.migrated} files ({fmtBytes(migrateResult.bytesMoved)}) to{" "}
          {BACKEND_LABELS[migrateResult.backend] ?? migrateResult.backend}.
          {migrateResult.failed > 0 && ` ${migrateResult.failed} failed — run again to retry.`}
          {migrateResult.remaining > 0 && (
            <span className="block font-semibold">
              {migrateResult.remaining} files still to move — tap migrate again to continue.
            </span>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={cleanup} disabled={running || compressing}>
          {running ? "Cleaning up…" : "Free up storage"}
        </Button>
        <Button variant="secondary" onClick={recompress} disabled={running || compressing}>
          {compressing ? "Compressing…" : "Compress existing images"}
        </Button>
      </div>
      {result && (
        <p className="text-sm text-emerald-700">
          Freed {fmtBytes(result.bytesFreed)} — deleted {result.filesDeleted} orphaned files and{" "}
          {result.exportsPruned} old builds. Now using {fmtBytes(result.totalBytes)}.
        </p>
      )}
      {compressResult && (
        <p className="text-sm text-emerald-700">
          Recompressed {compressResult.shrunk} of {compressResult.processed} images, saving{" "}
          {fmtBytes(compressResult.bytesSaved)}. Now using {fmtBytes(compressResult.totalBytes)}.
          {compressResult.remaining > 0 && (
            <span className="block font-semibold">
              {compressResult.remaining} images still to process — tap
              &quot;Compress existing images&quot; again to continue.
            </span>
          )}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-stone-500">
        &quot;Compress existing images&quot; shrinks artwork saved before
        compressed storage shipped (typically 60-80% smaller, no visible
        quality change, same links). Large libraries take a few runs.
      </p>
      <p className="text-xs text-stone-400">
        Hosted storage (Vercel Blob) has a 1 GB limit on the free plan. If
        cleanup does not free enough, delete finished projects you no longer
        need, or upgrade the Blob store in your Vercel dashboard.
      </p>
    </Card>
  );
}
