"use client";

// Images screen: responsive card grid plus the client-driven generation
// queue. Each page is ONE independent API request; the queue bounds
// concurrency (MAX_CONCURRENT_GENERATIONS), supports pause/resume, retry
// of failures, and per-page/selected regeneration. A failed page never
// stops the batch.

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  MAX_CONCURRENT_GENERATIONS,
  MAX_GENERATION_RETRIES,
} from "@/lib/config/kdp-spec";
import type { ApiResponse, PageDto, ProjectDto } from "@/lib/types";
import { Button, EmptyState, ProgressBar } from "@/components/ui";
import { PageImageCard } from "@/components/images/page-image-card";
import { PageViewModal } from "@/components/images/page-view-modal";

export function ImagesScreen({
  project,
  initialPages,
  provider,
  planApproved,
}: {
  project: ProjectDto;
  initialPages: PageDto[];
  provider: { name: string; isSample: boolean };
  planApproved: boolean;
}) {
  const [pages, setPages] = useState<PageDto[]>(initialPages);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue internals live in refs so pump() never sees stale state.
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef<Set<string>>(new Set());
  const pausedRef = useRef(false);
  const retriesRef = useRef<Map<string, number>>(new Map());

  const setPageStatus = useCallback((id: string, status: PageDto["generationStatus"]) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, generationStatus: status } : p)),
    );
  }, []);

  const replacePage = useCallback((updated: PageDto) => {
    setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  // Plain hoisted functions: they only touch refs and stable setters, so
  // memoization is unnecessary and self/mutual reference stays legal.
  function pump() {
    while (
      !pausedRef.current &&
      activeRef.current.size < MAX_CONCURRENT_GENERATIONS &&
      queueRef.current.length > 0
    ) {
      const id = queueRef.current.shift()!;
      if (activeRef.current.has(id)) continue;
      activeRef.current.add(id);
      setPageStatus(id, "generating");

      fetch(`/api/pages/${id}/generate`, { method: "POST" })
        .then(async (res) => {
          const json: ApiResponse<PageDto> = await res.json();
          if (json.ok) {
            replacePage(json.data);
            // Auto-retry transient failures a limited number of times.
            if (json.data.generationStatus === "failed") {
              const tries = retriesRef.current.get(id) ?? 0;
              if (tries < MAX_GENERATION_RETRIES) {
                retriesRef.current.set(id, tries + 1);
                queueRef.current.push(id);
              }
            } else {
              retriesRef.current.delete(id);
            }
          } else {
            setPageStatus(id, "failed");
            setError(json.error);
          }
        })
        .catch(() => {
          setPageStatus(id, "failed");
          setError("Network error while generating — use Retry failed to continue.");
        })
        .finally(() => {
          activeRef.current.delete(id);
          pump();
        });
    }
  }

  function enqueue(ids: string[]) {
    setError(null);
    const queued = new Set([...queueRef.current, ...activeRef.current]);
    const fresh = ids.filter((id) => !queued.has(id));
    for (const id of fresh) {
      retriesRef.current.delete(id);
      queueRef.current.push(id);
      setPageStatus(id, "queued");
    }
    pump();
  }

  const pause = () => {
    pausedRef.current = true;
    setPaused(true);
  };
  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    pump();
  };

  const pendingIds = pages
    .filter((p) => !p.processedImage && ["planned", "failed"].includes(p.generationStatus))
    .map((p) => p.id);
  const failedIds = pages
    .filter((p) => p.generationStatus === "failed")
    .map((p) => p.id);
  const generatedCount = pages.filter((p) => p.processedImage).length;
  const approvedCount = pages.filter((p) => p.approvalStatus === "approved").length;
  const workingCount = pages.filter((p) =>
    ["queued", "generating"].includes(p.generationStatus),
  ).length;

  const approvePage = async (id: string) => {
    try {
      const res = await fetch(`/api/pages/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const json: ApiResponse<PageDto> = await res.json();
      if (json.ok) replacePage(json.data);
      else setError(json.error);
    } catch {
      setError("Network error while approving");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (pages.length === 0) {
    return (
      <EmptyState
        title="No pages to generate"
        description="Generate and approve a book plan first — images are created from the plan's page prompts."
        action={
          <Link
            href={`/projects/${project.id}/plan`}
            className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700"
          >
            Go to Book Plan
          </Link>
        }
      />
    );
  }

  const viewPage = viewId ? (pages.find((p) => p.id === viewId) ?? null) : null;

  return (
    <div className="space-y-4">
      {provider.isSample && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No image API key is configured, so pages use the built-in{" "}
          <strong>placeholder renderer</strong> — clearly-marked sample line art
          that exercises the whole pipeline. Add <code>OPENAI_API_KEY</code> to
          the app&apos;s environment to generate real artwork.
        </p>
      )}
      {!planApproved && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          The book plan hasn&apos;t been approved yet.{" "}
          <Link href={`/projects/${project.id}/plan`} className="font-semibold underline">
            Review and approve the plan
          </Link>{" "}
          to enable image generation.
        </p>
      )}

      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-stone-800">
            {generatedCount} / {pages.length} generated
            <span className="ml-3 font-normal text-stone-500">
              {approvedCount} approved
            </span>
            {workingCount > 0 && (
              <span className="ml-3 font-normal text-blue-700">
                {workingCount} in progress
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => enqueue(pendingIds)}
              disabled={!planApproved || pendingIds.length === 0}
            >
              Generate {pendingIds.length > 0 ? `${pendingIds.length} remaining` : "images"}
            </Button>
            {workingCount > 0 &&
              (paused ? (
                <Button variant="secondary" onClick={resume}>
                  ▶ Resume
                </Button>
              ) : (
                <Button variant="secondary" onClick={pause}>
                  ⏸ Pause
                </Button>
              ))}
            {failedIds.length > 0 && (
              <Button variant="secondary" onClick={() => enqueue(failedIds)} disabled={!planApproved}>
                Retry {failedIds.length} failed
              </Button>
            )}
            {selected.size > 0 && (
              <Button
                variant="secondary"
                disabled={!planApproved}
                onClick={() => {
                  enqueue([...selected]);
                  setSelected(new Set());
                }}
              >
                Regenerate {selected.size} selected
              </Button>
            )}
          </div>
        </div>
        <ProgressBar value={generatedCount} max={pages.length} />
        {paused && workingCount > 0 && (
          <p className="text-xs text-stone-500">
            Paused — pages already in flight will finish, nothing new starts.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {pages.map((page) => (
          <PageImageCard
            key={page.id}
            page={page}
            selected={selected.has(page.id)}
            busy={false}
            canGenerate={planApproved}
            onToggleSelect={toggleSelect}
            onView={setViewId}
            onGenerate={(id) => enqueue([id])}
            onApprove={approvePage}
            onPageUpdate={replacePage}
          />
        ))}
      </div>

      {viewPage && (
        <PageViewModal
          key={viewPage.id}
          page={viewPage}
          canGenerate={planApproved}
          onClose={() => setViewId(null)}
          onPageUpdate={replacePage}
          onGenerate={(id) => enqueue([id])}
          onDelete={async (id) => {
            const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
            const json: ApiResponse<{ deleted: true }> = await res.json();
            if (!json.ok) throw new Error(json.error);
            setPages((prev) =>
              prev
                .filter((p) => p.id !== id)
                .map((p, i) => ({ ...p, pageNumber: i + 1 })),
            );
          }}
        />
      )}
    </div>
  );
}
