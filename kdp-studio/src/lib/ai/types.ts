// AI provider abstraction. The application never talks to a vendor API
// directly — always through these interfaces, so providers can be added or
// swapped via configuration. API keys exist server-side only.

/** One planned colouring-page concept, before it is stored. */
export interface PageConceptDraft {
  title: string;
  concept: string;
}

export interface BookPlanRequest {
  niche: string;
  description?: string | null;
  /** Human-readable audience, e.g. "adults". */
  audience: string;
  /** Style description used for planning context. */
  style: string;
  /** Complexity description. */
  complexity: string;
  /** Number of unique page concepts to produce. */
  count: number;
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
  audience: string;
  backCoverDescription: string;
  shortPromo: string;
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
   *  rely on the prompt alone. */
  variant?: "line-art" | "cover";
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
