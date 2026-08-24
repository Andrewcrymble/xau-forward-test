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

/** Project as exposed to the UI (interiorOptions decoded from JSON). */
export interface ProjectDto {
  id: string;
  name: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  niche: string;
  description: string | null;
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

/** Colouring page as exposed to the UI. */
export interface PageDto {
  id: string;
  pageNumber: number;
  title: string;
  concept: string;
  prompt: string;
  promptEdited: boolean;
  originalImage: string | null;
  processedImage: string | null;
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
  titleFont: "serif" | "sans";
  titleSize: number; // points
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
  titlePosition: "top",
  textAlign: "center",
  textColor: "#ffffff",
  textEffect: "outline",
  effectColor: "#000000",
  backgroundColor: "#2f5d8a",
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

/** Standard typed API envelope used by every API route. */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };
