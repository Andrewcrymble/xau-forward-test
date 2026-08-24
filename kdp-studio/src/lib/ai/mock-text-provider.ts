import type {
  BookConceptDraft,
  BookConceptRequest,
  BookPlanRequest,
  BookPlanResult,
  ListingDraft,
  ListingRequest,
  NicheCardDraft,
  NicheDiscoveryRequest,
  PageConceptDraft,
  TextAIProvider,
  TextUsage,
} from "./types";
import type { NicheSeriesIdea } from "@/lib/types";

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

  private makeConcept(
    req: Pick<BookPlanRequest, "niche" | "bible" | "cbnCount" | "count">,
    index: number,
  ): PageConceptDraft {
    const pattern = SUBJECT_PATTERNS[index % SUBJECT_PATTERNS.length];
    const variation = Math.floor(index / SUBJECT_PATTERNS.length) + 1;
    const scene = pattern.replace("{niche}", req.niche);
    const suffix = variation > 1 ? ` (variation ${variation})` : "";
    const cbn = (req.cbnCount ?? 0) > 0 && index < (req.cbnCount ?? 0);
    return {
      title: `Sample page ${index + 1}${suffix}`,
      concept:
        `${scene.charAt(0).toUpperCase()}${scene.slice(1)}.` +
        ` Sample concept — replace with a real AI provider by adding an API key in the app's environment settings.`,
      pageType: cbn ? "colour_by_numbers" : "standard",
      pageText: req.bible
        ? req.bible.includeVerseText
          ? `Sample verse text ${index + 1} — Book ${index + 1}:${(index % 20) + 1} (${req.bible.translation})`
          : `Book ${index + 1}:${(index % 20) + 1}${req.bible.includeReference ? ` (${req.bible.translation})` : ""}`
        : null,
    };
  }

  async generateBookPlan(req: BookPlanRequest): Promise<BookPlanResult> {
    const start = req.avoidTitles?.length ?? 0;
    const concepts = Array.from({ length: req.count }, (_, i) =>
      this.makeConcept(req, start + i),
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

  async generateBookConcept(
    req: BookConceptRequest,
  ): Promise<{ concept: BookConceptDraft; usage: TextUsage }> {
    const motifs = (req.artworkTheme || `${req.niche} scenes, decorative borders, botanical accents`)
      .split(/,|\band\b/)
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 8);
    const concept: BookConceptDraft = {
      creativeBrief:
        `SAMPLE BRIEF — add an AI provider key for a real creative direction. ` +
        `Create a ${req.complexity} colouring book about ${req.niche}` +
        (req.subNiche ? `, focused on ${req.subNiche}` : "") +
        (req.specificAngle ? `. Positioning: ${req.specificAngle}` : "") +
        `. Aimed at ${req.audience}` +
        (req.tones ? `, with an overall ${req.tones} feel` : "") +
        `. Every page should feel like part of one professionally illustrated collection: ` +
        `consistent line style throughout, substantial variety in composition, subject and viewpoint between pages, ` +
        `and recurring visual motifs that tie the book together.`,
      styleProfile: {
        lineThickness: "consistent medium-weight black outlines",
        decorativeStyle: "simple decorative flourishes used sparingly",
        characterStyle: "friendly, well-proportioned characters when present",
        botanicalStyle: "clean stylised leaves and flowers",
        landscapeStyle: "layered foreground/midground/background scenes",
        architecturalStyle: "simplified but recognisable structures",
        framingStyle: "occasional thin decorative borders, most pages unframed",
        whiteSpace: "generous breathing room around the main subject",
        overallAesthetic: `cohesive ${req.style} aesthetic`,
        recurringMotifs: motifs,
        levelOfDetail: req.complexity,
      },
    };
    return {
      concept,
      usage: { provider: this.name, model: "sample-generator", tokensUsed: 0 },
    };
  }

  async discoverNiches(
    req: NicheDiscoveryRequest,
  ): Promise<{ niches: NicheCardDraft[]; usage: TextUsage }> {
    const t = req.broadTopic.trim() || "Colouring";
    const base = req.parentPath && req.parentPath.length > 0 ? req.parentPath : [t];
    const angles = [
      ["for Kids", "Children 6–8", "standard"],
      ["for Adults", "Adults", "standard"],
      ["Colour by Numbers", "Children 8–12", "colour_by_numbers"],
      ["Through the Seasons", "Adults", "mixed"],
      ["at Christmas", "Families", "standard"],
      ["by Night", "Adults", "standard"],
      ["for Beginners", "Colouring beginners", "standard"],
      ["Little Details", "Adults", "standard"],
      ["Big & Bold", "Children 4–6", "standard"],
      ["A Gift Edition", "Gift buyers", "mixed"],
    ] as const;
    const combined = req.combineWith?.trim();
    const niches: NicheCardDraft[] = Array.from(
      { length: Math.min(req.count, angles.length) },
      (_, i) => {
        const [angle, aud, type] = angles[i];
        const name = combined ? `${t} & ${combined} ${angle}` : `${t} ${angle}`;
        return {
          name,
          path: [...base, combined ? `${t} & ${combined}` : angle, name],
          audience: req.audience && req.audience !== "let_ai_decide" ? req.audience : aud,
          concept: `SAMPLE idea — add an AI key for real niche discovery. A ${type.replace(/_/g, " ")} colouring book: ${name}.`,
          artwork: `Signature ${t.toLowerCase()} imagery with varied compositions and settings.`,
          bookType: req.bookType && req.bookType !== "let_ai_decide" ? req.bookType : type,
          pageCount: 30 + (i % 3) * 10,
          complexity: aud.startsWith("Children") ? "simple" : "detailed",
          difficulty: i % 2 ? "moderate to execute well" : "straightforward",
          positioning: `A ${aud.toLowerCase()}-focused ${t.toLowerCase()} colouring book differentiated by its "${angle}" angle.`,
          giftPotential: i % 3 === 0 ? "strong gift angle" : "moderate",
          seriesPotential: "extends naturally into sibling titles",
          scores: {
            specificity: 5 + (i % 5),
            visualPotential: 6 + (i % 4),
            variety: 5 + ((i + 1) % 5),
            audienceClarity: 6 + (i % 4),
            giftPotential: 4 + (i % 6),
            seriesPotential: 5 + (i % 5),
            cbnSuitability: type === "colour_by_numbers" ? 8 : 4 + (i % 4),
            overall: 5 + (i % 5),
          },
        };
      },
    );
    return {
      niches,
      usage: { provider: this.name, model: "sample-generator", tokensUsed: 0 },
    };
  }

  async generateNicheSeries(niche: {
    name: string;
    concept?: string | null;
    audience?: string | null;
  }): Promise<{ series: NicheSeriesIdea; usage: TextUsage }> {
    return {
      series: {
        name: `${niche.name} Series (sample)`,
        books: [
          `${niche.name} — Book One`,
          `${niche.name} — Through the Seasons`,
          `${niche.name} — At Christmas`,
          `${niche.name} — Big & Bold Edition`,
          `${niche.name} — The Gift Collection`,
        ],
      },
      usage: { provider: this.name, model: "sample-generator", tokensUsed: 0 },
    };
  }
}
