import fs from "node:fs";
import path from "node:path";
import { parse as parseFont, type Font } from "opentype.js";

// Vector text for generated images. All programmatic text on pages (CBN
// numbers, colour keys, verse panels) is drawn as SVG <path> data extracted
// from the app's bundled fonts — never as SVG <text>, which needs system
// fonts at rasterisation time and serverless deploys ship none.

export type TextFace = "sans" | "sans-bold" | "serif" | "serif-bold";

const FACE_FILES: Record<TextFace, string> = {
  sans: "LiberationSans-Regular.ttf",
  "sans-bold": "LiberationSans-Bold.ttf",
  serif: "LiberationSerif-Regular.ttf",
  "serif-bold": "LiberationSerif-Bold.ttf",
};

const fontCache = new Map<string, Font>();

export function bundledFont(face: TextFace): Font {
  const file = FACE_FILES[face];
  let font = fontCache.get(file);
  if (!font) {
    const buf = fs.readFileSync(path.join(process.cwd(), "src", "assets", "fonts", file));
    font = parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    fontCache.set(file, font);
  }
  return font;
}

export function textWidth(text: string, size: number, face: TextFace = "sans"): number {
  return bundledFont(face).getAdvanceWidth(text, size);
}

/** SVG <path> for a piece of text, vertically centred on y. */
export function textPath(
  text: string,
  x: number,
  y: number,
  size: number,
  opts: {
    face?: TextFace;
    anchor?: "middle" | "start";
    fill?: string;
    halo?: number;
  } = {},
): string {
  const font = bundledFont(opts.face ?? "sans");
  const capHeight = ((font.tables.os2?.sCapHeight ?? font.ascender * 0.72) / font.unitsPerEm) * size;
  const px = opts.anchor === "middle" ? x - font.getAdvanceWidth(text, size) / 2 : x;
  const d = font.getPath(text, px, y + capHeight / 2, size).toPathData(2);
  const halo = opts.halo
    ? ` stroke="#ffffff" stroke-width="${opts.halo}" paint-order="stroke" stroke-linejoin="round"`
    : "";
  return `<path d="${d}" fill="${opts.fill ?? "#111111"}"${halo}/>`;
}
