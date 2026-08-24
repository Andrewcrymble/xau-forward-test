"use client";

// Settings → Storage: shows current usage and offers a one-tap cleanup that
// prunes superseded PDF/ZIP builds and deletes files no longer referenced by
// any project (deleted books, deleted pages, replaced artwork).

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { ApiResponse } from "@/lib/types";
import type { CleanupResult } from "@/lib/services/maintenance-service";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function StorageCard() {
  const [usage, setUsage] = useState<{ totalFiles: number; totalBytes: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/maintenance/storage")
      .then((r) => r.json())
      .then((j: ApiResponse<{ totalFiles: number; totalBytes: number }>) => {
        if (j.ok) setUsage(j.data);
      })
      .catch(() => {});
  }, []);

  const cleanup = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/maintenance/storage", { method: "POST" });
      const json: ApiResponse<CleanupResult> = await res.json();
      if (!json.ok) throw new Error(json.error);
      setResult(json.data);
      setUsage({ totalFiles: json.data.totalFiles, totalBytes: json.data.totalBytes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold text-stone-900">Storage</h2>
      <p className="text-sm text-stone-600">
        {usage
          ? `Currently storing ${usage.totalFiles} files (${fmtBytes(usage.totalBytes)}).`
          : "Measuring storage usage…"}{" "}
        Free up space removes superseded PDF/ZIP builds and files left behind
        by deleted books and pages. Current artwork, approved images and their
        version history are never touched.
      </p>
      <Button onClick={cleanup} disabled={running}>
        {running ? "Cleaning up…" : "Free up storage"}
      </Button>
      {result && (
        <p className="text-sm text-emerald-700">
          Freed {fmtBytes(result.bytesFreed)} — deleted {result.filesDeleted} orphaned files and{" "}
          {result.exportsPruned} old builds. Now using {fmtBytes(result.totalBytes)}.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-stone-400">
        Hosted storage (Vercel Blob) has a 1 GB limit on the free plan. If
        cleanup does not free enough, delete finished projects you no longer
        need, or upgrade the Blob store in your Vercel dashboard.
      </p>
    </Card>
  );
}
