"use client";

// BUILD MY BOOK CONCEPT — creates (and shows) the persistent creative brief
// + Book Style Profile that is injected into every image-generation prompt.
// The brief stays editable; rebuilding replaces it with a fresh AI version.

import { useState } from "react";
import { Button, Card, TextArea } from "@/components/ui";
import type { ApiResponse, BookConcept } from "@/lib/types";

const PROFILE_LABELS: [keyof BookConcept["styleProfile"], string][] = [
  ["lineThickness", "Line thickness"],
  ["levelOfDetail", "Level of detail"],
  ["decorativeStyle", "Decorative style"],
  ["characterStyle", "Characters"],
  ["botanicalStyle", "Botanical elements"],
  ["landscapeStyle", "Landscapes"],
  ["architecturalStyle", "Architecture"],
  ["framingStyle", "Borders / framing"],
  ["whiteSpace", "White space"],
  ["overallAesthetic", "Overall aesthetic"],
];

export function BookConceptCard({
  projectId,
  initialConcept,
}: {
  projectId: string;
  initialConcept: BookConcept | null;
}) {
  const [concept, setConcept] = useState<BookConcept | null>(initialConcept);
  const [brief, setBrief] = useState(initialConcept?.creativeBrief ?? "");
  const [briefDirty, setBriefDirty] = useState(false);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wantCharacter, setWantCharacter] = useState(!!initialConcept?.character);
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/concept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeCharacter: wantCharacter }),
      });
      const json: ApiResponse<BookConcept> = await res.json();
      if (!json.ok) throw new Error(json.error);
      setConcept(json.data);
      setBrief(json.data.creativeBrief);
      setBriefDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Concept build failed");
    } finally {
      setBuilding(false);
    }
  };

  const saveBrief = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/concept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeBrief: brief }),
      });
      const json: ApiResponse<BookConcept> = await res.json();
      if (!json.ok) throw new Error(json.error);
      setConcept(json.data);
      setBriefDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the brief");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Book concept</h2>
          <p className="text-xs text-stone-500">
            The creative brief and Book Style Profile are added to every
            image-generation prompt so all pages look like one book.
          </p>
        </div>
        <Button onClick={build} disabled={building}>
          {building
            ? "Building concept…"
            : concept
              ? "Rebuild concept"
              : "Build my book concept"}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-stone-900"
          checked={wantCharacter}
          onChange={(e) => setWantCharacter(e.target.checked)}
        />
        Include a recurring main character (locked look on every page — great
        for children&apos;s books and series)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {concept && (
        <>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Creative brief (editable)
              </span>
              {briefDirty && (
                <Button variant="secondary" onClick={saveBrief} disabled={saving}>
                  {saving ? "Saving…" : "Save brief"}
                </Button>
              )}
            </div>
            <TextArea
              rows={5}
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value);
                setBriefDirty(true);
              }}
            />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Book style profile
            </span>
            <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {PROFILE_LABELS.map(([key, label]) => (
                <div key={key} className="flex gap-2">
                  <dt className="shrink-0 font-medium text-stone-500">{label}:</dt>
                  <dd className="text-stone-800">{String(concept.styleProfile[key])}</dd>
                </div>
              ))}
              {concept.styleProfile.recurringMotifs.length > 0 && (
                <div className="flex gap-2 sm:col-span-2">
                  <dt className="shrink-0 font-medium text-stone-500">Recurring motifs:</dt>
                  <dd className="text-stone-800">
                    {concept.styleProfile.recurringMotifs.join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {concept.character && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Recurring character
              </span>
              <p className="mt-1 text-sm text-stone-800">
                <strong>{concept.character.name}</strong> — {concept.character.description}
              </p>
              <ul className="mt-1 list-disc pl-4 text-xs text-stone-600">
                {concept.character.signatureDetails.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {concept.character.props.length > 0 && (
                  <li>Props: {concept.character.props.join("; ")}</li>
                )}
                <li>Signature pose: {concept.character.signaturePose}</li>
              </ul>
            </div>
          )}
          <p className="text-xs text-stone-400">
            Built {new Date(concept.builtAt).toLocaleString()}. Rebuild after
            changing the niche, tone or artwork theme; pages planned from now
            on use the latest version.
          </p>
        </>
      )}
      {!concept && (
        <p className="text-sm text-stone-500">
          No concept yet — build one before generating the book plan for a
          more cohesive, professionally art-directed collection.
        </p>
      )}
    </Card>
  );
}
