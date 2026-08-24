"use client";

// New Colouring Book wizard (create mode) and project Setup screen (edit
// mode). Edit mode autosaves with a debounce; create mode walks through
// wizard steps and POSTs once at the end.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BIBLE_TRANSLATIONS,
  CBN_COLOUR_COUNTS,
  CBN_DIFFICULTIES,
  CBN_KEY_PLACEMENTS,
  COMPLEXITY_LEVELS,
  DEFAULT_CBN_PALETTE,
  DEFAULT_COMPLEXITY_FOR_AUDIENCE,
  EMOTIONAL_TONES,
  INTERIOR_OPTION_DEFS,
  MAX_PAGE_COUNT,
  MIN_PAGE_COUNT,
  PAGE_COUNT_PRESETS,
  STYLES,
  TARGET_AUDIENCES,
  VERSE_THEMES,
} from "@/lib/config/book-options";
import { TRIM_SIZES } from "@/lib/config/kdp-spec";
import {
  projectCreateSchema,
  type ProjectCreateInput,
} from "@/lib/validation/project";
import {
  DEFAULT_BIBLE_SETTINGS,
  DEFAULT_CBN_SETTINGS,
  DEFAULT_INTERIOR_OPTIONS,
  type ApiResponse,
  type BibleSettings,
  type CbnSettings,
  type InteriorOptions,
  type ProjectDto,
} from "@/lib/types";
import {
  Button,
  Card,
  Checkbox,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";
import { ComplexityPreview, StylePreview } from "@/components/style-previews";
import { BookConceptCard } from "@/components/book-concept-card";

type FormState = ProjectCreateInput;
type FieldErrors = Partial<Record<string, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  title: "",
  subtitle: "",
  author: "",
  niche: "",
  description: "",
  targetAudience: "ages_4_8",
  customAudience: "",
  trimSize: "8.5x11",
  numberOfDesigns: 30,
  style: "clean_childrens",
  customStyle: "",
  complexity: DEFAULT_COMPLEXITY_FOR_AUDIENCE["ages_4_8"],
  complexityOverridden: false,
  subNiche: "",
  specificAngle: "",
  emotionalTones: [],
  artworkTheme: "",
  colouringMode: "standard",
  cbnSettings: { ...DEFAULT_CBN_SETTINGS },
  bibleSettings: { ...DEFAULT_BIBLE_SETTINGS },
  interiorOptions: { ...DEFAULT_INTERIOR_OPTIONS },
};

function projectToForm(p: ProjectDto): FormState {
  return {
    name: p.name,
    title: p.title,
    subtitle: p.subtitle ?? "",
    author: p.author ?? "",
    niche: p.niche,
    description: p.description ?? "",
    targetAudience: p.targetAudience,
    customAudience: p.customAudience ?? "",
    trimSize: p.trimSize,
    numberOfDesigns: p.numberOfDesigns,
    style: p.style,
    customStyle: p.customStyle ?? "",
    complexity: p.complexity,
    complexityOverridden: p.complexityOverridden,
    subNiche: p.subNiche ?? "",
    specificAngle: p.specificAngle ?? "",
    emotionalTones: p.emotionalTones,
    artworkTheme: p.artworkTheme ?? "",
    colouringMode: p.colouringMode,
    cbnSettings: p.cbnSettings,
    bibleSettings: p.bibleSettings,
    interiorOptions: p.interiorOptions,
  };
}

