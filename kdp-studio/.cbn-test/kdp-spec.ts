// ---------------------------------------------------------------------------
// KDP print specification — the ONLY place KDP-related measurements live.
// If Amazon changes its requirements, update this module and nothing else.
// All measurements are in inches unless stated otherwise.
// ---------------------------------------------------------------------------

export const PRINT_DPI = 300;

export interface TrimSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

/** Supported trim sizes. Add new entries here to support more sizes. */
export const TRIM_SIZES: Record<string, TrimSize> = {
  "8.5x11": {
    id: "8.5x11",
    label: '8.5 × 11 in — US Letter',
    widthIn: 8.5,
    heightIn: 11,
  },
};

export const DEFAULT_TRIM_SIZE_ID = "8.5x11";

/** Final normalised interior image size: 8.5 × 11 in at 300 DPI. */
export const INTERIOR_IMAGE = {
  widthPx: 2550,
  heightPx: 3300,
  dpi: PRINT_DPI,
} as const;

export interface KdpMarginSpec {
  insideIn: number; // gutter
  outsideIn: number;
  topIn: number;
  bottomIn: number;
  bleedIn: number; // 0 = no-bleed interior
}

/**
 * Interior margin presets. The colouring-book preset uses a no-bleed
 * interior because illustrations stay safely inside a white margin.
 * KDP minimums (no bleed): outside/top/bottom ≥ 0.25", gutter depends on
 * page count — 0.375" covers up to 150 pages; kept generous here.
 */
export const INTERIOR_MARGINS: Record<string, KdpMarginSpec> = {
  colouringBookNoBleed: {
    insideIn: 0.5,
    outsideIn: 0.375,
    topIn: 0.375,
    bottomIn: 0.375,
    bleedIn: 0,
  },
};

export const DEFAULT_INTERIOR_MARGIN_ID = "colouringBookNoBleed";

/** KDP cover bleed (applied on all four outer edges of the wraparound). */
export const COVER_BLEED_IN = 0.125;

/** Keep text/important cover elements this far inside the trim edge. */
export const COVER_SAFE_MARGIN_IN = 0.25;

/** Amazon places its barcode on the back cover; keep this area clear. */
export const BARCODE_AREA = {
  widthIn: 2,
  heightIn: 1.2,
  /** Inset from the back cover's bottom-right trim corner. */
  insetIn: 0.25,
} as const;

/** Minimum spine width before KDP allows printed spine text. */
export const MIN_SPINE_TEXT_WIDTH_IN = 0.25;

// ---------------------------------------------------------------------------
// Spine width — per-page rates differ by paper/ink type. Source: KDP
// paperback cover specifications. Centrally maintained; update here only.
// ---------------------------------------------------------------------------

export type PaperType =
  | "blackWhiteWhitePaper"
  | "blackWhiteCreamPaper"
  | "colourWhitePaper";

/** Inches of spine width per interior page. */
export const SPINE_RATES: Record<PaperType, number> = {
  blackWhiteWhitePaper: 0.002252,
  blackWhiteCreamPaper: 0.0025,
  colourWhitePaper: 0.002347,
};

export const DEFAULT_PAPER_TYPE: PaperType = "blackWhiteWhitePaper";

export function calculateSpineWidthIn(pageCount: number, paperType: PaperType): number {
  return pageCount * SPINE_RATES[paperType];
}

/**
 * Full wraparound cover dimensions, computed dynamically — never hard-code
 * a finished canvas size.
 */
export function calculateCoverDimensions(opts: {
  trimSizeId: string;
  pageCount: number;
  paperType: PaperType;
  bleedIn?: number;
}) {
  const trim = TRIM_SIZES[opts.trimSizeId];
  if (!trim) throw new Error(`Unknown trim size: ${opts.trimSizeId}`);
  const bleedIn = opts.bleedIn ?? COVER_BLEED_IN;
  const spineIn = calculateSpineWidthIn(opts.pageCount, opts.paperType);
  return {
    spineIn,
    totalWidthIn: bleedIn + trim.widthIn + spineIn + trim.widthIn + bleedIn,
    totalHeightIn: bleedIn + trim.heightIn + bleedIn,
    bleedIn,
  };
}

// ---------------------------------------------------------------------------
// Generation queue defaults (referenced by the Phase 3 queue implementation).
// ---------------------------------------------------------------------------

export const MAX_CONCURRENT_GENERATIONS = 3;
export const MAX_GENERATION_RETRIES = 2;

// ---------------------------------------------------------------------------
// KDP paperback page-count limits (black ink, 8.5×11).
// ---------------------------------------------------------------------------

export const KDP_MIN_PAGE_COUNT = 24;
export const KDP_MAX_PAGE_COUNT_BW = 828;

/** PDF points per inch (PDF user-space unit). */
export const PDF_POINTS_PER_INCH = 72;
