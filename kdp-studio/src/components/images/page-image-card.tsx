"use client";

/* eslint-disable @next/next/no-img-element */

import type { PageDto } from "@/lib/types";

export const GEN_STATUS_META: Record<string, { label: string; cls: string }> = {
  planned: { label: "Planned", cls: "bg-stone-100 text-stone-600" },
  queued: { label: "Queued", cls: "bg-amber-100 text-amber-800" },
  generating: { label: "Generating…", cls: "bg-blue-100 text-blue-800" },
  ready_for_review: { label: "Ready for review", cls: "bg-violet-100 text-violet-800" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  needs_review: { label: "Needs review", cls: "bg-orange-100 text-orange-800" },
};

export function PageImageCard({
  page,
  selected,
  busy,
  canGenerate,
  onToggleSelect,
  onView,
  onGenerate,
  onApprove,
}: {
  page: PageDto;
  selected: boolean;
  busy: boolean;
  canGenerate: boolean;
  onToggleSelect: (id: string) => void;
  onView: (id: string) => void;
  onGenerate: (id: string) => void;
  onApprove: (id: string) => void;
}) {
  const meta = GEN_STATUS_META[page.generationStatus] ?? GEN_STATUS_META.planned;
  const isWorking =
    page.generationStatus === "generating" || page.generationStatus === "queued";
  const hasImage = !!page.processedImage;

  const smallBtn =
    "rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        selected ? "border-stone-900 ring-2 ring-stone-900/20" : "border-stone-200"
      }`}
    >
      <button
        type="button"
        onClick={() => (hasImage ? onView(page.id) : undefined)}
        className="relative block aspect-[8.5/11] w-full bg-stone-50"
        title={hasImage ? "View full size" : undefined}
      >
        {hasImage ? (
          <img
            src={page.processedImage!}
            alt={`Page ${page.pageNumber}: ${page.title}`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-stone-400">
            {isWorking ? (
              <span className="flex flex-col items-center gap-2">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
                {meta.label}
              </span>
            ) : (
              "No image yet"
            )}
          </span>
        )}
        {hasImage && isWorking && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 border-t border-stone-100 p-3">
        <div className="flex items-start justify-between gap-2">
          <label className="flex min-w-0 items-start gap-2 text-sm font-medium text-stone-800">
            <input
              type="checkbox"
              className="mt-1 h-3.5 w-3.5 accent-stone-900"
              checked={selected}
              onChange={() => onToggleSelect(page.id)}
            />
            <span className="truncate" title={page.title}>
              {page.pageNumber}. {page.title}
            </span>
          </label>
          <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
            {meta.label}
          </span>
        </div>
        {page.generationStatus === "failed" && page.validationIssues && (
          <p className="line-clamp-2 text-xs text-red-600" title={page.validationIssues}>
            {page.validationIssues}
          </p>
        )}
        {page.generationStatus === "needs_review" && page.validationIssues && (
          <p className="line-clamp-2 text-xs text-orange-600" title={page.validationIssues}>
            {page.validationIssues.split("\n")[0]}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-1.5">
          <button
            type="button"
            className={smallBtn}
            disabled={!hasImage}
            onClick={() => onView(page.id)}
          >
            View
          </button>
          <button
            type="button"
            className={smallBtn}
            disabled={busy || isWorking || !canGenerate}
            onClick={() => onGenerate(page.id)}
          >
            {hasImage ? "Regenerate" : "Generate"}
          </button>
          {page.approvalStatus !== "approved" ? (
            <button
              type="button"
              className={`${smallBtn} text-emerald-700 hover:bg-emerald-50`}
              disabled={!hasImage || isWorking}
              onClick={() => onApprove(page.id)}
            >
              Approve
            </button>
          ) : (
            <span className="px-2 py-1 text-xs font-semibold text-emerald-700">✓</span>
          )}
        </div>
      </div>
    </div>
  );
}
