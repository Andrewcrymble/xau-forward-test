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
  { id: "women", label: "Women", promptText: "adult women" },
  { id: "men", label: "Men", promptText: "adult men" },
  { id: "seniors", label: "Seniors", promptText: "older adults and seniors" },
  { id: "families", label: "Families", promptText: "families colouring together" },
  { id: "christian_women", label: "Christian women", promptText: "Christian women" },
  { id: "christian_families", label: "Christian families", promptText: "Christian families" },
  { id: "beginners", label: "Beginners", promptText: "colouring beginners of any age" },
  { id: "custom", label: "Custom" },
];

/** Multi-select emotional tones for the book's overall feel. */
export const EMOTIONAL_TONES: OptionDef[] = [
  { id: "hopeful", label: "Hopeful" },
  { id: "encouraging", label: "Encouraging" },
  { id: "peaceful", label: "Peaceful" },
  { id: "joyful", label: "Joyful" },
  { id: "comforting", label: "Comforting" },
  { id: "inspirational", label: "Inspirational" },
  { id: "reflective", label: "Reflective" },
  { id: "faith_filled", label: "Faith-filled" },
  { id: "fun", label: "Fun" },
  { id: "educational", label: "Educational" },
  { id: "relaxing", label: "Relaxing" },
  { id: "cozy", label: "Cozy" },
  { id: "adventurous", label: "Adventurous" },
];

export function tonesPromptText(toneIds: string[]): string {
  const labels = toneIds
    .map((id) => EMOTIONAL_TONES.find((t) => t.id === id)?.label.toLowerCase())
    .filter(Boolean);
  return labels.join(", ");
}

/** Bible translation options for scripture colouring books. Modern
 *  translations carry publisher licensing terms — the UI must surface this
 *  and exact wording must never be invented (flag for verification instead). */
export const BIBLE_TRANSLATIONS: OptionDef[] = [
  { id: "kjv", label: "KJV (public domain)" },
  { id: "nkjv", label: "NKJV (check licence)" },
  { id: "niv", label: "NIV (check licence)" },
  { id: "esv", label: "ESV (check licence)" },
  { id: "nlt", label: "NLT (check licence)" },
  { id: "custom", label: "Custom / own wording" },
];

export const VERSE_THEMES: OptionDef[] = [
  { id: "hope", label: "Hope" },
  { id: "strength", label: "Strength" },
  { id: "courage", label: "Courage" },
  { id: "faith", label: "Faith" },
  { id: "gods_love", label: "God's Love" },
  { id: "peace", label: "Peace" },
  { id: "comfort", label: "Comfort" },
  { id: "perseverance", label: "Perseverance" },
  { id: "trust", label: "Trust" },
  { id: "healing", label: "Healing" },
  { id: "gratitude", label: "Gratitude" },
  { id: "joy", label: "Joy" },
  { id: "prayer", label: "Prayer" },
  { id: "gods_faithfulness", label: "God's Faithfulness" },
  { id: "promises_of_god", label: "Promises of God" },
];

/** Colour-by-numbers difficulty — directly controls region size/count. */
export const CBN_DIFFICULTIES: OptionDef[] = [
  { id: "very_easy", label: "Very easy — ages 4–6", promptText: "very large simple enclosed shapes, around 8–16 big regions" },
  { id: "easy", label: "Easy — ages 6–8", promptText: "large clear enclosed shapes, around 15–28 regions" },
  { id: "medium", label: "Medium — ages 8–12", promptText: "generously sized enclosed regions, around 25–45 regions" },
  { id: "adult", label: "Adult", promptText: "smaller detailed regions, around 45–80 regions, all still practical to colour" },
  { id: "detailed_adult", label: "Detailed adult", promptText: "fine detailed regions, around 80–130 regions, none impractically small" },
];

/** Typefaces for the typeset verse/quote plaque. cssFamily is the webfont
 *  used for the on-screen preview; the print faces are bundled TTFs. */
export const VERSE_FONTS: {
  id: string;
  label: string;
  bodyFace: "serif" | "sans" | "script" | "playful";
  refFace: "serif-bold" | "sans-bold";
  cssFamily: string;
  /** Line-height multiplier — script faces need more breathing room. */
  lineHeight: number;
}[] = [
  { id: "serif", label: "Classic serif", bodyFace: "serif", refFace: "serif-bold", cssFamily: "'Liberation Serif', Georgia, serif", lineHeight: 1.4 },
  { id: "sans", label: "Clean modern", bodyFace: "sans", refFace: "sans-bold", cssFamily: "'Liberation Sans', Arial, sans-serif", lineHeight: 1.4 },
  { id: "script", label: "Handwritten script", bodyFace: "script", refFace: "sans-bold", cssFamily: "'Pacifico', cursive", lineHeight: 1.65 },
  { id: "playful", label: "Playful (great for kids)", bodyFace: "playful", refFace: "sans-bold", cssFamily: "'Chewy', cursive", lineHeight: 1.5 },
];

export function verseFont(id: string | null | undefined) {
  return VERSE_FONTS.find((f) => f.id === id) ?? VERSE_FONTS[0];
}

export const CBN_COLOUR_COUNTS = [4, 5, 6, 8, 10, 12];

export const CBN_KEY_PLACEMENTS: OptionDef[] = [
  { id: "bottom", label: "Bottom of each page" },
  { id: "none", label: "No key on artwork (clean page)" },
];

/** Sensible starting palette for custom colour-by-numbers palettes. */
export const DEFAULT_CBN_PALETTE: { name: string; hex: string }[] = [
  { name: "Yellow", hex: "#f5d90a" },
  { name: "Light Blue", hex: "#7ec8e3" },
  { name: "Dark Blue", hex: "#1d4e89" },
  { name: "Green", hex: "#4caf50" },
  { name: "Red", hex: "#e53935" },
  { name: "Purple", hex: "#8e44ad" },
  { name: "Orange", hex: "#f39c12" },
  { name: "Brown", hex: "#795548" },
  { name: "Pink", hex: "#f48fb1" },
  { name: "Teal", hex: "#009688" },
  { name: "Grey", hex: "#9e9e9e" },
  { name: "Black", hex: "#212121" },
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
