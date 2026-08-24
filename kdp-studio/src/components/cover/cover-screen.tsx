"use client";

/* eslint-disable @next/next/no-img-element */

// Cover tab: artwork generation with versions, the typography editor with
// autosave, live wraparound preview with guides, spine/size calculations,
// and the print-ready KDP cover PDF build.

import { useEffect, useRef, useState } from "react";
import type { ApiResponse, CoverDto, CoverSettings, ProjectDto } from "@/lib/types";
import type { CoverBuildResult } from "@/lib/services/cover-service";
import { Button, Card, Checkbox, Field, Select, TextArea, TextInput } from "@/components/ui";
import { CoverPreview } from "@/components/cover/cover-preview";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

const PAPER_LABELS: Record<CoverSettings["paperType"], string> = {
  blackWhiteWhitePaper: "Black ink · white paper (colouring book default)",
  blackWhiteCreamPaper: "Black ink · cream paper",
  colourWhitePaper: "Colour ink · white paper",
};

export function CoverScreen({
  project,
  initialCover,
  provider,
  latestExport,
}: {
  project: ProjectDto;
  initialCover: CoverDto;
  provider: { name: string; isSample: boolean };
  latestExport: { url: string; builtAt: string } | null;
}) {
  const [cover, setCover] = useState<CoverDto>(initialCover);
  const [showGuides, setShowGuides] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState<CoverBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Debounced autosave of text fields + settings.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown>>({});
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const patch = (fields: Partial<CoverDto>, settings?: Partial<CoverSettings>) => {
    setCover((prev) => ({
      ...prev,
      ...fields,
      settings: { ...prev.settings, ...(settings ?? {}) },
    }));
    pending.current = {
      ...pending.current,
      ...fields,
      ...(settings
        ? { settings: { ...(pending.current.settings as object ?? {}), ...settings } }
        : {}),
    };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const body = pending.current;
      pending.current = {};
      try {
        const fresh = await api<CoverDto>(`/api/projects/${project.id}/cover`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setCover(fresh);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      setCover(await api<CoverDto>(`/api/projects/${project.id}/cover/artwork`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Artwork generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const selectArtwork = async (url: string) => {
    setError(null);
    try {
      setCover(
        await api<CoverDto>(`/api/projects/${project.id}/cover/artwork`, {
          method: "POST",
          body: JSON.stringify({ select: url }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select artwork");
    }
  };

  const build = async () => {
    setBuilding(true);
    setError(null);
    try {
      setBuilt(await api<CoverBuildResult>(`/api/projects/${project.id}/cover/build`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover build failed");
    } finally {
      setBuilding(false);
    }
  };

  const { dims, settings } = cover;
  const download = built?.url ?? latestExport?.url ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-stone-900"
            checked={showGuides}
            onChange={(e) => setShowGuides(e.target.checked)}
          />
          Show trim / safe / spine guides (preview only — never exported)
        </label>
        <span className="text-xs text-stone-500">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && <span className="text-emerald-600">All changes saved</span>}
          {saveState === "error" && <span className="text-red-600">Autosave failed</span>}
        </span>
      </div>

      {provider.isSample && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No image API key configured — cover artwork uses the built-in{" "}
          <strong>placeholder renderer</strong>. Add <code>OPENAI_API_KEY</code>{" "}
          for real artwork.
        </p>
      )}

      <CoverPreview cover={cover} showGuides={showGuides} />
      <p className="text-center text-xs text-stone-400">
        Back cover · Spine · Front cover — exactly as the wraparound will print
      </p>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-stone-900">Front cover artwork</h2>
          <Button onClick={generate} disabled={generating}>
            {generating
              ? "Generating artwork…"
              : settings.artworkVersions.length > 0
                ? "Generate another version"
                : "Generate cover artwork"}
          </Button>
          {settings.artworkVersions.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {settings.artworkVersions.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => selectArtwork(url)}
                  className={`overflow-hidden rounded-lg border-2 ${
                    cover.artwork === url ? "border-stone-900" : "border-transparent hover:border-stone-300"
                  }`}
                  title={cover.artwork === url ? "Current artwork" : "Use this artwork"}
                >
                  <img src={url} alt={`Artwork v${i + 1}`} className="aspect-[2/3] w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-stone-500">
            Artwork is generated without any text — the title, subtitle and
            author below are typeset by the app.
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-stone-900">Cover text</h2>
          <Field label="Title">
            <TextInput value={cover.title} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <TextInput value={cover.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value || null })} />
          </Field>
          <Field label="Author / publisher">
            <TextInput value={cover.author ?? ""} onChange={(e) => patch({ author: e.target.value || null })} />
          </Field>
          <Field
            label="Spine text"
            hint={dims.spineTextAllowed ? undefined : `Spine is ${dims.spineIn.toFixed(3)}" — KDP only allows spine text from 0.25" (~100+ pages)`}
          >
            <TextInput value={cover.spineText ?? ""} onChange={(e) => patch({ spineText: e.target.value || null })} />
          </Field>
          <Field label="Back-cover description">
            <TextArea rows={4} value={cover.backCoverText ?? ""} onChange={(e) => patch({ backCoverText: e.target.value || null })} />
          </Field>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900">Typography & style</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title font">
                <Select value={settings.titleFont} onChange={(e) => patch({}, { titleFont: e.target.value as CoverSettings["titleFont"] })}>
                  <option value="serif">Serif</option>
                  <option value="sans">Sans-serif</option>
                </Select>
              </Field>
              <Field label="Title size">
                <Select value={String(settings.titleSize)} onChange={(e) => patch({}, { titleSize: Number(e.target.value) })}>
                  {[28, 34, 42, 50, 60, 72].map((s) => (
                    <option key={s} value={s}>{s} pt</option>
                  ))}
                </Select>
              </Field>
              <Field label="Title position">
                <Select value={settings.titlePosition} onChange={(e) => patch({}, { titlePosition: e.target.value as CoverSettings["titlePosition"] })}>
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </Select>
              </Field>
              <Field label="Alignment">
                <Select value={settings.textAlign} onChange={(e) => patch({}, { textAlign: e.target.value as CoverSettings["textAlign"] })}>
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </Select>
              </Field>
              <Field label="Text colour">
                <input
                  type="color"
                  value={/^#/.test(settings.textColor) ? settings.textColor : "#ffffff"}
                  onChange={(e) => patch({}, { textColor: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-stone-300"
                />
              </Field>
              <Field label="Back/spine colour">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => patch({}, { backgroundColor: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-stone-300"
                />
              </Field>
              <Field label="Text effect" hint="Makes the title readable over busy artwork">
                <Select value={settings.textEffect} onChange={(e) => patch({}, { textEffect: e.target.value as CoverSettings["textEffect"] })}>
                  <option value="none">None</option>
                  <option value="outline">Outline</option>
                  <option value="shadow">Drop shadow</option>
                  <option value="plate">Colour panel behind text</option>
                </Select>
              </Field>
              <Field label="Effect colour">
                <input
                  type="color"
                  value={/^#/.test(settings.effectColor) ? settings.effectColor : "#000000"}
                  onChange={(e) => patch({}, { effectColor: e.target.value })}
                  disabled={settings.textEffect === "none"}
                  className="h-9 w-full cursor-pointer rounded-lg border border-stone-300 disabled:cursor-not-allowed disabled:opacity-40"
                />
              </Field>
            </div>
            <Checkbox
              label="Use artwork on back cover"
              hint="Carries the front artwork across the back, darkened so text stays readable"
              checked={settings.backArtwork}
              onChange={(e) => patch({}, { backArtwork: e.target.checked })}
            />
            <Checkbox
              label="Leave barcode area clear"
              hint="Amazon prints its own barcode bottom-right on the back cover"
              checked={settings.barcodeAreaClear}
              onChange={(e) => patch({}, { barcodeAreaClear: e.target.checked })}
            />
          </Card>

          <Card className="space-y-2">
            <h2 className="text-base font-semibold text-stone-900">Dimensions</h2>
            <Field label="Paper type (affects spine width)">
              <Select value={settings.paperType} onChange={(e) => patch({}, { paperType: e.target.value as CoverSettings["paperType"] })}>
                {(Object.keys(PAPER_LABELS) as CoverSettings["paperType"][]).map((k) => (
                  <option key={k} value={k}>{PAPER_LABELS[k]}</option>
                ))}
              </Select>
            </Field>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-stone-700" style={{ fontVariantNumeric: "tabular-nums" }}>
              <dt className="text-stone-500">Interior pages</dt>
              <dd className="text-right font-semibold">{dims.pageCount}</dd>
              <dt className="text-stone-500">Spine width</dt>
              <dd className="text-right font-semibold">{dims.spineIn.toFixed(3)} in</dd>
              <dt className="text-stone-500">Full cover</dt>
              <dd className="text-right font-semibold">
                {dims.totalWidthIn.toFixed(3)} × {dims.totalHeightIn.toFixed(2)} in
              </dd>
              <dt className="text-stone-500">Bleed</dt>
              <dd className="text-right font-semibold">{dims.bleedIn.toFixed(3)} in</dd>
            </dl>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={build} disabled={building}>
                {building ? "Building cover PDF…" : "Build Cover PDF"}
              </Button>
              {download && (
                <a href={download} target="_blank" rel="noreferrer" className="text-sm font-semibold text-stone-900 underline underline-offset-2">
                  Preview / download book-cover.pdf
                </a>
              )}
            </div>
            {built && (
              <p className="text-xs text-emerald-700">
                Built {(built.bytes / 1024 / 1024).toFixed(1)} MB wraparound —
                {" "}{built.dims.totalWidthIn.toFixed(3)} × {built.dims.totalHeightIn.toFixed(2)} in.
              </p>
            )}
            {!built && latestExport && (
              <p className="text-xs text-stone-500">
                Last built {new Date(latestExport.builtAt).toLocaleString()}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
