// ---------------------------------------------------------------------------
// Book setup options — the single source for audiences, page counts,
// complexity levels, styles and interior options shown in the setup UI and
// used when composing AI prompts.
// ---------------------------------------------------------------------------

export interface OptionDef {
  id: string;
  label: string;
  /** Text used when composing AI prompts. */
  promptText?: string;
}

export const TARGET_AUDIENCES: OptionDef[] = [
  { id: "ages_3_5", label: "Ages 3–5", promptText: "young children ages 3–5" },
  { id: "ages_4_8", label: "Ages 4–8", promptText: "children ages 4–8" },
  { id: "ages_6_10", label: "Ages 6–10", promptText: "children ages 6–10" },
  { id: "ages_8_12", label: "Ages 8–12", promptText: "older children ages 8–12" },
  { id: "teens", label: "Teens", promptText: "teenagers" },
  { id: "adults", label: "Adults", promptText: "adults" },
  { id: "custom", label: "Custom" },
];

export const PAGE_COUNT_PRESETS = [25, 30, 40, 50, 75, 100];
export const MIN_PAGE_COUNT = 1;
export const MAX_PAGE_COUNT = 300;

export const COMPLEXITY_LEVELS: OptionDef[] = [
  { id: "very_simple", label: "Very simple", promptText: "very simple, thick bold outlines with large shapes and minimal detail" },
  { id: "simple", label: "Simple", promptText: "simple line art with bold outlines and limited detail" },
  { id: "medium", label: "Medium", promptText: "moderately detailed line art, balanced between simplicity and detail" },
  { id: "detailed", label: "Detailed", promptText: "detailed line art with fine lines and rich detail" },
  { id: "highly_detailed", label: "Highly detailed", promptText: "highly detailed, intricate line art with very fine lines" },
];

/**
 * Complexity automatically adapts to the selected audience (the user can
 * still override it manually).
 */
export const DEFAULT_COMPLEXITY_FOR_AUDIENCE: Record<string, string> = {
  ages_3_5: "very_simple",
  ages_4_8: "simple",
  ages_6_10: "medium",
  ages_8_12: "medium",
  teens: "detailed",
  adults: "highly_detailed",
  custom: "medium",
};

export const STYLES: OptionDef[] = [
  { id: "clean_childrens", label: "Clean children's colouring book", promptText: "clean children's colouring book style" },
  { id: "cute_cartoon", label: "Cute cartoon", promptText: "cute cartoon style with friendly rounded characters" },
  { id: "bold_simple", label: "Bold simple outlines", promptText: "bold, simple outline style with thick strokes" },
  { id: "detailed_realistic", label: "Detailed realistic line art", promptText: "detailed, realistic line art" },
  { id: "architectural", label: "Architectural colouring", promptText: "precise architectural line drawing style" },
  { id: "mandala", label: "Mandala / intricate", promptText: "intricate mandala-style patterned line art" },
  { id: "vintage", label: "Vintage line illustration", promptText: "vintage engraved-style line illustration" },
  { id: "custom", label: "Custom style" },
];

export interface InteriorOptionDef {
  key: string;
  label: string;
  hint?: string;
}

export const INTERIOR_OPTION_DEFS: InteriorOptionDef[] = [
  { key: "singleSided", label: "Single-sided colouring pages", hint: "Each illustration prints on the front of a leaf only" },
  { key: "blankPageBehindEach", label: "Insert blank page behind each colouring page", hint: "Helps prevent marker bleed-through" },
  { key: "includeTitlePage", label: "Include title page" },
  { key: "includeCopyrightPage", label: "Include copyright page" },
  { key: "includeBelongsToPage", label: 'Include "This Book Belongs To" page' },
  { key: "includeTestColourPage", label: "Include test-colour page" },
  { key: "includeThankYouPage", label: "Include final thank-you page" },
];

/** Resolve display + prompt helpers */

export function audienceLabel(id: string, customAudience?: string | null): string {
  if (id === "custom" && customAudience) return customAudience;
  return TARGET_AUDIENCES.find((a) => a.id === id)?.label ?? id;
}

export function audiencePromptText(id: string, customAudience?: string | null): string {
  if (id === "custom") return customAudience || "a general audience";
  const def = TARGET_AUDIENCES.find((a) => a.id === id);
  return def?.promptText ?? def?.label ?? id;
}

export function styleLabel(id: string, customStyle?: string | null): string {
  if (id === "custom" && customStyle) return customStyle;
  return STYLES.find((s) => s.id === id)?.label ?? id;
}

export function stylePromptText(id: string, customStyle?: string | null): string {
  if (id === "custom") return customStyle || "clean colouring book line art";
  const def = STYLES.find((s) => s.id === id);
  return def?.promptText ?? def?.label ?? id;
}

export function complexityPromptText(id: string): string {
  const def = COMPLEXITY_LEVELS.find((c) => c.id === id);
  return def?.promptText ?? def?.label ?? id;
}
