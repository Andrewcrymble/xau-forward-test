import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, PDFFont, PDFPage, degrees, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  BARCODE_AREA,
  COVER_SAFE_MARGIN_IN,
  MIN_SPINE_TEXT_WIDTH_IN,
  PDF_POINTS_PER_INCH,
  PRINT_DPI,
  calculateCoverDimensions,
  type PaperType,
} from "@/lib/config/kdp-spec";
import type { CoverSettings } from "@/lib/types";

// Full wraparound KDP cover: [bleed | back | spine | front | bleed], one
// landscape PDF page whose size is computed dynamically — never hard-coded.
// On-screen guides (trim/safe/spine/barcode) are drawn by the editor UI,
// NEVER here: the export contains artwork, colour and typography only.

const PT = PDF_POINTS_PER_INCH;

export interface CoverPdfInput {
  title: string;
  subtitle: string | null;
  author: string | null;
  spineText: string | null;
  backCoverText: string | null;
  /** Selected front-cover artwork bytes (any size; cover-cropped to fit). */
  artwork: Buffer | null;
  settings: CoverSettings;
  trimSizeId: string;
  pageCount: number;
}

function hexToRgb(hex: string): RGB {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    // Legacy named colours from settings saved before the hex picker.
    hex = hex === "black" ? "#111111" : "#ffffff";
  }
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Outline / drop-shadow treatment applied per line of front-cover text. */
interface TextEffect {
  kind: "outline" | "shadow";
  colour: RGB;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawAlignedLines(
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  areaX: number,
  areaWidth: number,
  topY: number,
  align: CoverSettings["textAlign"],
  colour: RGB,
  effect?: TextEffect | null,
): number {
  let y = topY;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    const x =
      align === "left"
        ? areaX
        : align === "right"
          ? areaX + areaWidth - w
          : areaX + (areaWidth - w) / 2;
    if (effect?.kind === "outline") {
      // pdf-lib has no text stroke — draw the line offset in 8 directions
      // behind the fill, the same trick the on-screen preview uses.
      const o = Math.max(0.5, size * 0.028);
      for (const [dx, dy] of [
        [-o, 0], [o, 0], [0, -o], [0, o],
        [-o, -o], [-o, o], [o, -o], [o, o],
      ]) {
        page.drawText(line, { x: x + dx, y: y + dy, size, font, color: effect.colour });
      }
    } else if (effect?.kind === "shadow") {
      const d = Math.max(1, size * 0.055);
      page.drawText(line, {
        x: x + d, y: y - d, size, font, color: effect.colour, opacity: 0.6,
      });
    }
    page.drawText(line, { x, y, size, font, color: colour });
    y -= size * 1.25;
  }
  return y;
}

/** Semi-opaque panel drawn behind a block of text (the "plate" effect). */
function drawPlate(
  page: PDFPage,
  maxLineWidth: number,
  blockTop: number,
  blockHeight: number,
  areaX: number,
  areaWidth: number,
  align: CoverSettings["textAlign"],
  colour: RGB,
  pad: number,
) {
  const w = Math.min(maxLineWidth + 2 * pad, areaWidth + 2 * pad);
  const x =
    align === "left"
      ? areaX - pad
      : align === "right"
        ? areaX + areaWidth - maxLineWidth - pad
        : areaX + (areaWidth - maxLineWidth) / 2 - pad;
  page.drawRectangle({
    x,
    y: blockTop - blockHeight - pad,
    width: w,
    height: blockHeight + 2 * pad,
    color: colour,
    opacity: 0.72,
  });
}

