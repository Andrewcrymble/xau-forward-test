import sharp from "sharp";
import { INTERIOR_IMAGE } from "@/lib/config/kdp-spec";
import { verseFont } from "@/lib/config/book-options";
import { textPath, textWidth } from "@/lib/images/text-paths";

// Typesets a page's intentional text (a Bible verse, a quote) onto the
// finished print image as a decorative panel. The image AI is told to draw
// NO text at all — AI models garble long passages — so every letter on the
// page comes from this module: perfectly spelled, crisp vector lettering.

const W = INTERIOR_IMAGE.widthPx; // 2550
const H = INTERIOR_IMAGE.heightPx; // 3300

const PANEL_W = 1900;
const PANEL_MIN_W = 1000;
const PAD = 78;
// Fallback distance from the page bottom to the panel's bottom edge, used
// when the artwork's own bounds can't be measured. Normally the plaque is
// fitted INSIDE the artwork's drawn frame instead — see artworkBounds().
const MARGIN_BOTTOM = 400;
// How far the plaque stays inside the artwork's drawn edges.
const FRAME_INSET_X = 90;
const FRAME_INSET_BOTTOM = 130;
const MAX_LINES = 6;

/**
 * Bounding box of the actual drawn artwork (many images carry their own
 * decorative frame narrower than the page). Scanned at 1/6 resolution;
 * a row/column counts as content once it holds a few inked pixels.
 */
async function artworkBounds(
  processed: Buffer,
): Promise<{ left: number; right: number; bottom: number } | null> {
  try {
    const SCALE = 6;
    const w = Math.round(W / SCALE);
    const h = Math.round(H / SCALE);
    const { data, info } = await sharp(processed)
      .resize(w, h, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cols = new Int32Array(info.width);
    const rows = new Int32Array(info.height);
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[y * info.width + x] < 100) {
          cols[x]++;
          rows[y]++;
        }
      }
    }
    const MIN_INK = 3;
    let left = -1;
    let right = -1;
    let bottom = -1;
    for (let x = 0; x < cols.length; x++) if (cols[x] >= MIN_INK) { left = x; break; }
    for (let x = cols.length - 1; x >= 0; x--) if (cols[x] >= MIN_INK) { right = x; break; }
    for (let y = rows.length - 1; y >= 0; y--) if (rows[y] >= MIN_INK) { bottom = y; break; }
    if (left < 0 || right <= left || bottom < 0) return null;
    return { left: left * SCALE, right: right * SCALE, bottom: bottom * SCALE };
  } catch {
    return null;
  }
}

/** Split "verse text — Book 1:2 (KJV)" into body + reference when present. */
function splitReference(text: string): { body: string; reference: string | null } {
  const m = text.match(/^([\s\S]*)\s[—–-]\s*([^—–]*\d[^—–]*)$/);
  if (m && m[2].trim().length <= 80) {
    return { body: m[1].trim(), reference: m[2].trim() };
  }
  return { body: text.trim(), reference: null };
}

function wrap(
  text: string,
  size: number,
  maxWidth: number,
  face: Parameters<typeof textWidth>[2],
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, face) <= maxWidth || !line) {
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

/**
 * Draw the text panel onto a finished 2550×3300 print image. Returns the
 * original image unchanged if the text is empty; never throws for callers —
 * a failed overlay is worse than a page without its panel, so callers wrap.
 */
export async function overlayPageText(
  processed: Buffer,
  pageText: string,
  fontId?: string | null,
): Promise<Buffer> {
  const { body, reference } = splitReference(pageText.trim());
  if (!body && !reference) return processed;
  const font = verseFont(fontId);

  // Fit the plaque inside the artwork's own drawn frame when measurable.
  const bounds = await artworkBounds(processed);
  let panelW = PANEL_W;
  let cx = W / 2;
  let panelBottom = H - MARGIN_BOTTOM;
  if (bounds) {
    const avail = bounds.right - bounds.left - 2 * FRAME_INSET_X;
    panelW = Math.max(PANEL_MIN_W, Math.min(PANEL_W, avail));
    cx = (bounds.left + bounds.right) / 2;
    panelBottom = Math.min(
      H - 300,
      Math.max(H - 520, bounds.bottom - FRAME_INSET_BOTTOM),
    );
  }

  const maxTextW = panelW - 2 * PAD;
  let size = 74;
  let lines = wrap(body, size, maxTextW, font.bodyFace);
  while (lines.length > MAX_LINES && size > 42) {
    size -= 4;
    lines = wrap(body, size, maxTextW, font.bodyFace);
  }
  const lineH = size * font.lineHeight;
  const refSize = Math.max(40, Math.round(size * 0.7));
  const refBlock = reference ? refSize * 1.9 : 0;
  const panelH = Math.round(PAD * 2 + lines.length * lineH + refBlock);
  const panelX = Math.round(cx - panelW / 2);
  const panelY = Math.round(panelBottom - panelH);

  const parts: string[] = [
    // White plate with a colourable double frame.
    `<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="30" fill="#ffffff" stroke="#111111" stroke-width="6"/>`,
    `<rect x="${panelX + 18}" y="${panelY + 18}" width="${panelW - 36}" height="${panelH - 36}" rx="20" fill="none" stroke="#111111" stroke-width="3"/>`,
  ];
  lines.forEach((line, i) => {
    parts.push(
      textPath(line, cx, panelY + PAD + lineH * (i + 0.5), size, {
        face: font.bodyFace,
        anchor: "middle",
      }),
    );
  });
  if (reference) {
    parts.push(
      textPath(reference, cx, panelY + PAD + lineH * lines.length + refSize * 1.1, refSize, {
        face: font.refFace,
        anchor: "middle",
      }),
    );
  }

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`,
  );
  return sharp(processed)
    .composite([{ input: svg, left: 0, top: 0 }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}