function validate(form: FormState): FieldErrors {
  const parsed = projectCreateSchema.safeParse(form);
  if (parsed.success) return {};
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const WIZARD_STEPS = [
  { title: "Book niche", fields: ["name", "title", "subtitle", "niche", "subNiche", "specificAngle", "description", "targetAudience", "customAudience", "emotionalTones", "artworkTheme", "bibleSettings"] },
  { title: "Pages & mode", fields: ["numberOfDesigns", "trimSize", "colouringMode", "cbnSettings"] },
  { title: "Style & complexity", fields: ["style", "customStyle", "complexity"] },
  { title: "Interior options", fields: ["interiorOptions"] },
];

type SaveState = "idle" | "saving" | "saved" | "error";

export function BookSetupForm({
  mode,
  project,
}: {
  mode: "create" | "edit";
  project?: ProjectDto;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(
    project ? projectToForm(project) : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const isCustomPageCount = !PAGE_COUNT_PRESETS.includes(form.numberOfDesigns);
  const [customPages, setCustomPages] = useState(isCustomPageCount);

  // --- Autosave (edit mode) ---------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestForm = useRef(form);
  useEffect(() => {
    latestForm.current = form;
  }, [form]);

  const persist = useCallback(async () => {
    if (mode !== "edit" || !project) return;
    const current = latestForm.current;
    if (Object.keys(validate(current)).length > 0) return; // don't save invalid state
    setSaveState("saving");
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      const json: ApiResponse<ProjectDto> = await res.json();
      setSaveState(json.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [mode, project]);

  const scheduleAutosave = useCallback(() => {
    if (mode !== "edit") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 800);
  }, [mode, persist]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // --- Field updates -----------------------------------------------------
  const update = useCallback(
    (patch: Partial<FormState>) => {
      setForm((prev) => ({ ...prev, ...patch }));
      setErrors({});
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onAudienceChange = (audience: string) => {
    const patch: Partial<FormState> = { targetAudience: audience };
    // Complexity adapts to the audience unless the user overrode it.
    if (!form.complexityOverridden) {
      patch.complexity =
        DEFAULT_COMPLEXITY_FOR_AUDIENCE[audience] ?? form.complexity;
    }
    update(patch);
  };

  const recommendedComplexity =
    DEFAULT_COMPLEXITY_FOR_AUDIENCE[form.targetAudience];

  // --- Create submission -------------------------------------------------
  const submitCreate = async () => {
    const allErrors = validate(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const badStep = WIZARD_STEPS.findIndex((s) =>
        s.fields.some((f) => allErrors[f]),
      );
      if (badStep >= 0) setStep(badStep);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json: ApiResponse<ProjectDto> = await res.json();
      if (json.ok) {
        router.push(`/projects/${json.data.id}/setup`);
        router.refresh();
        return;
      }
      setServerError(json.error);
    } catch {
      setServerError("Could not reach the server. Please try again.");
    }
    setSubmitting(false);
  };

  const nextStep = () => {
    const stepErrors = validate(form);
    const relevant: FieldErrors = {};
    for (const f of WIZARD_STEPS[step].fields) {
      if (stepErrors[f]) relevant[f] = stepErrors[f];
    }
    if (Object.keys(relevant).length > 0) {
      setErrors(relevant);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };

  // --- Sections ----------------------------------------------------------
  const bible: BibleSettings = form.bibleSettings ?? { ...DEFAULT_BIBLE_SETTINGS };
  const setBible = (patch: Partial<BibleSettings>) =>
    update({ bibleSettings: { ...bible, ...patch } });
  const cbn: CbnSettings = form.cbnSettings ?? { ...DEFAULT_CBN_SETTINGS };
  const setCbn = (patch: Partial<CbnSettings>) =>
    update({ cbnSettings: { ...cbn, ...patch } });

  const sectionBible = (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <Checkbox
        label="Bible verse settings"
        hint="Pair every page with scripture — for Christian / scripture niches"
        checked={bible.enabled}
        onChange={(e) => setBible({ enabled: e.target.checked })}
      />
      {bible.enabled && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bible translation">
              <Select
                value={bible.translation}
                onChange={(e) => setBible({ translation: e.target.value })}
              >
                {BIBLE_TRANSLATIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2 pt-1">
              <Checkbox
                label="Include verse text in artwork"
                checked={bible.includeVerseText}
                onChange={(e) => setBible({ includeVerseText: e.target.checked })}
              />
              <Checkbox
                label="Include scripture reference"
                checked={bible.includeReference}
                onChange={(e) => setBible({ includeReference: e.target.checked })}
              />
            </div>
          </div>
          <Field label="Verse themes (choose any)">
            <div className="flex flex-wrap gap-2">
              {VERSE_THEMES.map((t) => {
                const active = bible.themes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setBible({
                        themes: active
                          ? bible.themes.filter((id) => id !== t.id)
                          : [...bible.themes, t.id],
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <p className="text-xs text-amber-700">
            Scripture is never invented or paraphrased by the app: every
            AI-supplied verse is flagged for verification against a printed
            copy of your chosen translation. Modern translations (NIV, ESV,
            NLT, NKJV) have publisher licensing terms for commercial use —
            check them before publishing. KJV is public domain in most
            territories.
          </p>
        </div>
      )}
    </div>
  );

  const sectionDetails = (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-stone-900">Book details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name" error={errors.name}>
          <TextInput
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. European Cities Book"
          />
        </Field>
        <Field label="Book title" error={errors.title}>
          <TextInput
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Famous European Cities"
          />
        </Field>
      </div>
      <Field label="Subtitle (optional)" error={errors.subtitle}>
        <TextInput
          value={form.subtitle ?? ""}
          onChange={(e) => update({ subtitle: e.target.value })}
          placeholder="e.g. A Relaxing Architectural Colouring Book"
        />
      </Field>
      <Field
        label="Author / pen name (optional)"
        hint="Used on the title page, copyright page and cover"
        error={errors.author}
      >
        <TextInput
          value={form.author ?? ""}
          onChange={(e) => update({ author: e.target.value })}
          placeholder="e.g. A. Crymble"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Main niche" error={errors.niche}>
          <TextInput
            value={form.niche}
            onChange={(e) => update({ niche: e.target.value })}
            placeholder="e.g. Christian, Dinosaurs, European Cities"
          />
        </Field>
        <Field
          label="Sub-niche (optional)"
          hint="A more specific slice of the main niche"
          error={errors.subNiche}
        >
          <TextInput
            value={form.subNiche ?? ""}
            onChange={(e) => update({ subNiche: e.target.value })}
            placeholder="e.g. Encouraging Bible Verses, Cute Baby Dinosaurs"
          />
        </Field>
      </div>
      <Field
        label="Specific theme / angle (optional)"
        hint="What makes THIS book different from others in the same niche — its exact positioning"
        error={errors.specificAngle}
      >
        <TextArea
          rows={3}
          value={form.specificAngle ?? ""}
          onChange={(e) => update({ specificAngle: e.target.value })}
          placeholder="e.g. An encouraging Christian colouring book focused specifically on Bible verses about hope, strength and trusting God during difficult seasons."
        />
      </Field>
      <Field
        label="Additional description (optional)"
        hint="Anything else the AI should know when planning the book"
        error={errors.description}
      >
        <TextArea
          value={form.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target audience" error={errors.targetAudience}>
          <Select
            value={form.targetAudience}
            onChange={(e) => onAudienceChange(e.target.value)}
          >
            {TARGET_AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        {form.targetAudience === "custom" && (
          <Field label="Describe your audience" error={errors.customAudience}>
            <TextInput
              value={form.customAudience ?? ""}
              onChange={(e) => update({ customAudience: e.target.value })}
              placeholder="e.g. Senior citizens who love gardening"
            />
          </Field>
        )}
      </div>
      <Field
        label="Emotional tone (choose any that fit)"
        hint="Sets the feeling every page should communicate"
      >
        <div className="flex flex-wrap gap-2">
          {EMOTIONAL_TONES.map((t) => {
            const active = (form.emotionalTones ?? []).includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update({
                    emotionalTones: active
                      ? (form.emotionalTones ?? []).filter((id) => id !== t.id)
                      : [...(form.emotionalTones ?? []), t.id],
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field
        label="Artwork theme (optional)"
        hint="Recurring imagery the illustrations should draw on, in your own words"
        error={errors.artworkTheme}
      >
        <TextArea
          rows={2}
          value={form.artworkTheme ?? ""}
          onChange={(e) => update({ artworkTheme: e.target.value })}
          placeholder="e.g. Wildflowers, mountains, sunrise, open Bible, small churches, doves, olive branches, flowing rivers, stars and botanical elements"
        />
      </Field>
      {sectionBible}
    </Card>
  );

  const sectionFormat = (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-stone-900">Pages & size</h2>
      <Field
        label="Number of colouring pages"
        hint="The number of colouring illustrations — not the total paperback page count"
        error={errors.numberOfDesigns}
      >
        <div className="flex flex-wrap gap-2">
          {PAGE_COUNT_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCustomPages(false);
                update({ numberOfDesigns: n });
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                !customPages && form.numberOfDesigns === n
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomPages(true)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              customPages
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            }`}
          >
            Custom
          </button>
          {customPages && (
            <input
              type="number"
              min={MIN_PAGE_COUNT}
              max={MAX_PAGE_COUNT}
              value={form.numberOfDesigns}
              onChange={(e) =>
                update({ numberOfDesigns: Number(e.target.value) })
              }
              className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          )}
        </div>
      </Field>
      <Field
        label="Trim size"
        hint="More trim sizes will be supported later"
        error={errors.trimSize}
      >
        <Select
          value={form.trimSize}
          onChange={(e) => update({ trimSize: e.target.value })}
        >
          {Object.values(TRIM_SIZES).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Book colouring style" error={errors.colouringMode}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["standard", "Standard colouring"],
              ["colour_by_numbers", "Colour by Numbers"],
              ["mixed", "Mixed book"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={form.colouringMode === id}
              onClick={() => update({ colouringMode: id })}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                form.colouringMode === id
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      {form.colouringMode !== "standard" && (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="text-sm font-semibold text-stone-900">Colour by Numbers settings</h3>
          {form.colouringMode === "mixed" && (
            <Field
              label="Colour by Numbers pages"
              hint={`Out of ${form.numberOfDesigns} total — the remaining ${Math.max(0, form.numberOfDesigns - Math.min(cbn.cbnPageCount, form.numberOfDesigns))} are standard colouring pages`}
            >
              <input
                type="number"
                min={0}
                max={form.numberOfDesigns}
                value={Math.min(cbn.cbnPageCount, form.numberOfDesigns)}
                onChange={(e) =>
                  setCbn({
                    cbnPageCount: Math.max(0, Math.min(form.numberOfDesigns, Number(e.target.value))),
                  })
                }
                className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Difficulty" hint="Controls region size and count">
              <Select value={cbn.difficulty} onChange={(e) => setCbn({ difficulty: e.target.value })}>
                {CBN_DIFFICULTIES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Number of colours">
              <Select
                value={String(cbn.colourCount)}
                onChange={(e) => setCbn({ colourCount: Number(e.target.value) })}
              >
                {CBN_COLOUR_COUNTS.map((n) => (
                  <option key={n} value={n}>{n} colours</option>
                ))}
              </Select>
            </Field>
            <Field label="Colour key">
              <Select value={cbn.keyPlacement} onChange={(e) => setCbn({ keyPlacement: e.target.value })}>
                {CBN_KEY_PLACEMENTS.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Palette">
            <div className="flex gap-2">
              {(
                [
                  ["ai", "AI chooses per page"],
                  ["custom", "Custom palette"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={cbn.paletteMode === id}
                  onClick={() =>
                    setCbn({
                      paletteMode: id,
                      ...(id === "custom" && cbn.customPalette.length === 0
                        ? { customPalette: DEFAULT_CBN_PALETTE.slice(0, cbn.colourCount) }
                        : {}),
                    })
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    cbn.paletteMode === id
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          {cbn.paletteMode === "custom" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: cbn.colourCount }, (_, i) => {
                const entry = cbn.customPalette[i] ?? DEFAULT_CBN_PALETTE[i % DEFAULT_CBN_PALETTE.length];
                const setEntry = (patch: Partial<{ name: string; hex: string }>) => {
                  const next = Array.from({ length: cbn.colourCount }, (_, j) =>
                    cbn.customPalette[j] ?? DEFAULT_CBN_PALETTE[j % DEFAULT_CBN_PALETTE.length],
                  );
                  next[i] = { ...next[i], ...patch };
                  setCbn({ customPalette: next });
                };
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 text-right text-xs font-bold text-stone-500">{i + 1}</span>
                    <input
                      type="color"
                      value={entry.hex}
                      onChange={(e) => setEntry({ hex: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-stone-300"
                    />
                    <TextInput value={entry.name} onChange={(e) => setEntry({ name: e.target.value })} />
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-stone-500">
            Colour-by-numbers artwork is generated as clean enclosed regions;
            the numbers and colour key are added programmatically and
            validated, never left to the image AI.
          </p>
        </div>
      )}
    </Card>
  );

  const sectionStyle = (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-stone-900">
        Style & complexity
      </h2>
      <Field
        label="Illustration style"
        hint="Previews are indicative sketches — your pages are generated in this style for your niche"
        error={errors.style}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => update({ style: s.id })}
              className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${
                form.style === s.id
                  ? "border-stone-900 shadow-md"
                  : "border-stone-200 hover:border-stone-400"
              }`}
              aria-pressed={form.style === s.id}
            >
              <div className="aspect-[3/4] w-full bg-white">
                <StylePreview styleId={s.id} />
              </div>
              <span
                className={`block px-2 py-1.5 text-center text-xs font-semibold ${
                  form.style === s.id ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-700"
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </Field>
      {form.style === "custom" && (
        <Field
          label="Custom style instruction"
          hint="Describe the illustration style in your own words"
          error={errors.customStyle}
        >
          <TextArea
            value={form.customStyle ?? ""}
            onChange={(e) => update({ customStyle: e.target.value })}
            placeholder="e.g. Whimsical storybook line art with soft rounded shapes"
          />
        </Field>
      )}
      <Field
        label="Image complexity"
        hint="Automatically matched to your target audience — change it to override"
        error={errors.complexity}
      >
        <div className="grid grid-cols-5 gap-2">
          {COMPLEXITY_LEVELS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                update({ complexity: c.id, complexityOverridden: true })
              }
              className={`overflow-hidden rounded-xl border-2 transition-colors ${
                form.complexity === c.id
                  ? "border-stone-900 shadow-md"
                  : "border-stone-200 hover:border-stone-400"
              }`}
              aria-pressed={form.complexity === c.id}
            >
              <div className="aspect-[3/4] w-full bg-white">
                <ComplexityPreview level={i} />
              </div>
              <span
                className={`block px-1 py-1 text-center text-[11px] font-semibold leading-tight ${
                  form.complexity === c.id
                    ? "bg-stone-900 text-white"
                    : "bg-stone-50 text-stone-700"
                }`}
              >
                {c.label}
                {c.id === recommendedComplexity && (
                  <span className="block text-[9px] font-normal opacity-80">
                    recommended
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </Field>
      {form.complexityOverridden && recommendedComplexity && (
        <button
          type="button"
          className="text-xs font-medium text-stone-500 underline hover:text-stone-800"
          onClick={() =>
            update({
              complexity: recommendedComplexity,
              complexityOverridden: false,
            })
          }
        >
          Reset to recommended for this audience
        </button>
      )}
    </Card>
  );

  const setInterior = (key: keyof InteriorOptions, value: boolean) =>
    update({ interiorOptions: { ...form.interiorOptions, [key]: value } });

  const sectionInterior = (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold text-stone-900">Interior options</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {INTERIOR_OPTION_DEFS.map((opt) => (
          <Checkbox
            key={opt.key}
            label={opt.label}
            hint={opt.hint}
            checked={Boolean(form.interiorOptions[opt.key as keyof InteriorOptions])}
            onChange={(e) =>
              setInterior(opt.key as keyof InteriorOptions, e.target.checked)
            }
          />
        ))}
      </div>
    </Card>
  );

  const sections = [sectionDetails, sectionFormat, sectionStyle, sectionInterior];

  // --- Render ------------------------------------------------------------
  if (mode === "edit") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-end text-xs text-stone-500">
          {saveState === "saving" && <span>Saving…</span>}
          {saveState === "saved" && <span className="text-emerald-600">All changes saved</span>}
          {saveState === "error" && (
            <span className="text-red-600">Autosave failed — check your connection</span>
          )}
        </div>
        {project && (
          <BookConceptCard projectId={project.id} initialConcept={project.bookConcept} />
        )}
        {sections.map((s, i) => (
          <div key={i}>{s}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Wizard step indicator */}
      <ol className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${
                i === step
                  ? "bg-stone-900 text-white"
                  : i < step
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-stone-200 text-stone-500"
              }`}
            >
              <span>{i + 1}</span> {s.title}
            </button>
          </li>
        ))}
      </ol>

      {sections[step]}

      {serverError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <div className="flex justify-between">
        <Button
          variant="secondary"
          type="button"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← Back
        </Button>
        {step < WIZARD_STEPS.length - 1 ? (
          <Button type="button" onClick={nextStep}>
            Next →
          </Button>
        ) : (
          <Button type="button" disabled={submitting} onClick={submitCreate}>
            {submitting ? "Creating…" : "Create Project"}
          </Button>
        )}
      </div>
    </div>
  );
}
