"use client";

// Interior tab: interior options (with front-matter ordering), a live
// page-sequence preview with the final page count, and the print-ready
// PDF build with preview/download.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  ApiResponse,
  FrontMatterKey,
  InteriorOptions,
  ProjectDto,
} from "@/lib/types";
import type {
  InteriorBuildResult,
  InteriorLayout,
} from "@/lib/services/interior-service";
import { INTERIOR_OPTION_DEFS } from "@/lib/config/book-options";
import { Button, Card, Checkbox } from "@/components/ui";

const FM_LABELS: Record<FrontMatterKey, string> = {
  titlePage: "Title page",
  copyrightPage: "Copyright page",
  belongsToPage: "This Book Belongs To",
  testColourPage: "Colour test page",
};

const FM_FLAGS: Record<FrontMatterKey, keyof InteriorOptions> = {
  titlePage: "includeTitlePage",
  copyrightPage: "includeCopyrightPage",
  belongsToPage: "includeBelongsToPage",
  testColourPage: "includeTestColourPage",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export function InteriorScreen({
  project,
  initialLayout,
  latestExport,
}: {
  project: ProjectDto;
  initialLayout: InteriorLayout;
  latestExport: { url: string; builtAt: string } | null;
}) {
  const [options, setOptions] = useState<InteriorOptions>(initialLayout.options);
  const [layout, setLayout] = useState<InteriorLayout>(initialLayout);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState<InteriorBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Persist option changes (debounced) then refresh the layout preview.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  }, [options]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const changeOptions = (patch: Partial<InteriorOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api(`/api/projects/${project.id}`, {
          method: "PATCH",
          body: JSON.stringify({ interiorOptions: latest.current }),
        });
        const fresh = await api<InteriorLayout>(
          `/api/projects/${project.id}/interior/layout`,
        );
        setLayout(fresh);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 700);
  };

  const enabledOrder = [
    ...options.frontMatterOrder,
    ...(Object.keys(FM_LABELS) as FrontMatterKey[]).filter(
      (k) => !options.frontMatterOrder.includes(k),
    ),
  ].filter((k) => options[FM_FLAGS[k]]);

  const moveFm = (key: FrontMatterKey, dir: -1 | 1) => {
    const order = [...enabledOrder];
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    // Keep disabled keys at the end so re-enabling behaves predictably.
    const disabled = (Object.keys(FM_LABELS) as FrontMatterKey[]).filter(
      (k) => !order.includes(k),
    );
    changeOptions({ frontMatterOrder: [...order, ...disabled] });
  };

  const build = async () => {
    setBuilding(true);
    setError(null);
    try {
      const result = await api<InteriorBuildResult>(
        `/api/projects/${project.id}/interior/build`,
        { method: "POST" },
      );
      setBuilt(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  };

  const download = built?.url ?? latestExport?.url ?? null;
  const arrowBtn =
    "rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end text-xs text-stone-500">
        {saveState === "saving" && <span>Saving…</span>}
        {saveState === "saved" && <span className="text-emerald-600">All changes saved</span>}
        {saveState === "error" && <span className="text-red-600">Autosave failed</span>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-stone-900">Interior options</h2>
          <div className="space-y-2">
            {INTERIOR_OPTION_DEFS.map((opt) => (
              <Checkbox
                key={opt.key}
                label={opt.label}
                hint={opt.hint}
                checked={Boolean(options[opt.key as keyof InteriorOptions])}
                onChange={(e) =>
                  changeOptions({ [opt.key]: e.target.checked } as Partial<InteriorOptions>)
                }
              />
            ))}
            <Checkbox
              label='Print "Blank page to help prevent bleed-through." on blank pages'
              hint="Off by default — blank pages stay completely blank"
              checked={options.blankPageMessage}
              onChange={(e) => changeOptions({ blankPageMessage: e.target.checked })}
            />
          </div>

          {enabledOrder.length > 1 && (
            <div>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-stone-800">
                Front matter order
              </h3>
              <ol className="space-y-1.5">
                {enabledOrder.map((key, i) => (
                  <li
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
                  >
                    <span>
                      {i + 1}. {FM_LABELS[key]}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className={arrowBtn}
                        disabled={i === 0}
                        onClick={() => moveFm(key, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={arrowBtn}
                        disabled={i === enabledOrder.length - 1}
                        onClick={() => moveFm(key, 1)}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-stone-900">Final book</h2>
              <p className="text-2xl font-bold text-stone-900">
                {layout.pageCount}
                <span className="ml-1 text-sm font-normal text-stone-500">pages</span>
              </p>
            </div>
            <p className="text-sm text-stone-600">
              {layout.approvedCount} approved colouring page
              {layout.approvedCount === 1 ? "" : "s"}
              {layout.unapprovedCount > 0 && (
                <span className="text-stone-400">
                  {" "}
                  · {layout.unapprovedCount} not approved (excluded)
                </span>
              )}
            </p>
            {layout.warnings.map((w, i) => (
              <p
                key={i}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              >
                {w}
              </p>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={build} disabled={building || layout.approvedCount === 0}>
                {building ? "Building PDF…" : "Build Interior PDF"}
              </Button>
              {download && (
                <a
                  href={download}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-stone-900 underline underline-offset-2"
                >
                  Preview / download book-interior.pdf
                </a>
              )}
            </div>
            {built && (
              <p className="text-xs text-emerald-700">
                Built {built.pageCount} pages ·{" "}
                {(built.bytes / 1024 / 1024).toFixed(1)} MB — opens in a new tab
                for preview.
              </p>
            )}
            {!built && latestExport && (
              <p className="text-xs text-stone-500">
                Last built {new Date(latestExport.builtAt).toLocaleString()}
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            {layout.approvedCount === 0 && (
              <p className="text-xs text-stone-500">
                Approve pages in the{" "}
                <Link
                  href={`/projects/${project.id}/images`}
                  className="font-semibold underline"
                >
                  Images tab
                </Link>{" "}
                first.
              </p>
            )}
          </Card>

          <Card className="space-y-2">
            <h2 className="text-base font-semibold text-stone-900">Page sequence</h2>
            <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
              {layout.slots.map((slot) => (
                <div
                  key={slot.pageNumber}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs odd:bg-stone-50"
                >
                  <span className="w-8 flex-none text-right font-mono text-stone-400">
                    {slot.pageNumber}
                  </span>
                  <span
                    className={`w-12 flex-none rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                      slot.recto
                        ? "bg-stone-200 text-stone-700"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {slot.recto ? "right" : "left"}
                  </span>
                  <span
                    className={
                      slot.kind === "blank"
                        ? "text-stone-400"
                        : slot.kind === "colouring"
                          ? "text-stone-800"
                          : "font-medium text-stone-600"
                    }
                  >
                    {slot.kind === "colouring" ? `🎨 ${slot.label}` : slot.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
