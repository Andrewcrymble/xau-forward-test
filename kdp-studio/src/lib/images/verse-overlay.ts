import sharp from "sharp";
import { INTERIOR_IMAGE } from "@/lib/config/kdp-spec";
import { textPath, textWidth } from "@/lib/images/text-paths";

// Typesets a page's intentional text (a Bible verse, a quote) onto the
// finished print image as a decorative panel. The image AI is told to draw
// NO text at all — AI models garble long passages — so every letter on the
// page comes from this module: perfectly spelled, crisp vector lettering.

const W = INTERIOR_IMAGE.widthPx; // 2550
const H = INTERIOR_IMAGE.heightPx; // 3300

const PANEL_W = 1900;
const PAD = 78;
const MARGIN_BOTTOM = 260;
const MAX_LINES = 6;

/** Split "verse text — Book 1:2 (KJV)" into body + reference when present. */
function splitReference(text: string): { body: string; reference: string | null } {
  const m = text.match(/^([\s\S]*)\s[—–-]\s*([^—–]*\d[^—–]*)$/);
  if (m && m[2].trim().length <= 80) {
    return { body: m[1].trim(), reference: m[2].trim() };
  }
  return { body: text.trim(), reference: null };
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, "serif") <= maxWidth || !line) {
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
export async function overlayPageText(processed: Buffer, pageText: string): Promise<Buffer> {
  const { body, reference } = splitReference(pageText.trim());
  if (!body && !reference) return processed;

  const maxTextW = PANEL_W - 2 * PAD;
  let size = 74;
  let lines = wrap(body, size, maxTextW);
  while (lines.length > MAX_LINES && size > 42) {
    size -= 4;
    lines = wrap(body, size, maxTextW);
  }
  const lineH = size * 1.4;
  const refSize = Math.max(40, Math.round(size * 0.7));
  const refBlock = reference ? refSize * 1.9 : 0;
  const panelH = Math.round(PAD * 2 + lines.length * lineH + refBlock);
  const panelX = (W - PANEL_W) / 2;
  const panelY = H - MARGIN_BOTTOM - panelH;
  const cx = W / 2;

  const parts: string[] = [
    // White plate with a colourable double frame.
    `<rect x="${panelX}" y="${panelY}" width="${PANEL_W}" height="${panelH}" rx="30" fill="#ffffff" stroke="#111111" stroke-width="6"/>`,
    `<rect x="${panelX + 18}" y="${panelY + 18}" width="${PANEL_W - 36}" height="${panelH - 36}" rx="20" fill="none" stroke="#111111" stroke-width="3"/>`,
  ];
  lines.forEach((line, i) => {
    parts.push(
      textPath(line, cx, panelY + PAD + lineH * (i + 0.5), size, {
        face: "serif",
        anchor: "middle",
      }),
    );
  });
  if (reference) {
    parts.push(
      textPath(reference, cx, panelY + PAD + lineH * lines.length + refSize * 1.1, refSize, {
        face: "serif-bold",
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
