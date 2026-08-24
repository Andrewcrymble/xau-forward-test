// ---------------------------------------------------------------------------
// COLOURING PAGE MASTER RULES
//
// The single source of truth for every colouring-page image-generation
// prompt. These rules are MANDATORY and must never be duplicated or
// re-written elsewhere in the codebase — always import from this module.
// ---------------------------------------------------------------------------

/**
 * This exact instruction MUST be included verbatim in every colouring-page
 * generation prompt.
 */
export const COLOURING_PAGE_FORMAT_INSTRUCTION =
  "ONE standalone colouring page, portrait 8.5 × 11 inch US Letter proportions (approximately 1:1.294 aspect ratio). Do not create a square image, collage, grid, multiple panels or multiple colouring pages.";

/** The full mandatory rule set appended to every colouring-page prompt. */
export const COLOURING_PAGE_MASTER_RULES = [
  COLOURING_PAGE_FORMAT_INSTRUCTION,
  "Portrait orientation only.",
  "Exactly ONE colouring page per generated image.",
  "Never create a grid, collage, or multiple scenes or panels.",
  "Pure white background.",
  "Clean black line art only — no colour, no grey, no shading, no gradients.",
  "Bold, smooth, continuous outlines with consistent line weight — every shape fully enclosed by clean, clearly defined, unbroken lines that are easy to colour inside.",
  "No sketchy, scratchy, hatched, cross-hatched, stippled, dotted, broken or double lines; no pencil, charcoal or watercolour texture.",
  "No solid black backgrounds; avoid excessive solid-black filled areas.",
  "Crisp, high-resolution line work.",
  "No page numbers, captions, labels, text, logos or watermarks.",
  "All important artwork must remain safely inside the page, with a generous white safety margin around all four edges.",
  "Nothing important should touch or cross the trim edge.",
  "Maintain a consistent illustration style throughout the entire project.",
  "Match line complexity to the target age/audience.",
] as const;

import type { BookStyleProfile } from "@/lib/types";

export interface PagePromptContext {
  /** Project style instruction (resolved preset text or custom style). */
  styleInstruction: string;
  /** Human-readable target audience, e.g. "children ages 4–8". */
  audienceDescription: string;
  /** The individual page concept description. */
  pageConcept: string;
  /** Comma-separated emotional tones for the whole book. */
  tones?: string | null;
  /** Recurring imagery direction for the whole book. */
  artworkTheme?: string | null;
  /** Creative brief from the Book Concept builder. */
  creativeBrief?: string | null;
  /** Persistent Book Style Profile — included so every page matches. */
  styleProfile?: BookStyleProfile | null;
  /** Text intentionally part of the artwork (e.g. a Bible verse + reference). */
  pageText?: string | null;
  /** Short titles/summaries of previously planned pages, for de-duplication. */
  previousPageSummaries?: string[];
}

