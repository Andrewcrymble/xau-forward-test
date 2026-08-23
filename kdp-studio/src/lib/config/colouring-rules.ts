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
  "No solid black backgrounds; avoid excessive solid-black filled areas.",
  "Crisp, high-resolution line work.",
  "No page numbers, captions, labels, text, logos or watermarks.",
  "All important artwork must remain safely inside the page, with a generous white safety margin around all four edges.",
  "Nothing important should touch or cross the trim edge.",
  "Maintain a consistent illustration style throughout the entire project.",
  "Match line complexity to the target age/audience.",
] as const;

export interface PagePromptContext {
  /** Project style instruction (resolved preset text or custom style). */
  styleInstruction: string;
  /** Human-readable target audience, e.g. "children ages 4–8". */
  audienceDescription: string;
  /** The individual page concept description. */
  pageConcept: string;
  /** Short titles/summaries of previously planned pages, for de-duplication. */
  previousPageSummaries?: string[];
}

/**
 * Composes a complete image-generation prompt for one colouring page:
 * master rules + project style + audience + page concept + duplicate
 * avoidance. Every image provider must be fed prompts built here.
 */
export function buildColouringPagePrompt(ctx: PagePromptContext): string {
  const sections: string[] = [
    `Colouring book page illustration. ${ctx.pageConcept}`,
    `Illustration style: ${ctx.styleInstruction}`,
    `Target audience: ${ctx.audienceDescription}. Match the complexity of the line work to this audience.`,
  ];

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
