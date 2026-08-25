// COLOURJOY INTERIOR STYLE ENGINE — the house styles every book is built
// in. Each style bundles the art direction injected into every prompt, the
// planner guidance, and the complexity distribution across the book.
// "Auto" resolves a style from the audience/complexity already chosen.
// Colour-by-numbers is its own production system (colouringMode), not a
// style here.

export interface ColourJoyStyle {
  id: string;
  label: string;
  /** Short UI hint: who this style suits. */
  suits: string;
  /** Art direction injected into EVERY interior page prompt. */
  characteristics: string;
  /** Extra instruction for the page planner. */
  planGuidance: string;
  /** Part-10 complexity distribution across the book. */
  complexityMix: string;
}

export const COLOURJOY_STYLES: ColourJoyStyle[] = [
  {
    id: "bold_easy",
    label: "Bold & Easy",
    suits: "beginners, children, seniors, relaxed colouring",
    characteristics:
      "COLOURJOY BOLD & EASY STYLE: thick, confident black outlines; large open colouring spaces; " +
      "very limited tiny detail; clear fully-closed shapes; uncluttered composition with a strong central subject; " +
      "simple background; instantly recognisable subjects. Do not overcomplicate the page.",
    planGuidance:
      "Every concept must work as a bold, simple page: one strong subject, minimal background elements, nothing fiddly.",
    complexityMix:
      "Complexity across the book: about 70% easy pages and 30% easy-medium pages — never harder.",
  },
  {
    id: "cozy_cute",
    label: "Cozy & Cute",
    suits: "cute animals, cozy scenes, seasonal and relaxing books",
    characteristics:
      "COLOURJOY COZY & CUTE STYLE: rounded, friendly forms; expressive ORIGINAL characters (never imitate " +
      "copyrighted or competitor character designs); warm visual storytelling; charming environmental details; " +
      "medium-bold outlines; satisfying colouring areas; cozy interiors and environments; playful composition.",
    planGuidance:
      "Concepts should tell warm little stories — characters doing cozy things in charming settings.",
    complexityMix:
      "Complexity across the book: about 20% easier pages, 60% medium, 20% slightly more detailed.",
  },
  {
    id: "classic",
    label: "Classic Colouring",
    suits: "landmarks, travel, vehicles, nature, general subjects",
    characteristics:
      "COLOURJOY CLASSIC STYLE: clean medium-weight lines; recognisable subjects with realistic proportions " +
      "simplified into colouring-friendly forms; moderate detail; balanced backgrounds; strong composition.",
    planGuidance:
      "Concepts should centre on recognisable, well-composed subjects with balanced supporting scenery.",
    complexityMix:
      "Complexity across the book: about 20% easier pages, 60% medium, 20% more detailed.",
  },
  {
    id: "detailed_adult",
    label: "Detailed Adult",
    suits: "botanical, architecture, intricate nature and pattern books",
    characteristics:
      "COLOURJOY DETAILED ADULT STYLE: finer controlled lines; intricate but MEANINGFUL detail; sophisticated " +
      "composition; many colouring opportunities; decorative elements. Avoid microscopic detail that reproduces " +
      "poorly in print — every region must remain practical to colour.",
    planGuidance:
      "Concepts can be rich and layered, but every element must earn its place — intricate, never chaotic.",
    complexityMix:
      "Complexity across the book: about 20% medium pages, 60% detailed, 20% highly detailed but still practical to colour.",
  },
];

export const COLOURJOY_STYLE_IDS = [
  "auto",
  ...COLOURJOY_STYLES.map((s) => s.id),
] as const;

/**
 * Resolve the book's interior style. Explicit choice wins; "auto" derives a
 * style from the audience and complexity the user already set.
 */
export function resolveColourJoyStyle(project: {
  colourjoyStyle?: string | null;
  targetAudience: string;
  complexity: string;
  style: string;
}): ColourJoyStyle {
  const explicit = COLOURJOY_STYLES.find((s) => s.id === project.colourjoyStyle);
  if (explicit) return explicit;
  const byId = (id: string) => COLOURJOY_STYLES.find((s) => s.id === id)!;
  if (["very_simple", "simple"].includes(project.complexity)) return byId("bold_easy");
  if (["ages_3_5", "ages_4_8", "seniors", "beginners"].includes(project.targetAudience)) {
    return byId("bold_easy");
  }
  if (["detailed", "highly_detailed"].includes(project.complexity)) return byId("detailed_adult");
  if (project.style === "cute_cartoon") return byId("cozy_cute");
  if (["ages_6_10", "ages_8_12", "families"].includes(project.targetAudience)) {
    return byId("cozy_cute");
  }
  return byId("classic");
}