function styleProfileSection(p: BookStyleProfile): string {
  return [
    "BOOK STYLE PROFILE — every page of this book must follow this exact art direction so all pages look like the same professionally illustrated book:",
    `- Line thickness: ${p.lineThickness}`,
    `- Level of detail: ${p.levelOfDetail}`,
    `- Decorative style: ${p.decorativeStyle}`,
    `- Characters: ${p.characterStyle}`,
    `- Botanical elements: ${p.botanicalStyle}`,
    `- Landscapes: ${p.landscapeStyle}`,
    `- Architecture: ${p.architecturalStyle}`,
    `- Borders/framing: ${p.framingStyle}`,
    `- White space: ${p.whiteSpace}`,
    `- Overall aesthetic: ${p.overallAesthetic}`,
    p.recurringMotifs.length > 0
      ? `- Recurring motifs to draw from: ${p.recurringMotifs.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface CbnPromptContext {
  pageConcept: string;
  styleInstruction: string;
  audienceDescription: string;
  /** Difficulty prompt text, e.g. "large clear enclosed shapes, ~20-35 regions". */
  difficultyInstruction: string;
  colourCount: number;
  /** Palette to use, when the book uses a custom palette. */
  paletteDescription?: string | null;
  creativeBrief?: string | null;
  styleProfile?: BookStyleProfile | null;
}

/**
 * Prompt for the colour-by-numbers BASE artwork: a flat-colour illustration
 * with clean enclosed shapes. The numbers, outlines and colour key are added
 * PROGRAMMATICALLY afterwards — the image AI must never draw numbers.
 */
export function buildCbnArtworkPrompt(ctx: CbnPromptContext): string {
  const sections: string[] = [
    `Flat colour illustration for a colour-by-numbers colouring page: ${ctx.pageConcept}`,
    `Illustration style: ${ctx.styleInstruction}. Target audience: ${ctx.audienceDescription}.`,
    [
      "COLOUR-BY-NUMBERS ARTWORK RULES:",
      `- Built entirely from clearly separated FLAT solid-colour shapes — like a paint-by-numbers template or cut-paper collage.`,
      `- Use exactly ${ctx.colourCount} distinct flat colours${ctx.paletteDescription ? ` from this palette: ${ctx.paletteDescription}` : ""}.`,
      `- ${ctx.difficultyInstruction}.`,
      "- Every shape is a clean enclosed area with crisp edges; no ambiguous boundaries.",
      "- NO gradients, NO shading, NO texture, NO outlines drawn around shapes, NO tiny slivers.",
      "- NO numbers, NO letters, NO text, NO labels anywhere — numbering is added separately.",
      "- Plain white background around the illustration; generous white margin on all edges.",
    ].join("\n"),
  ];
  if (ctx.creativeBrief?.trim()) {
    sections.push(`CREATIVE BRIEF for the whole book:\n${ctx.creativeBrief.trim()}`);
  }
  if (ctx.styleProfile) {
    sections.push(styleProfileSection(ctx.styleProfile));
  }
  sections.push(COLOURING_PAGE_FORMAT_INSTRUCTION);
  return sections.join("\n\n");
}

/**
 * Composes a complete image-generation prompt for one colouring page:
 * master rules + project style + book style profile + audience + page
 * concept + duplicate avoidance. Every image provider must be fed prompts
 * built here.
 */
export function buildColouringPagePrompt(ctx: PagePromptContext): string {
  const sections: string[] = [
    `Colouring book page illustration. ${ctx.pageConcept}`,
    `Illustration style: ${ctx.styleInstruction}`,
    `Target audience: ${ctx.audienceDescription}. Match the complexity of the line work to this audience.`,
  ];

  if (ctx.tones?.trim()) {
    sections.push(`Emotional tone of the book: ${ctx.tones.trim()}. The page should communicate this feeling.`);
  }
  if (ctx.artworkTheme?.trim()) {
    sections.push(`The book's recurring imagery includes: ${ctx.artworkTheme.trim()}.`);
  }
  if (ctx.creativeBrief?.trim()) {
    sections.push(`CREATIVE BRIEF for the whole book:\n${ctx.creativeBrief.trim()}`);
  }
  if (ctx.styleProfile) {
    sections.push(styleProfileSection(ctx.styleProfile));
  }
  if (ctx.pageText?.trim()) {
    sections.push(
      "INTENTIONAL TEXT: this page intentionally includes the following text as part of the artwork: " +
        `"${ctx.pageText.trim()}". Render this text EXACTLY as given, in elegant hand-lettered outline style suitable for colouring, well inside the safe margins. ` +
        "Apart from this exact text, add no other words.",
    );
  }

  if (ctx.previousPageSummaries && ctx.previousPageSummaries.length > 0) {
    sections.push(
      "Avoid duplicating the composition, camera angle, central layout or background of the book's other pages, which include: " +
        ctx.previousPageSummaries.join("; ") +
        ". Keep the style consistent but make this composition distinct.",
    );
  }

  sections.push("MANDATORY RULES:\n- " + COLOURING_PAGE_MASTER_RULES.join("\n- "));

  return sections.join("\n\n");
}
