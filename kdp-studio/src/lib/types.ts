// Shared domain types. Status values are stored as plain strings in the
// database (for SQLite/Postgres portability) and constrained here + in the
// Zod schemas (src/lib/validation).

export const PROJECT_STATUSES = [
  "setup",
  "planning",
  "plan_approved",
  "generating",
  "reviewing",
  "interior",
  "cover",
  "listing",
  "complete",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const GENERATION_STATUSES = [
  "planned",
  "queued",
  "generating",
  "ready_for_review",
  "approved",
  "failed",
  "needs_review",
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const VALIDATION_STATUSES = [
  "not_checked",
  "passed",
  "needs_review",
  "failed",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

/** Front-matter page kinds, in the user's chosen order. */
export const FRONT_MATTER_KEYS = [
  "titlePage",
  "copyrightPage",
  "belongsToPage",
  "testColourPage",
] as const;
export type FrontMatterKey = (typeof FRONT_MATTER_KEYS)[number];

/** Interior/front-matter options chosen at book setup. */
export interface InteriorOptions {
  singleSided: boolean;
  blankPageBehindEach: boolean;
  includeTitlePage: boolean;
  includeCopyrightPage: boolean;
  includeBelongsToPage: boolean;
  includeTestColourPage: boolean;
  includeThankYouPage: boolean;
  /** Order in which enabled front-matter pages appear. */
  frontMatterOrder: FrontMatterKey[];
  /** Print a small bleed-through note on blank pages (default OFF). */
  blankPageMessage: boolean;
}

export const DEFAULT_INTERIOR_OPTIONS: InteriorOptions = {
  singleSided: true,
  blankPageBehindEach: true,
  includeTitlePage: true,
  includeCopyrightPage: true,
  includeBelongsToPage: false,
  includeTestColourPage: false,
  includeThankYouPage: false,
  frontMatterOrder: ["titlePage", "copyrightPage", "belongsToPage", "testColourPage"],
  blankPageMessage: false,
};

/** Colouring mode for the whole book. */
export const COLOURING_MODES = ["standard", "colour_by_numbers", "mixed"] as const;
export type ColouringMode = (typeof COLOURING_MODES)[number];

/** Per-page type. */
export const PAGE_TYPES = ["standard", "colour_by_numbers"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** Colour-by-numbers book settings, JSON-encoded on Project.cbnSettings. */
export interface CbnSettings {
  /** Mixed mode: how many pages are colour-by-numbers (rest standard). */
  cbnPageCount: number;
  /** CBN difficulty id from CBN_DIFFICULTIES. */
  difficulty: string;
  /** Number of colours in the palette (each page's palette has exactly this many). */
  colourCount: number;
  /** "ai" lets each page pick its palette; "custom" uses customPalette. */
  paletteMode: "ai" | "custom";
  /** Custom palette [{name, hex}] — numbers are assigned 1..N in this order. */
  customPalette: { name: string; hex: string }[];
  /** Colour key placement id from CBN_KEY_PLACEMENTS. */
  keyPlacement: string;
  /** Let the plan generator decide which page concepts suit CBN (mixed mode). */
  autoSelectPages: boolean;
}

export const DEFAULT_CBN_SETTINGS: CbnSettings = {
  cbnPageCount: 10,
  difficulty: "medium",
  colourCount: 8,
  paletteMode: "ai",
  customPalette: [],
  keyPlacement: "bottom",
  autoSelectPages: true,
};

/** Scripture settings, JSON-encoded on Project.bibleSettings. */
export interface BibleSettings {
  enabled: boolean;
  /** Translation id from BIBLE_TRANSLATIONS. */
  translation: string;
  /** Verse theme ids from VERSE_THEMES. */
  themes: string[];
  includeVerseText: boolean;
  includeReference: boolean;
}

export const DEFAULT_BIBLE_SETTINGS: BibleSettings = {
  enabled: false,
  translation: "kjv",
  themes: [],
  includeVerseText: true,
  includeReference: true,
};

/** Persistent Book Style Profile — part of the book concept, injected into
 *  every image-generation prompt so all pages look like one book. */
export interface BookStyleProfile {
  lineThickness: string;
  decorativeStyle: string;
  characterStyle: string;
  botanicalStyle: string;
  landscapeStyle: string;
  architecturalStyle: string;
  framingStyle: string;
  whiteSpace: string;
  overallAesthetic: string;
  recurringMotifs: string[];
  levelOfDetail: string;
}

/** Creative direction produced by BUILD MY BOOK CONCEPT, JSON-encoded on
 *  Project.bookConcept. */
export interface BookConcept {
  creativeBrief: string;
  styleProfile: BookStyleProfile;
  builtAt: string;
}

/** Project as exposed to the UI (interiorOptions decoded from JSON). */
export interface ProjectDto {
  id: string;
  name: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  niche: string;
  subNiche: string | null;
  specificAngle: string | null;
  description: string | null;
  emotionalTones: string[];
  artworkTheme: string | null;
  bookConcept: BookConcept | null;
  colouringMode: ColouringMode;
  cbnSettings: CbnSettings;
  bibleSettings: BibleSettings;
  targetAudience: string;
  customAudience: string | null;
  trimSize: string;
  numberOfDesigns: number;
  style: string;
  customStyle: string | null;
  complexity: string;
  complexityOverridden: boolean;
  interiorOptions: InteriorOptions;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  pageCount: number;
  approvedPageCount: number;
}

/** Per-page colour-by-numbers data, JSON-encoded on ColouringPage.cbnData. */
export interface CbnPageData {
  /** Palette in number order: entry 0 is colour 1. */
  palette: { number: number; name: string; hex: string }[];
  /** Actual segmented regions with their assigned colour numbers. */
  regions: { id: number; number: number; areaPx: number }[];
  difficulty: string;
  /** Findings from the programmatic validation pass. */
  validation: string[];
}

/** Colouring page as exposed to the UI. */
export interface PageDto {
  id: string;
  pageNumber: number;
  title: string;
  concept: string;
  pageType: PageType;
  pageText: string | null;
  cbnData: CbnPageData | null;
  completedReference: string | null;
  prompt: string;
  promptEdited: boolean;
  originalImage: string | null;
  processedImage: string | null;
  /** User-uploaded reference photo the AI faithfully redraws as line art. */
  referenceImage: string | null;
  generationStatus: GenerationStatus;
  approvalStatus: ApprovalStatus;
  validationStatus: ValidationStatus;
  validationIssues: string | null;
  generationAttempts: number;
  notes: string | null;
}

/** Cover editor settings, stored as JSON on the Cover row. */
export interface CoverSettings {
  paperType: "blackWhiteWhitePaper" | "blackWhiteCreamPaper" | "colourWhitePaper";
  /** One of the COVER_FONTS registry ids (config/cover-fonts.ts). */
  titleFont: string;
  titleSize: number; // points
  /** Render the title in capitals. */
  titleCase: "normal" | "uppercase";
  titlePosition: "top" | "middle" | "bottom";
  textAlign: "left" | "center" | "right";
  /** Front-cover text colour (hex; legacy "white"/"black" values are migrated). */
  textColor: string;
  /** Legibility treatment applied to the front-cover text. */
  textEffect: "none" | "outline" | "shadow" | "plate";
  /** Colour of the outline / shadow / panel behind the text. */
  effectColor: string; // hex
  /** Spine + back cover background. */
  backgroundColor: string; // hex
  /** Back cover content: description text, or a framed grid of sample pages. */
  backLayout: "text" | "showcase";
  /** Back-cover description text size in points. */
  backTextSize: number;
  /** Semi-transparent frame (in the effect colour) behind the back-cover text. */
  backTextPanel: boolean;
  /** Keep Amazon's barcode area clear on the back cover (default ON). */
  barcodeAreaClear: boolean;
  /** Carry the front artwork across the back cover (darkened for text). */
  backArtwork: boolean;
  /** All generated artwork URLs (the Cover.artwork field is the selected one). */
  artworkVersions: string[];
}

export const DEFAULT_COVER_SETTINGS: CoverSettings = {
  paperType: "blackWhiteWhitePaper",
  titleFont: "serif",
  titleSize: 42,
  titleCase: "normal",
  titlePosition: "top",
  textAlign: "center",
  textColor: "#ffffff",
  textEffect: "outline",
  effectColor: "#000000",
  backgroundColor: "#2f5d8a",
  backLayout: "text",
  backTextSize: 16,
  backTextPanel: true,
  barcodeAreaClear: true,
  backArtwork: false,
  artworkVersions: [],
};

/** Amazon listing content — stored JSON-encoded on Project.listing. */
export interface ListingContent {
  titleSuggestions: string[];
  title: string;
  subtitle: string;
  description: string;
  bulletPoints: string[];
  /** Exactly seven backend search keywords. */
  keywords: string[];
  /** Three suggested KDP browse category paths (one broad + two niche).
   *  AI suggestions — pick the closest match in KDP's category picker. */
  categories: string[];
  audience: string;
  backCoverDescription: string;
  shortPromo: string;
}

/** Cover state as exposed to the UI. */
export interface CoverDto {
  title: string;
  subtitle: string | null;
  author: string | null;
  spineText: string | null;
  backCoverText: string | null;
  artwork: string | null;
  /** Approved interior pages sampled for the back-cover showcase layout. */
  showcasePages: string[];
  settings: CoverSettings;
  dims: {
    pageCount: number;
    spineIn: number;
    totalWidthIn: number;
    totalHeightIn: number;
    bleedIn: number;
    trimWidthIn: number;
    trimHeightIn: number;
    spineTextAllowed: boolean;
  };
}

// ---------------------------------------------------------------------------
// Find Me a Niche — all scores are AI CONCEPT ANALYSIS, never market data.
// ---------------------------------------------------------------------------

export const NICHE_STATUSES = [
  "new",
  "favourite",
  "considering",
  "building",
  "book_created",
  "rejected",
] as const;
export type NicheStatus = (typeof NICHE_STATUSES)[number];

/** 1–10 AI concept scores. These are opinions about the CONCEPT — they are
 *  not Amazon sales, BSR, search volume or competition data and must always
 *  be labelled "AI concept analysis — market data not verified" in the UI. */
export interface NicheScores {
  specificity: number;
  visualPotential: number;
  variety: number;
  audienceClarity: number;
  giftPotential: number;
  seriesPotential: number;
  cbnSuitability: number;
  overall: number;
}

export interface NicheSeriesIdea {
  name: string;
  books: string[];
}

export interface NicheIdeaDto {
  id: string;
  broadTopic: string;
  name: string;
  /** Niche tree path, broad → specific (last entry is the final niche). */
  path: string[];
  audience: string | null;
  concept: string | null;
  artwork: string | null;
  bookType: string | null;
  pageCount: number | null;
  complexity: string | null;
  difficulty: string | null;
  positioning: string | null;
  giftPotential: string | null;
  seriesPotential: string | null;
  scores: NicheScores | null;
  seriesIdeas: NicheSeriesIdea | null;
  status: NicheStatus;
  parentId: string | null;
  linkedProjectId: string | null;
  createdAt: string;
}

/** Standard typed API envelope used by every API route. */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };
