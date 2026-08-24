"use client";

// Book Plan screen: generate the full concept list, then review it —
// edit, reorder, replace, delete, add — before approving the plan.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse, PageDto, ProjectDto } from "@/lib/types";
import { Button, Card, EmptyState, TextArea, TextInput } from "@/components/ui";
import { PageConceptCard } from "@/components/plan/page-concept-card";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export function BookPlanEditor({
  project,
  initialPages,
  provider,
}: {
  project: ProjectDto;
  initialPages: PageDto[];
  provider: { name: string; isSample: boolean };
}) {
  const router = useRouter();
  const [pages, setPages] = useState<PageDto[]>(initialPages);
  const [status, setStatus] = useState(project.status);
  const [generating, setGenerating] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newConcept, setNewConcept] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const generate = (isRegenerate: boolean) => {
    if (
      isRegenerate &&
      !window.confirm(
        "Regenerate the whole plan?\n\nAll current concepts and prompts will be replaced with a fresh list. This cannot be undone.",
      )
    ) {
      return;
    }
    run(async () => {
      setGenerating(true);
      try {
        const fresh = await api<PageDto[]>(
          `/api/projects/${project.id}/plan/generate`,
          { method: "POST" },
        );
        setPages(fresh);
        setStatus("planning");
        router.refresh();
      } finally {
        setGenerating(false);
      }
    });
  };

  const editPage = async (
    pageId: string,
    patch: { title?: string; concept?: string; prompt?: string },
  ) => {
    await run(async () => {
      const updated = await api<PageDto>(`/api/pages/${pageId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setPages((prev) => prev.map((p) => (p.id === pageId ? updated : p)));
    });
  };

  const movePage = (pageId: string, direction: -1 | 1) => {
    const index = pages.findIndex((p) => p.id === pageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    // Optimistic renumber for instant feedback; server response is canonical.
    setPages(next.map((p, i) => ({ ...p, pageNumber: i + 1 })));
    run(async () => {
      setReordering(true);
      try {
        const fresh = await api<PageDto[]>(
          `/api/projects/${project.id}/pages/reorder`,
          {
            method: "POST",
            body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
          },
        );
        setPages(fresh);
      } finally {
        setReordering(false);
      }
    });
  };

  const replacePage = async (pageId: string) => {
    await run(async () => {
      const updated = await api<PageDto>(`/api/pages/${pageId}/replace`, {
        method: "POST",
      });
      setPages((prev) => prev.map((p) => (p.id === pageId ? updated : p)));
    });
  };

  const deletePage = async (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (
      !window.confirm(
        `Delete page ${page?.pageNumber} — "${page?.title}"?\n\nThe following pages will move up to fill the gap.`,
      )
    ) {
      return;
    }
    await run(async () => {
      await api<{ deleted: true }>(`/api/pages/${pageId}`, { method: "DELETE" });
      setPages((prev) =>
        prev
          .filter((p) => p.id !== pageId)
          .map((p, i) => ({ ...p, pageNumber: i + 1 })),
      );
    });
  };

  const duplicatePage = async (pageId: string) => {
    await run(async () => {
      await api<PageDto>(`/api/pages/${pageId}/duplicate`, { method: "POST" });
      const fresh = await api<PageDto[]>(`/api/projects/${project.id}/pages`);
      setPages(fresh);
    });
  };

  const convertPage = async (
    pageId: string,
    pageType: "standard" | "colour_by_numbers",
  ) => {
    await run(async () => {
      const updated = await api<PageDto>(`/api/pages/${pageId}/convert`, {
        method: "POST",
        body: JSON.stringify({ pageType }),
      });
      setPages((prev) => prev.map((p) => (p.id === pageId ? updated : p)));
    });
  };

  const addPage = () =>
    run(async () => {
      const page = await api<PageDto>(`/api/projects/${project.id}/pages`, {
        method: "POST",
        body: JSON.stringify({ title: newTitle, concept: newConcept }),
      });
      setPages((prev) => [...prev, page]);
      setNewTitle("");
      setNewConcept("");
      setShowAdd(false);
    });

  const approve = () =>
    run(async () => {
      setApproving(true);
      try {
        await api<{ approved: true }>(`/api/projects/${project.id}/plan/approve`, {
          method: "POST",
        });
        setStatus("plan_approved");
        router.refresh();
      } finally {
        setApproving(false);
      }
    });

  const providerNotice = provider.isSample && (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      No AI provider key is configured, so the plan uses the built-in{" "}
      <strong>sample generator</strong> — placeholder concepts that let you try
      the whole workflow. Add <code>OPENAI_API_KEY</code> to the app&apos;s
      environment to generate real concepts.
    </p>
  );

  const conceptTip = !project.bookConcept && (
    <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Tip: build your <strong>book concept</strong> on the Setup tab first —
      the creative brief and style profile make the plan and artwork far more
      cohesive.
    </p>
  );

  if (pages.length === 0) {
    return (
      <div className="space-y-4">
        {providerNotice}
        {conceptTip}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <EmptyState
          title="No book plan yet"
          description={`Generate ${project.numberOfDesigns} unique page concepts for “${project.niche}”. You'll review and edit every concept before any images are created.`}
          action={
            <Button onClick={() => generate(false)} disabled={generating}>
              {generating ? "Generating plan…" : "Generate Book Plan"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {providerNotice}
      {conceptTip}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-800">
            {pages.length} page concepts
            {status === "plan_approved" && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                Plan approved ✓
              </span>
            )}
          </p>
          <p className="text-xs text-stone-500">
            Review every concept before generating images. Prompts are built
            automatically from each concept plus the master colouring-page rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => generate(true)}
            disabled={generating}
          >
            {generating ? "Regenerating…" : "Regenerate plan"}
          </Button>
          <Button
            onClick={approve}
            disabled={approving || status === "plan_approved"}
          >
            {status === "plan_approved"
              ? "Plan approved"
              : approving
                ? "Approving…"
                : "Approve Plan"}
          </Button>
          <Button
            disabled
            title="Image generation arrives in Phase 3"
            className="opacity-60"
          >
            Generate Images (Phase 3)
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {pages.map((page, i) => (
          <PageConceptCard
            key={page.id}
            page={page}
            isFirst={i === 0}
            isLast={i === pages.length - 1}
            busy={reordering || generating}
            onEdit={editPage}
            onMove={movePage}
            onReplace={replacePage}
            onDelete={deletePage}
            onDuplicate={duplicatePage}
            onConvert={convertPage}
          />
        ))}
      </div>

      {showAdd ? (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-stone-900">New page concept</h3>
          <TextInput
            placeholder="Short title, e.g. Venice — gondolas on the Grand Canal"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <TextArea
            placeholder="Describe the scene: subject, setting, composition…"
            value={newConcept}
            onChange={(e) => setNewConcept(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={addPage} disabled={!newTitle.trim() || !newConcept.trim()}>
              Add page
            </Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setShowAdd(true)}>
          + Add page concept
        </Button>
      )}
    </div>
  );
}
