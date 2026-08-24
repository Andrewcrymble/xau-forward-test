import type {
  BookPlanRequest,
  BookPlanResult,
  ListingDraft,
  ListingRequest,
  PageConceptDraft,
  TextAIProvider,
  TextUsage,
} from "./types";

// Built-in sample planner used when no AI provider key is configured.
// Produces varied, deterministic placeholder concepts so the whole planning
// workflow (generate → edit → reorder → approve) can be exercised without
// any API key or cost. Clearly labelled in the UI as sample output.

const SUBJECT_PATTERNS = [
  "a detailed close-up of {niche}",
  "a wide panoramic scene featuring {niche}",
  "{niche} seen from a low, dramatic angle",
  "{niche} viewed from above, bird's-eye style",
  "a peaceful everyday moment involving {niche}",
  "{niche} framed by foreground foliage",
  "a bustling, lively scene built around {niche}",
  "{niche} in a quiet early-morning setting",
  "a celebratory, festive scene around {niche}",
  "{niche} beside water with gentle reflections",
  "{niche} in a seasonal winter setting",
  "{niche} in a bright summer setting",
  "a night-time scene of {niche} with a starry sky",
  "an old-fashioned, vintage take on {niche}",
  "a whimsical, imaginative twist on {niche}",
  "{niche} with a decorative patterned border",
  "a small, charming corner scene of {niche}",
  "{niche} at the centre of a symmetrical composition",
  "a journey or path leading towards {niche}",
  "{niche} surrounded by its natural companions",
];

export class MockTextProvider implements TextAIProvider {
  readonly name = "mock";

  private makeConcept(niche: string, index: number): PageConceptDraft {
    const pattern = SUBJECT_PATTERNS[index % SUBJECT_PATTERNS.length];
    const variation = Math.floor(index / SUBJECT_PATTERNS.length) + 1;
    const scene = pattern.replace("{niche}", niche);
    const suffix = variation > 1 ? ` (variation ${variation})` : "";
    return {
      title: `Sample page ${index + 1}${suffix}`,
      concept:
        `${scene.charAt(0).toUpperCase()}${scene.slice(1)}.` +
        ` Sample concept — replace with a real AI provider by adding an API key in the app's environment settings.`,
    };
  }

  async generateBookPlan(req: BookPlanRequest): Promise<BookPlanResult> {
    const start = req.avoidTitles?.length ?? 0;
    const concepts = Array.from({ length: req.count }, (_, i) =>
      this.makeConcept(req.niche, start + i),
    );
    return {
      concepts,
      usage: { provider: this.name, model: "sample-generator", tokensUsed: 0 },
    };
  }

  async generateReplacementConcept(req: Omit<BookPlanRequest, "count">) {
    const { concepts, usage } = await this.generateBookPlan({ ...req, count: 1 });
    return { concept: concepts[0], usage };
  }

  async generateListing(
    req: ListingRequest,
  ): Promise<{ listing: ListingDraft; usage: TextUsage }> {
    const n = req.niche;
    const listing: ListingDraft = {
      titleSuggestions: [
        `The Big ${n} Colouring Book`,
        `${n}: A Colouring Adventure`,
        `Colour Your Way Through ${n}`,
        `${req.pageCount} ${n} Colouring Pages`,
      ],
      title: `${req.bookTitle} — sample listing title`,
      subtitle: req.subtitle || `${req.pageCount} Relaxing Colouring Pages for ${req.audience}`,
      description:
        `SAMPLE LISTING — add an AI provider key for real copy.\n\n` +
        `Discover ${req.pageCount} unique colouring pages celebrating ${n}. ` +
        `Each illustration is printed single-sided on bright white paper, with a ${req.style} style crafted for ${req.audience}.`,
      bulletPoints: [
        `${req.pageCount} unique single-sided colouring pages`,
        `Large 8.5 × 11 inch pages with generous margins`,
        `Designed for ${req.audience}`,
        "Includes a colour test page",
        "Sample bullet — replace with real AI copy",
      ],
      keywords: [
        `${n.toLowerCase()} colouring book`.slice(0, 40),
        "colouring pages",
        "relaxing colouring",
        "gift colouring book",
        "creative activity book",
        "single sided colouring",
        "large print colouring",
      ],
      audience: `Perfect for ${req.audience} who love ${n.toLowerCase()}.`,
      backCoverDescription:
        `${req.pageCount} beautiful ${n.toLowerCase()} colouring pages, printed single-sided for every kind of pen and pencil. Sample text — generate real copy with an AI key.`,
      shortPromo: `Unwind with ${req.pageCount} gorgeous ${n.toLowerCase()} colouring pages.`,
    };
    return {
      listing,
      usage: { provider: this.name, model: "sample-generator", tokensUsed: 0 },
    };
  }
}
