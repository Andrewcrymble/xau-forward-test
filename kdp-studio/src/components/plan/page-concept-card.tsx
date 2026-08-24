"use client";

import { useEffect, useRef, useState } from "react";
import type { PageDto } from "@/lib/types";
import { TextArea, TextInput } from "@/components/ui";

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-stone-100 text-stone-600",
  queued: "bg-amber-100 text-amber-800",
  generating: "bg-blue-100 text-blue-800",
  ready_for_review: "bg-violet-100 text-violet-800",
  approved: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-700",
  needs_review: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  queued: "Queued",
  generating: "Generating",
  ready_for_review: "Ready for review",
  approved: "Approved",
  failed: "Failed",
  needs_review: "Needs review",
};

export function PageConceptCard({
  page,
  isFirst,
  isLast,
  busy,
  onEdit,
  onMove,
  onReplace,
  onDelete,
  onDuplicate,
  onConvert,
}: {
  page: PageDto;
  isFirst: boolean;
  isLast: boolean;
  /** Blocks actions while a list-level operation is in flight. */
  busy: boolean;
  onEdit: (
    pageId: string,
    patch: { title?: string; concept?: string; prompt?: string },
  ) => Promise<void>;
  onMove: (pageId: string, direction: -1 | 1) => void;
  onReplace: (pageId: string) => Promise<void>;
  onDelete: (pageId: string) => Promise<void>;
  onDuplicate: (pageId: string) => Promise<void>;
  onConvert: (pageId: string, pageType: "standard" | "colour_by_numbers") => Promise<void>;
}) {
  const [title, setTitle] = useState(page.title);
  const [concept, setConcept] = useState(page.concept);
  const [prompt, setPrompt] = useState(page.prompt);
  const [showPrompt, setShowPrompt] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync local state when the server row changes (replace, regenerate).
  const lastServer = useRef({ title: page.title, concept: page.concept, prompt: page.prompt });
  useEffect(() => {
    if (
      page.title !== lastServer.current.title ||
      page.concept !== lastServer.current.concept ||
      page.prompt !== lastServer.current.prompt
    ) {
      lastServer.current = { title: page.title, concept: page.concept, prompt: page.prompt };
      setTitle(page.title);
      setConcept(page.concept);
      setPrompt(page.prompt);
    }
  }, [page.title, page.concept, page.prompt]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (patch: { title?: string; concept?: string; prompt?: string }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onEdit(page.id, patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800);
  };
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const handleReplace = async () => {
    setReplacing(true);
    try {
      await onReplace(page.id);
    } finally {
      setReplacing(false);
    }
  };

  const actionBtn =
    "rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-stone-900 text-sm font-bold text-white">
          {page.pageNumber}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <TextInput
              value={title}
              aria-label={`Page ${page.pageNumber} title`}
              onChange={(e) => {
                setTitle(e.target.value);
                queueSave({ title: e.target.value });
              }}
            />
            {page.pageType === "colour_by_numbers" && (
              <span className="flex-none rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                Colour by Numbers
              </span>
            )}
            <span
              className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[page.generationStatus] ?? STATUS_STYLES.planned}`}
            >
              {STATUS_LABELS[page.generationStatus] ?? page.generationStatus}
            </span>
          </div>
          {page.pageText && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Text in artwork:</span> {page.pageText}
              <span className="mt-0.5 block text-[10px] text-amber-700">
                Verify wording and reference before publishing.
              </span>
            </p>
          )}
          <TextArea
            value={concept}
            aria-label={`Page ${page.pageNumber} concept`}
            onChange={(e) => {
              setConcept(e.target.value);
              queueSave({ concept: e.target.value });
            }}
          />
          {showPrompt && (
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs text-stone-500">
                <span className="font-semibold uppercase tracking-wide">Image prompt</span>
                {page.promptEdited ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                    manually edited
                  </span>
                ) : (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5">
                    auto-built from concept + master rules
                  </span>
                )}
              </div>
              <TextArea
                value={prompt}
                rows={7}
                aria-label={`Page ${page.pageNumber} prompt`}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  queueSave({ prompt: e.target.value });
                }}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={actionBtn}
              disabled={busy || isFirst}
              onClick={() => onMove(page.id, -1)}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className={actionBtn}
              disabled={busy || isLast}
              onClick={() => onMove(page.id, 1)}
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className={actionBtn}
              onClick={() => setShowPrompt((v) => !v)}
            >
              {showPrompt ? "Hide prompt" : "Edit prompt"}
            </button>
            <button
              type="button"
              className={actionBtn}
              disabled={busy || replacing}
              onClick={handleReplace}
            >
              {replacing ? "Replacing…" : "Replace concept"}
            </button>
            <button
              type="button"
              className={actionBtn}
              disabled={busy}
              onClick={() => onDuplicate(page.id)}
            >
              Duplicate
            </button>
            <button
              type="button"
              className={actionBtn}
              disabled={busy || page.approvalStatus === "approved"}
              title={
                page.approvalStatus === "approved"
                  ? "Un-approve the page before converting its type"
                  : undefined
              }
              onClick={() =>
                onConvert(
                  page.id,
                  page.pageType === "colour_by_numbers" ? "standard" : "colour_by_numbers",
                )
              }
            >
              {page.pageType === "colour_by_numbers"
                ? "Convert to standard"
                : "Convert to colour by numbers"}
            </button>
            <button
              type="button"
              className={`${actionBtn} text-red-600 hover:bg-red-50`}
              disabled={busy}
              onClick={() => onDelete(page.id)}
            >
              Delete
            </button>
            {saved && <span className="text-xs text-emerald-600">Saved</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
