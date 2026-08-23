"use client";

// New Colouring Book wizard (create mode) and project Setup screen (edit
// mode). Edit mode autosaves with a debounce; create mode walks through
// wizard steps and POSTs once at the end.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMPLEXITY_LEVELS,
  DEFAULT_COMPLEXITY_FOR_AUDIENCE,
  INTERIOR_OPTION_DEFS,
  MAX_PAGE_COUNT,
  MIN_PAGE_COUNT,
  PAGE_COUNT_PRESETS,
  STYLES,
  TARGET_AUDIENCES,
} from "@/lib/config/book-options";
import { TRIM_SIZES } from "@/lib/config/kdp-spec";
import {
  projectCreateSchema,
  type ProjectCreateInput,
} from "@/lib/validation/project";
import {
  DEFAULT_INTERIOR_OPTIONS,
  type ApiResponse,
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
  { title: "Book details", fields: ["name", "title", "subtitle", "niche", "description", "targetAudience", "customAudience"] },
  { title: "Pages & size", fields: ["numberOfDesigns", "trimSize"] },
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
      <Field label="Niche / topic" error={errors.niche}>
        <TextInput
          value={form.niche}
          onChange={(e) => update({ niche: e.target.value })}
          placeholder="e.g. Famous European cities and landmarks"
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
    </Card>
  );

  const sectionStyle = (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-stone-900">
        Style & complexity
      </h2>
      <Field label="Illustration style" error={errors.style}>
        <Select
          value={form.style}
          onChange={(e) => update({ style: e.target.value })}
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
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
        <Select
          value={form.complexity}
          onChange={(e) =>
            update({ complexity: e.target.value, complexityOverridden: true })
          }
        >
          {COMPLEXITY_LEVELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.id === recommendedComplexity ? " (recommended)" : ""}
            </option>
          ))}
        </Select>
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
