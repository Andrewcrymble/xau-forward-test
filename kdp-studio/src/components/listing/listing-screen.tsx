"use client";

// Amazon listing generator: AI-drafted copy, fully editable before saving,
// with a one-tap "use as back-cover text" bridge to the cover builder.

import { useEffect, useRef, useState } from "react";
import type { ApiResponse, ListingContent, ProjectDto } from "@/lib/types";
import { Button, Card, EmptyState, Field, TextArea, TextInput } from "@/components/ui";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

function Count({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs ${value > max ? "text-red-600" : "text-stone-400"}`}>
      {value}/{max}
    </span>
  );
}

export function ListingScreen({
  project,
  initialListing,
  provider,
}: {
  project: ProjectDto;
  initialListing: ListingContent | null;
  provider: { name: string; isSample: boolean };
}) {
  const [listing, setListing] = useState<ListingContent | null>(initialListing);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [applied, setApplied] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<ListingContent>>({});
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const patch = (fields: Partial<ListingContent>) => {
    setListing((prev) => (prev ? { ...prev, ...fields } : prev));
    pending.current = { ...pending.current, ...fields };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const body = pending.current;
      pending.current = {};
      try {
        const fresh = await api<ListingContent>(`/api/projects/${project.id}/listing`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setListing(fresh);
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Save failed");
      }
    }, 900);
  };

  const generate = async () => {
    if (
      listing &&
      !window.confirm("Regenerate the listing?\n\nAll current listing text will be replaced with fresh AI copy.")
    ) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      setListing(await api<ListingContent>(`/api/projects/${project.id}/listing/generate`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const applyToCover = async () => {
    setError(null);
    try {
      await api(`/api/projects/${project.id}/listing/apply-back-cover`, { method: "POST" });
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply to cover");
    }
  };

  const notice = provider.isSample && (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      No AI provider key configured — listing copy uses the built-in{" "}
      <strong>sample generator</strong>. Add <code>OPENAI_API_KEY</code> for real copy.
    </p>
  );

  if (!listing) {
    return (
      <div className="space-y-4">
        {notice}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        <EmptyState
          title="No listing yet"
          description={`Generate complete Amazon listing copy for “${project.title}”: title ideas, description, sales bullets, seven keywords, audience and back-cover text. You can edit everything before using it.`}
          action={
            <Button onClick={generate} disabled={generating}>
              {generating ? "Writing listing…" : "Generate Amazon Listing"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={generate} disabled={generating}>
          {generating ? "Regenerating…" : "Regenerate listing"}
        </Button>
        <span className="text-xs text-stone-500">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && <span className="text-emerald-600">All changes saved</span>}
          {saveState === "error" && <span className="text-red-600">Save failed</span>}
        </span>
      </div>
      {notice}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900">Title & subtitle</h2>
            {listing.titleSuggestions.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Suggestions — tap to use
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {listing.titleSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => patch({ title: t })}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        listing.title === t
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Listing title">
              <TextInput value={listing.title} onChange={(e) => patch({ title: e.target.value })} />
            </Field>
            <Count value={listing.title.length} max={200} />
            <Field label="Subtitle">
              <TextInput value={listing.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900">Product description</h2>
            <TextArea rows={9} value={listing.description} onChange={(e) => patch({ description: e.target.value })} />
            <Count value={listing.description.length} max={4000} />
            <Field label="Sales points (one per line)">
              <TextArea
                rows={5}
                value={listing.bulletPoints.join("\n")}
                onChange={(e) => patch({ bulletPoints: e.target.value.split("\n").filter((l) => l.trim()) })}
              />
            </Field>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900">Seven keywords</h2>
            <p className="text-xs text-stone-500">
              Amazon gives every book seven backend keyword slots. Suggestions
              are a starting point — they don&apos;t guarantee search ranking.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {listing.keywords.map((k, i) => (
                <TextInput
                  key={i}
                  value={k}
                  aria-label={`Keyword ${i + 1}`}
                  onChange={(e) => {
                    const keywords = [...listing.keywords];
                    keywords[i] = e.target.value;
                    patch({ keywords });
                  }}
                />
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900">Audience & promo</h2>
            <Field label="Audience description">
              <TextArea rows={2} value={listing.audience} onChange={(e) => patch({ audience: e.target.value })} />
            </Field>
            <Field label="Short promotional line">
              <TextArea rows={2} value={listing.shortPromo} onChange={(e) => patch({ shortPromo: e.target.value })} />
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900">Back-cover description</h2>
            <TextArea
              rows={4}
              value={listing.backCoverDescription}
              onChange={(e) => patch({ backCoverDescription: e.target.value })}
            />
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={applyToCover}>
                Use as back-cover text
              </Button>
              {applied && <span className="text-sm text-emerald-600">Applied to the cover ✓</span>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