export async function buildCoverPdf(input: CoverPdfInput): Promise<{
  pdf: Buffer;
  dims: ReturnType<typeof calculateCoverDimensions>;
}> {
  const dims = calculateCoverDimensions({
    trimSizeId: input.trimSizeId,
    pageCount: input.pageCount,
    paperType: input.settings.paperType as PaperType,
  });

  const pageW = dims.totalWidthIn * PT;
  const pageH = dims.totalHeightIn * PT;
  const bleed = dims.bleedIn * PT;
  const spineW = dims.spineIn * PT;
  const trimW = (dims.totalWidthIn - 2 * dims.bleedIn - dims.spineIn) / 2; // inches per panel
  const panelW = trimW * PT;
  const safe = COVER_SAFE_MARGIN_IN * PT;

  // Panel x-origins (PDF origin bottom-left).
  const backX = bleed;
  const spineX = bleed + panelW;
  const frontX = bleed + panelW + spineW;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontDir = path.join(process.cwd(), "src", "assets", "fonts");
  const family = input.settings.titleFont === "sans" ? "LiberationSans" : "LiberationSerif";
  const displayBold = await doc.embedFont(await readFile(path.join(fontDir, `${family}-Bold.ttf`)));
  const display = await doc.embedFont(await readFile(path.join(fontDir, `${family}-Regular.ttf`)));

  doc.setTitle(`${input.title} — cover`);
  doc.setProducer("KDP Colouring Book Studio");
  doc.setCreator("KDP Colouring Book Studio");

  const page = doc.addPage([pageW, pageH]);
  const bg = hexToRgb(input.settings.backgroundColor);
  // Background colour across the whole wraparound (fills bleed too).
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: bg });

  // --- Optional back-cover artwork (darkened so text stays readable) ------
  if (input.artwork && input.settings.backArtwork) {
    const artW = bleed + panelW;
    const pxW = Math.round((artW / PT) * PRINT_DPI);
    const pxH = Math.round((pageH / PT) * PRINT_DPI);
    const fitted = await sharp(input.artwork)
      .resize(pxW, pxH, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const image = await doc.embedPng(fitted);
    page.drawImage(image, { x: 0, y: 0, width: artW, height: pageH });
    page.drawRectangle({
      x: 0, y: 0, width: artW, height: pageH,
      color: rgb(0, 0, 0), opacity: 0.5,
    });
  }

  // --- Front cover artwork (extends into top/right/bottom bleed) ----------
  if (input.artwork) {
    const artW = panelW + bleed;
    const artH = pageH;
    const pxW = Math.round(((panelW + bleed) / PT) * PRINT_DPI);
    const pxH = Math.round((pageH / PT) * PRINT_DPI);
    // Cover-fit crop server-side so the PDF draw is exact (no distortion).
    const fitted = await sharp(input.artwork)
      .resize(pxW, pxH, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const image = await doc.embedPng(fitted);
    page.drawImage(image, { x: frontX, y: 0, width: artW, height: artH });
  }

  const textColour = hexToRgb(input.settings.textColor);
  const effectColour = hexToRgb(input.settings.effectColor);
  const effect: TextEffect | null =
    input.settings.textEffect === "outline" || input.settings.textEffect === "shadow"
      ? { kind: input.settings.textEffect, colour: effectColour }
      : null;

  // --- Front cover typography --------------------------------------------
  const frontSafeX = frontX + safe;
  const frontSafeW = panelW - 2 * safe;
  const titleSize = input.settings.titleSize;
  const titleLines = wrapText(input.title, displayBold, titleSize, frontSafeW);
  const subtitleSize = Math.max(14, Math.round(titleSize * 0.42));
  const subtitleLines = input.subtitle
    ? wrapText(input.subtitle, display, subtitleSize, frontSafeW)
    : [];
  const authorSize = Math.max(13, Math.round(titleSize * 0.38));

  const blockHeight =
    titleLines.length * titleSize * 1.25 +
    (subtitleLines.length > 0 ? 10 + subtitleLines.length * subtitleSize * 1.25 : 0);
  const topEdge = pageH - bleed - safe;
  const bottomEdge = bleed + safe;
  let titleTopY: number;
  switch (input.settings.titlePosition) {
    case "middle":
      titleTopY = (pageH + blockHeight) / 2 - titleSize;
      break;
    case "bottom":
      titleTopY = bottomEdge + blockHeight + authorSize * 2;
      break;
    default:
      titleTopY = topEdge - titleSize;
  }

  if (input.settings.textEffect === "plate") {
    // Panel behind the whole title + subtitle block, sized from the actual
    // baselines: cap-top of the first title line to descender of the last line.
    const maxLineWidth = Math.max(
      ...titleLines.map((l) => displayBold.widthOfTextAtSize(l, titleSize)),
      ...subtitleLines.map((l) => display.widthOfTextAtSize(l, subtitleSize)),
    );
    const plateTop = titleTopY + titleSize * 0.75;
    const lastBaseline =
      subtitleLines.length > 0
        ? titleTopY -
          titleLines.length * titleSize * 1.25 -
          10 -
          (subtitleLines.length - 1) * subtitleSize * 1.25
        : titleTopY - (titleLines.length - 1) * titleSize * 1.25;
    const plateBottom =
      lastBaseline - (subtitleLines.length > 0 ? subtitleSize : titleSize) * 0.28;
    drawPlate(
      page, maxLineWidth, plateTop, plateTop - plateBottom,
      frontSafeX, frontSafeW, input.settings.textAlign, effectColour, titleSize * 0.4,
    );
  }
  let y = drawAlignedLines(
    page, titleLines, displayBold, titleSize,
    frontSafeX, frontSafeW, titleTopY, input.settings.textAlign, textColour, effect,
  );
  if (subtitleLines.length > 0) {
    y -= 10;
    drawAlignedLines(
      page, subtitleLines, display, subtitleSize,
      frontSafeX, frontSafeW, y, input.settings.textAlign, textColour, effect,
    );
  }
  if (input.author) {
    // Author anchors opposite the title block.
    const authorY =
      input.settings.titlePosition === "bottom" ? topEdge - authorSize : bottomEdge + authorSize;
    if (input.settings.textEffect === "plate") {
      drawPlate(
        page, display.widthOfTextAtSize(input.author, authorSize),
        authorY + authorSize * 0.8, authorSize,
        frontSafeX, frontSafeW, input.settings.textAlign, effectColour, authorSize * 0.35,
      );
    }
    drawAlignedLines(
      page, [input.author], display, authorSize,
      frontSafeX, frontSafeW, authorY, input.settings.textAlign, textColour, effect,
    );
  }

  // --- Spine text (only when KDP allows it) -------------------------------
  if (input.spineText && dims.spineIn >= MIN_SPINE_TEXT_WIDTH_IN) {
    const spineSize = Math.min(16, spineW * 0.55);
    const textW = displayBold.widthOfTextAtSize(input.spineText, spineSize);
    // Rotated -90°: reads top-to-bottom when the book stands upright.
    page.drawText(input.spineText, {
      x: spineX + spineW / 2 + spineSize * 0.35,
      y: pageH / 2 + textW / 2,
      size: spineSize,
      font: displayBold,
      color: textColour,
      rotate: degrees(-90),
    });
  }

  // --- Back cover ---------------------------------------------------------
  const backSafeX = backX + safe;
  const backSafeW = panelW - 2 * safe;
  if (input.backCoverText) {
    const backSize = 13;
    const lines = wrapText(input.backCoverText, display, backSize, backSafeW - 2 * safe);
    drawAlignedLines(
      page, lines, display, backSize,
      backSafeX + safe, backSafeW - 2 * safe,
      pageH - bleed - safe - 40, "center", textColour,
    );
  }
  if (input.settings.barcodeAreaClear) {
    // White rectangle where Amazon prints its barcode — kept clear, no fake
    // ISBN is ever drawn.
    const bw = BARCODE_AREA.widthIn * PT;
    const bh = BARCODE_AREA.heightIn * PT;
    const inset = BARCODE_AREA.insetIn * PT;
    page.drawRectangle({
      x: backX + panelW - inset - bw,
      y: bleed + inset,
      width: bw,
      height: bh,
      color: rgb(1, 1, 1),
    });
  }

  return { pdf: Buffer.from(await doc.save()), dims };
}
