"use client";

// FIND ME A NICHE — turn a broad topic into specific KDP colouring-book
// concepts. Every idea is saved automatically (My Niche Ideas) and every
// score shown here is AI CONCEPT ANALYSIS, never Amazon market data.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse, NicheIdeaDto, NicheStatus } from "@/lib/types";
import type { DuplicateWarning } from "@/lib/services/niche-service";
import { Button, Card, Field, Select, TextInput } from "@/components/ui";
import { NicheCard } from "@/components/niches/niche-card";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

const MARKETS = [
  ["amazon_com", "Amazon.com"],
  ["amazon_co_uk", "Amazon.co.uk"],
  ["both", "Both"],
  ["other", "Other"],
] as const;

const AUDIENCE_CHOICES = [
  ["let_ai_decide", "Let the AI decide"],
  ["Children 4–6", "Children 4–6"],
  ["Children 6–8", "Children 6–8"],
  ["Children 8–12", "Children 8–12"],
  ["Teens", "Teens"],
  ["Adults", "Adults"],
  ["Women", "Women"],
  ["Men", "Men"],
  ["Seniors", "Seniors"],
  ["Families", "Families"],
] as const;

const BOOK_TYPES = [
  ["let_ai_decide", "Let the AI decide"],
  ["standard", "Standard colouring"],
  ["colour_by_numbers", "Colour by numbers"],
  ["mixed", "Mixed"],
  ["educational", "Educational"],
  ["inspirational", "Inspirational / quote"],
  ["scripture", "Scripture colouring"],
] as const;

const SORTS: [string, string][] = [
  ["newest", "Newest first"],
  ["overall", "Best overall"],
  ["specificity", "Most specific"],
  ["giftPotential", "Best gift potential"],
  ["children", "Best for children"],
  ["adults", "Best for adults"],
  ["cbnSuitability", "Best colour by numbers"],
  ["seriesPotential", "Best series potential"],
  ["visualPotential", "Best visual potential"],
];

const STATUS_FILTERS: [NicheStatus | "all", string][] = [
  ["all", "All ideas"],
  ["favourite", "⭐ Favourite"],
  ["considering", "💡 Considering"],
  ["building", "📘 Building"],
  ["book_created", "✅ Book created"],
  ["rejected", "❌ Rejected"],
];

