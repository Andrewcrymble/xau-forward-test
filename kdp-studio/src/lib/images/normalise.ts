import sharp, { type Metadata, type Region } from "sharp";
import { INTERIOR_MARGINS, DEFAULT_INTERIOR_MARGIN_ID, INTERIOR_IMAGE, PRINT_DPI } from "@/lib/config/kdp-spec";

// Normalises AI-generated artwork to the print canvas (2550×3300 @ 300 DPI)
// and runs the automatic quality checks. Rules (from the project spec):
// preserve aspect ratio, resize proportionally, centre on a pure white
// canvas, keep a safe print margin, never crop artwork.

const CANVAS_W = INTERIOR_IMAGE.widthPx;
const CANVAS_H = INTERIOR_IMAGE.heightPx;

/** Safe print area inset (outside margin from the KDP spec, in pixels). */
const SAFE_INSET = Math.round(
  INTERIOR_MARGINS[DEFAULT_INTERIOR_MARGIN_ID].outsideIn * PRINT_DPI,
);

export interface QualityReport {
  /** "passed" | "needs_review" | "failed" (maps to ValidationStatus). */
  status: "passed" | "needs_review" | "failed";
  issues: string[];
}

export interface NormaliseResult {
  processed: Buffer;
  originalWidth: number;
  originalHeight: number;
  report: QualityReport;
}

/**
 * Fit the artwork inside the safe area of the white print canvas.
 * Throws only if the input can't be decoded at all.
 */
export async function normaliseToPrintCanvas(input: Buffer): Promise<NormaliseResult> {
  const issues: string[] = [];

  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return {
      processed: Buffer.alloc(0),
      originalWidth: 0,
      originalHeight: 0,
      report: { status: "failed", issues: ["Image file is corrupt or unreadable"] },
    };
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width === 0 || height === 0) {
    return {
      processed: Buffer.alloc(0),
      originalWidth: width,
      originalHeight: height,
      report: { status: "failed", issues: ["Image has no readable dimensions"] },
    };
  }

  if (height <= width) {
    issues.push(`Not portrait orientation (${width}×${height})`);
  }
  if (width < 900) {
    issues.push(`Low source resolution (${width}px wide — expected ≥1024px)`);
  }
  // Whiteness checks on the source artwork.
  try {
    // Only flag transparency when pixels are actually non-opaque — an
    // all-opaque alpha channel is harmless (it gets flattened anyway).
    if (meta.hasAlpha) {
      const alphaStats = await sharp(input).stats();
      const alpha = alphaStats.channels[alphaStats.channels.length - 1];
      if (alpha && alpha.min < 250) {
        issues.push("Source has transparent areas (flattened onto white)");
      }
    }
    const stats = await sharp(input).flatten({ background: "#ffffff" }).stats();
    const rgb = stats.channels.slice(0, 3);
    const overallMean = rgb.reduce((s, c) => s + c.mean, 0) / rgb.length;
    if (overallMean < 200) {
      issues.push(
        `Background may not be predominantly white (mean brightness ${overallMean.toFixed(0)}/255)`,
      );
    }

    // Edge whitespace: each border strip (4% of the dimension) should be
    // close to pure white so nothing touches the trim edge.
    const stripW = Math.max(1, Math.round(width * 0.04));
    const stripH = Math.max(1, Math.round(height * 0.04));
    const flat = sharp(input).flatten({ background: "#ffffff" });
    const regions: Array<[string, Region]> = [
      ["top", { left: 0, top: 0, width, height: stripH }],
      ["bottom", { left: 0, top: height - stripH, width, height: stripH }],
      ["left", { left: 0, top: 0, width: stripW, height }],
      ["right", { left: width - stripW, top: 0, width: stripW, height }],
    ];
    for (const [edge, region] of regions) {
      const s = await flat.clone().extract(region).stats();
      const mean =
        s.channels.slice(0, 3).reduce((acc, c) => acc + c.mean, 0) / 3;
      if (mean < 235) {
        issues.push(`Artwork may touch the ${edge} edge (edge brightness ${mean.toFixed(0)}/255)`);
      }
    }
  } catch {
    issues.push("Could not analyse image statistics");
  }

  // Normalise: fit inside the safe area, centred on a pure white canvas.
  let processed: Buffer;
  try {
    const fitted = await sharp(input)
      .flatten({ background: "#ffffff" })
      .resize(CANVAS_W - SAFE_INSET * 2, CANVAS_H - SAFE_INSET * 2, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .toBuffer();
    processed = await sharp({
      create: {
        width: CANVAS_W,
        height: CANVAS_H,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite([{ input: fitted, gravity: "centre" }])
      .png()
      .toBuffer();
  } catch {
    return {
      processed: Buffer.alloc(0),
      originalWidth: width,
      originalHeight: height,
      report: {
        status: "failed",
        issues: [...issues, "Image could not be normalised to the print canvas"],
      },
    };
  }

  return {
    processed,
    originalWidth: width,
    originalHeight: height,
    report: { status: issues.length === 0 ? "passed" : "needs_review", issues },
  };
}
