"use client";

// One niche opportunity card: name, niche-tree path, concept, artwork,
// recommendations, AI concept scores (clearly labelled — never market
// data), status controls, GO DEEPER / COMBINE / SERIES / BUILD THIS BOOK.

import { useState } from "react";
import Link from "next/link";
import type { NicheIdeaDto, NicheStatus } from "@/lib/types";
import { Button } from "@/components/ui";
import { MarketResearchPanel } from "@/components/niches/market-research-panel";

const SCORE_LABELS: [keyof NonNullable<NicheIdeaDto["scores"]>, string][] = [
  ["specificity", "Specificity"],
  ["visualPotential", "Visual potential"],
  ["variety", "Variety"],
  ["audienceClarity", "Audience clarity"],
  ["giftPotential", "Gift potential"],
  ["seriesPotential", "Series potential"],
  ["cbnSuitability", "Colour-by-numbers fit"],
];

const BOOK_TYPE_LABELS: Record<string, string> = {
  standard: "Standard colouring",
  colour_by_numbers: "Colour by numbers",
  mixed: "Mixed book",
  educational: "Educational",
  inspirational: "Inspirational / quote",
  scripture: "Scripture colouring",
};

export function NicheCard({
  idea,
  busy,
  onStatus,
  onGoDeeper,
  onCombine,
  onSeries,
  onBuild,
  onDelete,
  onUpdated,
}: {
  idea: NicheIdeaDto;
  busy: boolean;
  onStatus: (id: string, status: NicheStatus) => Promise<void>;
  onGoDeeper: (idea: NicheIdeaDto) => void;
  onCombine: (idea: NicheIdeaDto) => void;
  onSeries: (idea: NicheIdeaDto) => void;
  onBuild: (idea: NicheIdeaDto) => void;
  onDelete: (id: string) => Promise<void>;
  onUpdated: (updated: NicheIdeaDto) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [research, setResearch] = useState(false);
  const s = idea.scores;

  const statusBtn = (status: NicheStatus, label: string, title: string) => (
    <button
      type="button"
      title={title}
      aria-pressed={idea.status === status}
      onClick={() => onStatus(idea.id, idea.status === status ? "new" : status)}
      className={`rounded-md border px-2 py-1 text-xs ${
        idea.status === status
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
      }`}
    >
      {label}
    </button>
  );

  const actionBtn =
    "rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-stone-900">{idea.name}</h3>
          {idea.path.length > 1 && (
            <p className="mt-0.5 text-[11px] text-stone-500">
              {idea.path.join(" → ")}
            </p>
          )}
        </div>
        {s && (
          <span
            className="flex-none rounded-lg bg-stone-900 px-2.5 py-1.5 text-center text-white"
            title="Overall AI concept score (not market data)"
          >
            <span className="block text-base font-bold leading-none">{s.overall}</span>
            <span className="block text-[9px] opacity-75">/10</span>
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1.5 text-xs text-stone-700">
        {idea.audience && (
          <p><span className="font-semibold text-stone-500">Audience:</span> {idea.audience}</p>
        )}
        {idea.concept && <p>{idea.concept}</p>}
        {idea.artwork && (
          <p><span className="font-semibold text-stone-500">Artwork:</span> {idea.artwork}</p>
        )}
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500">
          {idea.bookType && <span>📖 {BOOK_TYPE_LABELS[idea.bookType] ?? idea.bookType}</span>}
          {idea.pageCount && <span>{idea.pageCount} pages</span>}
          {idea.difficulty && <span>Difficulty: {idea.difficulty}</span>}
          {idea.giftPotential && <span>🎁 {idea.giftPotential}</span>}
          {idea.seriesPotential && <span>📚 {idea.seriesPotential}</span>}
        </p>
        {idea.positioning && (
          <p className="rounded-lg bg-stone-50 px-2.5 py-1.5 italic text-stone-600">
            {idea.positioning}
          </p>
        )}
      </div>

      {expanded && s && (
        <div className="mt-2 space-y-1">
          {SCORE_LABELS.map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <span className="w-36 flex-none text-stone-500">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                <span
                  className="block h-full rounded-full bg-stone-700"
                  style={{ width: `${(s[key] / 10) * 100}%` }}
                />
              </span>
              <span className="w-6 text-right font-semibold text-stone-700">{s[key]}</span>
            </div>
          ))}
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            AI concept analysis — market data not verified
          </p>
        </div>
      )}

      {idea.seriesIdeas && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-xs font-bold text-stone-800">{idea.seriesIdeas.name}</p>
          <ol className="mt-1 list-inside list-decimal text-[11px] text-stone-600">
            {idea.seriesIdeas.books.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
        {statusBtn("favourite", "⭐", "Favourite")}
        {statusBtn("considering", "💡", "Considering")}
        {statusBtn("rejected", "❌", "Rejected")}
        {idea.status === "building" && (
          <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">📘 Building</span>
        )}
        {idea.status === "book_created" && (
          <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">✅ Book created</span>
        )}
        <span className="flex-1" />
        <button type="button" className={actionBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide scores" : "Scores"}
        </button>
        <button
          type="button"
          className={`${actionBtn} ${idea.marketData ? "border-amber-300 bg-amber-50 text-amber-800" : ""}`}
          onClick={() => setResearch((v) => !v)}
          title="Amazon links + BSR estimator and live Etsy market scan"
        >
          {research ? "Hide research" : idea.marketData ? "Research ✓" : "Research"}
        </button>
        <button type="button" className={actionBtn} disabled={busy} onClick={() => onGoDeeper(idea)}>
          Go deeper
        </button>
        <button type="button" className={actionBtn} disabled={busy} onClick={() => onCombine(idea)}>
          Combine
        </button>
        <button type="button" className={actionBtn} disabled={busy} onClick={() => onSeries(idea)}>
          {idea.seriesIdeas ? "New series idea" : "Turn into a series"}
        </button>
        <button
          type="button"
          className={`${actionBtn} text-red-600 hover:bg-red-50`}
          disabled={busy}
          onClick={() => onDelete(idea.id)}
          title="Remove this idea"
        >
          ✕
        </button>
      </div>
      {research && <MarketResearchPanel idea={idea} onUpdated={onUpdated} />}
      <div className="mt-2">
        {idea.linkedProjectId ? (
          <Link
            href={`/projects/${idea.linkedProjectId}/setup`}
            className="block rounded-lg bg-stone-100 px-3 py-2 text-center text-sm font-semibold text-stone-800 hover:bg-stone-200"
          >
            Open project →
          </Link>
        ) : (
          <Button className="w-full" disabled={busy} onClick={() => onBuild(idea)}>
            Build this book
          </Button>
        )}
      </div>
    </div>
  );
}
