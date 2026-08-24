"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import type { ApiResponse, PageDto } from "@/lib/types";
import type { VersionDto } from "@/lib/services/image-service";
import { Button, TextArea } from "@/components/ui";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export function PageViewModal({
  page,
  canGenerate,
  onClose,
  onPageUpdate,
  onGenerate,
  onDelete,
}: {
  page: PageDto;
  canGenerate: boolean;
  onClose: () => void;
  onPageUpdate: (page: PageDto) => void;
  onGenerate: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [versions, setVersions] = useState<VersionDto[] | null>(null);
  const [prompt, setPrompt] = useState(page.prompt);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    api<VersionDto[]>(`/api/pages/${page.id}/versions`)
      .then(setVersions)
      .catch(() => setVersions([]));
  }, [page.id, page.processedImage]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const review = (action: "approve" | "unapprove" | "reject") =>
    act(async () => {
      const updated = await api<PageDto>(`/api/pages/${page.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      onPageUpdate(updated);
    });

  const savePrompt = () =>
    act(async () => {
      const updated = await api<PageDto>(`/api/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({ prompt }),
      });
      onPageUpdate(updated);
    });

  const select = (versionId: string) =>
    act(async () => {
      const updated = await api<PageDto>(
        `/api/pages/${page.id}/versions/${versionId}/select`,
        { method: "POST" },
      );
      onPageUpdate(updated);
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 className="min-w-0 truncate text-sm font-semibold text-stone-900">
            Page {page.pageNumber} — {page.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
          >
            ✕ Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-2">
            {page.processedImage ? (
              <img
                src={page.processedImage}
                alt={`Page ${page.pageNumber}`}
                className="mx-auto max-h-[60vh] w-auto object-contain"
              />
            ) : (
              <p className="p-10 text-center text-sm text-stone-400">No image yet</p>
            )}
          </div>

          <div className="space-y-4">
            {page.pageType === "colour_by_numbers" && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <p className="text-xs font-semibold text-sky-800">
                  Colour by Numbers
                  {page.cbnData
                    ? ` — ${page.cbnData.regions.length} regions, ${page.cbnData.palette.length} colours`
                    : ""}
                </p>
                {page.cbnData && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {page.cbnData.palette.map((p) => (
                      <span
                        key={p.number}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-stone-700"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-stone-300"
                          style={{ background: p.hex }}
                        />
                        {p.number} = {p.name}
                      </span>
                    ))}
                  </div>
                )}
                {page.completedReference && (
                  <a
                    href={page.completedReference}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block"
                    title="Open the completed reference full size"
                  >
                    <img
                      src={page.completedReference}
                      alt="Completed colour reference"
                      className="max-h-40 w-auto rounded-lg border border-stone-200"
                    />
                    <span className="mt-1 block text-[11px] text-sky-700 underline">
                      Completed reference — matches the numbered page exactly
                    </span>
                  </a>
                )}
              </div>
            )}
            {page.validationIssues && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                <p className="text-xs font-semibold text-orange-800">
                  Automatic quality checks
                </p>
                <ul className="mt-1 list-disc pl-4 text-xs text-orange-700">
                  {page.validationIssues.split("\n").map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {page.approvalStatus !== "approved" ? (
                <Button
                  disabled={busy || !page.processedImage}
                  onClick={() => review("approve")}
                >
                  Approve
                </Button>
              ) : (
                <Button variant="secondary" disabled={busy} onClick={() => review("unapprove")}>
                  Un-approve
                </Button>
              )}
              {page.approvalStatus !== "rejected" && page.approvalStatus !== "approved" && (
                <Button variant="danger" disabled={busy} onClick={() => review("reject")}>
                  Reject
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy || !canGenerate}
                onClick={() => {
                  onGenerate(page.id);
                  onClose();
                }}
              >
                Regenerate
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    if (
                      !window.confirm(
                        `Delete page ${page.pageNumber} — "${page.title}"?\n\nThis removes the page, its prompt and all image versions. Later pages move up to fill the gap.`,
                      )
                    ) {
                      return;
                    }
                    await onDelete(page.id);
                    onClose();
                  })
                }
              >
                Delete page
              </Button>
            </div>
            {page.approvalStatus === "approved" && (
              <p className="text-xs text-emerald-700">
                Approved — regenerating keeps this artwork current; new versions
                appear below for comparison.
              </p>
            )}

            <div>
              <button
                type="button"
                className="text-xs font-semibold text-stone-600 underline-offset-2 hover:underline"
                onClick={() => setShowPrompt((v) => !v)}
              >
                {showPrompt ? "Hide prompt" : "Edit prompt"}
              </button>
              {showPrompt && (
                <div className="mt-2 space-y-2">
                  <TextArea
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={busy || prompt === page.prompt}
                    onClick={savePrompt}
                  >
                    Save prompt
                  </Button>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Versions
              </p>
              {versions === null ? (
                <p className="text-xs text-stone-400">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="text-xs text-stone-400">No versions yet</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={busy || v.isCurrent || !v.processedImage}
                      onClick={() => select(v.id)}
                      className={`rounded-lg border p-1 text-left ${
                        v.isCurrent
                          ? "border-stone-900 ring-1 ring-stone-900"
                          : "border-stone-200 hover:border-stone-400"
                      }`}
                      title={
                        v.isCurrent ? "Current version" : "Use this version"
                      }
                    >
                      {v.processedImage && (
                        <img
                          src={v.processedImage}
                          alt={`Version ${v.versionNumber}`}
                          className="aspect-[8.5/11] w-full object-contain"
                          loading="lazy"
                        />
                      )}
                      <span className="block px-1 pt-1 text-[11px] font-medium text-stone-600">
                        v{v.versionNumber}
                        {v.isCurrent && " · current"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