export function NicheFinder({ initialIdeas }: { initialIdeas: NicheIdeaDto[] }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<NicheIdeaDto[]>(initialIdeas);
  const [topic, setTopic] = useState("");
  const [market, setMarket] = useState("amazon_co_uk");
  const [audience, setAudience] = useState("let_ai_decide");
  const [bookType, setBookType] = useState("let_ai_decide");
  const [count, setCount] = useState(10);
  const [finding, setFinding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("overall");
  const [statusFilter, setStatusFilter] = useState<NicheStatus | "all">("all");
  const [latestBatch, setLatestBatch] = useState<Set<string> | null>(null);
  const [duplicate, setDuplicate] = useState<{ ideaId: string; warning: DuplicateWarning } | null>(null);

  const refresh = async () => setIdeas(await api<NicheIdeaDto[]>("/api/niches"));

  const find = async (extra?: { parentId?: string; combineWith?: string }) => {
    setFinding(true);
    setError(null);
    try {
      const fresh = await api<NicheIdeaDto[]>("/api/niches/discover", {
        method: "POST",
        body: JSON.stringify({
          broadTopic: topic,
          market,
          audience: audience === "let_ai_decide" ? null : audience,
          bookType: bookType === "let_ai_decide" ? null : bookType,
          count,
          ...extra,
        }),
      });
      setLatestBatch(new Set(fresh.map((n) => n.id)));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Niche discovery failed");
    } finally {
      setFinding(false);
    }
  };

  const setStatus = async (id: string, status: NicheStatus) => {
    const updated = await api<NicheIdeaDto>(`/api/niches/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setIdeas((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const goDeeper = async (idea: NicheIdeaDto) => {
    setBusyId(idea.id);
    try {
      await find({ parentId: idea.id });
    } finally {
      setBusyId(null);
    }
  };

  const combine = async (idea: NicheIdeaDto) => {
    const other = window.prompt(
      `Combine "${idea.name}" with another niche.\n\nEnter the second topic (e.g. Christmas, Flowers, Mountains):`,
    );
    if (!other?.trim()) return;
    setBusyId(idea.id);
    try {
      await find({ parentId: idea.id, combineWith: other.trim() });
    } finally {
      setBusyId(null);
    }
  };

  const makeSeries = async (idea: NicheIdeaDto) => {
    setBusyId(idea.id);
    setError(null);
    try {
      const updated = await api<NicheIdeaDto>(`/api/niches/${idea.id}/series`, {
        method: "POST",
      });
      setIdeas((prev) => prev.map((n) => (n.id === idea.id ? updated : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Series generation failed");
    } finally {
      setBusyId(null);
    }
  };

  const buildBook = async (idea: NicheIdeaDto, force = false) => {
    setBusyId(idea.id);
    setError(null);
    try {
      const result = await api<{ project?: { id: string }; duplicate?: DuplicateWarning }>(
        `/api/niches/${idea.id}/build`,
        { method: "POST", body: JSON.stringify({ force }) },
      );
      if (result.duplicate) {
        setDuplicate({ ideaId: idea.id, warning: result.duplicate });
        return;
      }
      if (result.project) {
        router.push(`/projects/${result.project.id}/setup`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the book");
    } finally {
      setBusyId(null);
    }
  };

  const removeIdea = async (id: string) => {
    await api<{ deleted: true }>(`/api/niches/${id}`, { method: "DELETE" });
    setIdeas((prev) => prev.filter((n) => n.id !== id));
  };

  const visible = useMemo(() => {
    let list = ideas;
    if (statusFilter !== "all") list = list.filter((n) => n.status === statusFilter);
    else if (latestBatch) {
      // After a search, float the fresh batch to the top.
      list = [...list].sort(
        (a, b) => Number(latestBatch.has(b.id)) - Number(latestBatch.has(a.id)),
      );
    }
    const score = (n: NicheIdeaDto, key: string): number => {
      if (key === "newest") return Date.parse(n.createdAt) || 0;
      const s = n.scores;
      if (!s) return 0;
      if (key === "children")
        return /child|kid|ages/i.test(n.audience ?? "") ? s.overall : 0;
      if (key === "adults")
        return /adult|women|men|senior/i.test(n.audience ?? "") ? s.overall : 0;
      return (s as unknown as Record<string, number>)[key] ?? 0;
    };
    return [...list].sort((a, b) => score(b, sort) - score(a, sort));
  }, [ideas, sort, statusFilter, latestBatch]);

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">
            What broad topic are you interested in?
          </h2>
          <p className="text-xs text-stone-500">
            e.g. Christian, Bible, Belfast, Dogs, Monster Trucks, Christmas,
            Dinosaurs, Flowers, European Cities, Mindfulness
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Broad topic">
            <TextInput
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Christian"
            />
          </Field>
          <Field label="Target market">
            <Select value={market} onChange={(e) => setMarket(e.target.value)}>
              {MARKETS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Audience">
            <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCE_CHOICES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Book type">
            <Select value={bookType} onChange={(e) => setBookType(e.target.value)}>
              {BOOK_TYPES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Number of ideas">
            <div className="flex gap-2">
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={count === n}
                  onClick={() => setCount(n)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                    count === n
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Button onClick={() => find()} disabled={finding || !topic.trim()}>
            {finding ? "Finding niches…" : "Find Niches"}
          </Button>
        </div>
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-600">
          AI CONCEPT ANALYSIS — MARKET DATA NOT VERIFIED. Scores rate the
          concept itself; they are not Amazon sales, search volume or
          competition figures.
        </p>
      </Card>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {duplicate && (
        <Card className="space-y-3 border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-900">
            <strong>This concept is very similar to a book you have already
            created:</strong>{" "}
            {duplicate.warning.projectName} (similarity{" "}
            {Math.round(duplicate.warning.similarity * 100)}%).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const idea = ideas.find((n) => n.id === duplicate.ideaId);
                setDuplicate(null);
                if (idea) buildBook(idea, true);
              }}
            >
              Continue anyway
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const idea = ideas.find((n) => n.id === duplicate.ideaId);
                setDuplicate(null);
                if (idea) goDeeper(idea);
              }}
            >
              Find a different angle
            </Button>
            <Button variant="secondary" onClick={() => setDuplicate(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {ideas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={statusFilter === id}
                onClick={() => setStatusFilter(id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusFilter === id
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
            Sort by
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </label>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((idea) => (
          <NicheCard
            key={idea.id}
            idea={idea}
            isNew={latestBatch?.has(idea.id) ?? false}
            busy={busyId === idea.id || finding}
            onStatus={setStatus}
            onGoDeeper={goDeeper}
            onCombine={combine}
            onSeries={makeSeries}
            onBuild={(i) => buildBook(i)}
            onDelete={removeIdea}
            onUpdated={(updated) =>
              setIdeas((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
            }
          />
        ))}
      </div>

      {ideas.length === 0 && !finding && (
        <p className="py-8 text-center text-sm text-stone-500">
          No niche ideas yet — enter a broad topic above and tap Find Niches.
        </p>
      )}
    </div>
  );
}
