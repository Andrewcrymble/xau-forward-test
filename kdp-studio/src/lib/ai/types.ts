// AI provider abstraction. The application never talks to a vendor API
// directly — always through these interfaces, so providers can be added or
// swapped via configuration. API keys exist server-side only.

import type { BookStyleProfile, NicheScores, NicheSeriesIdea } from "@/lib/types";

/** One planned colouring-page concept, before it is stored. */
export interface PageConceptDraft {
  title: string;
  concept: string;
  /** "standard" | "colour_by_numbers" — set in mixed-mode plans. */
  pageType?: string;
  /** Text intentionally part of the artwork (e.g. a Bible verse + reference). */
  pageText?: string | null;
}

export interface BookPlanRequest {
  niche: string;
  subNiche?: string | null;
  specificAngle?: string | null;
  description?: string | null;
  /** Human-readable audience, e.g. "adults". */
  audience: string;
  /** Style description used for planning context. */
  style: string;
  /** Complexity description. */
  complexity: string;
  /** Comma-separated emotional tones, e.g. "hopeful, peaceful". */
  tones?: string | null;
  /** Recurring imagery direction. */
  artworkTheme?: string | null;
  /** Creative brief from the Book Concept builder, when built. */
  creativeBrief?: string | null;
  /** Number of unique page concepts to produce. */
  count: number;
  /** Mixed-mode: how many of the concepts should be colour-by-numbers pages
   *  (the planner picks the most suitable subjects — bold enclosed shapes). */
  cbnCount?: number;
  /** Scripture settings — when set, each page concept includes a verse. */
  bible?: {
    /** Human-readable translation, e.g. "KJV". */
    translation: string;
    /** Verse theme labels, e.g. ["Hope", "Strength"]. */
    themes: string[];
    includeVerseText: boolean;
    includeReference: boolean;
  } | null;
  /** Titles that already exist and must not be duplicated (for top-ups/replacements). */
  avoidTitles?: string[];
}

/** Usage/cost info reported by a provider call, for GenerationLog. */
export interface TextUsage {
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface BookPlanResult {
  concepts: PageConceptDraft[];
  usage: TextUsage;
}

export interface ListingRequest {
  bookTitle: string;
  subtitle?: string | null;
  author?: string | null;
  niche: string;
  description?: string | null;
  audience: string;
  style: string;
  pageCount: number;
  /** A sample of page titles so the copy reflects real content. */
  pageTitles: string[];
}

export interface ListingDraft {
  titleSuggestions: string[];
  title: string;
  subtitle: string;
  description: string;
  bulletPoints: string[];
  keywords: string[];
  /** Three suggested KDP browse category paths (broad → specific). */
  categories: string[];
  audience: string;
  backCoverDescription: string;
  shortPromo: string;
}

// ---------------------------------------------------------------------------
// Book concept builder
// ---------------------------------------------------------------------------

export interface BookConceptRequest {
  niche: string;
  subNiche?: string | null;
  specificAngle?: string | null;
  description?: string | null;
  audience: string;
  tones?: string | null;
  artworkTheme?: string | null;
  style: string;
  complexity: string;
  pageCount: number;
  colouringMode: string;
}

export interface BookConceptDraft {
  creativeBrief: string;
  styleProfile: BookStyleProfile;
}

// ---------------------------------------------------------------------------
// Niche discovery — outputs are AI CONCEPT ANALYSIS, never market data.
// ---------------------------------------------------------------------------

export interface NicheDiscoveryRequest {
  broadTopic: string;
  /** "amazon_com" | "amazon_co_uk" | "both" | free text */
  market?: string | null;
  /** Human-readable audience or "let the AI decide". */
  audience?: string | null;
  /** Book type preference or "let the AI decide". */
  bookType?: string | null;
  count: number;
  /** For GO DEEPER: the niche path being narrowed (broad → specific). */
  parentPath?: string[];
  /** For COMBINE: the second topic to cross with. */
  combineWith?: string | null;
  /** Names already produced/saved — avoid duplicating them. */
  avoidNames?: string[];
}

export interface NicheCardDraft {
  name: string;
  /** Niche tree path, broad → specific (last entry = final niche). */
  path: string[];
  audience: string;
  concept: string;
  artwork: string;
  bookType: string;
  pageCount: number;
  complexity: string;
  difficulty: string;
  positioning: string;
  giftPotential: string;
  seriesPotential: string;
  scores: NicheScores;
}

export interface TextAIProvider {
  readonly name: string;
  /** Generate `count` unique, non-repetitive page concepts for a book. */
  generateBookPlan(req: BookPlanRequest): Promise<BookPlanResult>;
  /** Generate ONE fresh concept avoiding the given existing titles. */
  generateReplacementConcept(
    req: Omit<BookPlanRequest, "count">,
  ): Promise<{ concept: PageConceptDraft; usage: TextUsage }>;
  /** Generate complete Amazon listing copy for the book. */
  generateListing(
    req: ListingRequest,
  ): Promise<{ listing: ListingDraft; usage: TextUsage }>;
  /** Build the persistent creative brief + Book Style Profile. */
  generateBookConcept(
    req: BookConceptRequest,
  ): Promise<{ concept: BookConceptDraft; usage: TextUsage }>;
  /** Discover specific niche opportunities from a broad topic. */
  discoverNiches(
    req: NicheDiscoveryRequest,
  ): Promise<{ niches: NicheCardDraft[]; usage: TextUsage }>;
  /** Suggest a book series built around one niche. */
  generateNicheSeries(
    niche: NicheCardDraft | { name: string; concept?: string | null; audience?: string | null },
  ): Promise<{ series: NicheSeriesIdea; usage: TextUsage }>;
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export interface ImageGenerationRequest {
  /** Complete prompt (already includes the master colouring-page rules). */
  prompt: string;
  /** Seed hint for deterministic placeholder providers (page number). */
  seed?: number;
  /** Placeholder providers render differently per variant; real providers
   *  rely on the prompt alone. "cbn-flat" is the flat-colour base artwork
   *  for colour-by-numbers pages. */
  variant?: "line-art" | "cover" | "cbn-flat";
}

export interface GeneratedImage {
  /** Raw image bytes as returned by the provider. */
  data: Buffer;
  contentType: string;
  provider: string;
  model: string;
  /** Estimated cost in USD for this single generation, when known. */
  estimatedCost?: number;
}

export interface ImageAIProvider {
  readonly name: string;
  /** Generate exactly ONE image for ONE colouring page. */
  generateImage(req: ImageGenerationRequest): Promise<GeneratedImage>;
}
