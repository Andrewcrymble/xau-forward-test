import sharp from "sharp";
import { INTERIOR_IMAGE } from "./kdp-spec";

// Colour-by-numbers processing pipeline. The image AI only supplies a
// flat-colour illustration; everything numbers-related is PROGRAMMATIC:
//
//   1. quantise the artwork to the requested number of colours
//   2. segment enclosed regions (connected components)
//   3. merge regions too small/thin to colour (difficulty-controlled)
//   4. derive the black outline page from region boundaries
//   5. place each region's number at its most interior point (distance
//      transform), sized to fit, never crossing an outline
//   6. render the colour key; keep the quantised artwork as the exactly
//      matching completed reference
//   7. validate the result — failures mark the page NEEDS REVIEW
//
// This guarantees: no malformed/duplicated/missing numbers, numbers only
// inside their regions, and a key that matches the artwork by construction.

const PRINT_W = INTERIOR_IMAGE.widthPx; // 2550
const PRINT_H = INTERIOR_IMAGE.heightPx; // 3300
// Work at half print resolution for segmentation speed; outputs upscale 2×.
const W = PRINT_W / 2;
const H = PRINT_H / 2;
const INSET = 56; // ~0.37in safe margin at working scale
const KEY_BAND_H = 170; // key strip height at working scale

interface DifficultyParams {
  blur: number;
  minArea: number;
  /** Regions thinner than this (max interior distance, px) merge away. */
  minDist: number;
  /** Advisory upper bound for the finished region count. */
  targetMax: number;
}

// minArea/minDist are at working scale (half print). Guide: 10 000 working
// px ≈ 0.44 in² on the printed page; minDist 20 ≈ 0.27 in narrowest passage.
const DIFFICULTY_PARAMS: Record<string, DifficultyParams> = {
  very_easy: { blur: 7, minArea: 26000, minDist: 36, targetMax: 16 },
  easy: { blur: 6, minArea: 17000, minDist: 28, targetMax: 28 },
  medium: { blur: 4.5, minArea: 9500, minDist: 21, targetMax: 45 },
  adult: { blur: 3, minArea: 4200, minDist: 14, targetMax: 80 },
  detailed_adult: { blur: 2, minArea: 2000, minDist: 10, targetMax: 130 },
};

const NAMED_COLOURS: { name: string; rgb: [number, number, number] }[] = [
  { name: "White", rgb: [255, 255, 255] },
  { name: "Black", rgb: [25, 25, 25] },
  { name: "Dark Grey", rgb: [85, 85, 85] },
  { name: "Grey", rgb: [150, 150, 150] },
  { name: "Light Grey", rgb: [205, 205, 205] },
  { name: "Red", rgb: [210, 45, 45] },
  { name: "Dark Red", rgb: [140, 25, 30] },
  { name: "Orange", rgb: [240, 140, 30] },
  { name: "Peach", rgb: [250, 200, 150] },
  { name: "Brown", rgb: [125, 85, 50] },
  { name: "Tan", rgb: [200, 165, 115] },
  { name: "Yellow", rgb: [245, 215, 60] },
  { name: "Cream", rgb: [245, 235, 200] },
  { name: "Light Green", rgb: [150, 210, 120] },
  { name: "Green", rgb: [70, 160, 70] },
  { name: "Dark Green", rgb: [30, 100, 55] },
  { name: "Olive", rgb: [128, 128, 60] },
  { name: "Teal", rgb: [30, 140, 140] },
  { name: "Light Blue", rgb: [140, 200, 235] },
  { name: "Blue", rgb: [60, 110, 200] },
  { name: "Dark Blue", rgb: [30, 55, 130] },
  { name: "Purple", rgb: [130, 70, 170] },
  { name: "Violet", rgb: [175, 130, 215] },
  { name: "Pink", rgb: [240, 150, 190] },
  { name: "Magenta", rgb: [200, 50, 140] },
  { name: "Gold", rgb: [215, 170, 60] },
];

/** Nearest colour name not already used in this key — two different hexes
 *  must never share a name ("2 = Magenta, 4 = Magenta" is unusable). */
function nearestColourName(
  r: number,
  g: number,
  b: number,
  used: Set<string>,
): string {
  const ranked = [...NAMED_COLOURS]
    .map((c) => ({
      name: c.name,
      d: (r - c.rgb[0]) ** 2 + (g - c.rgb[1]) ** 2 + (b - c.rgb[2]) ** 2,
    }))
    .sort((a, b2) => a.d - b2.d);
  const free = ranked.find((c) => !used.has(c.name));
  if (free) {
    used.add(free.name);
    return free.name;
  }
  // Every name taken (more colours than names nearby) — qualify the nearest.
  for (let i = 2; ; i++) {
    const candidate = `${ranked[0].name} ${i}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function hexOf(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface CbnProcessInput {
  /** Flat-colour artwork from the image provider (any size). */
  image: Buffer;
  difficulty: string;
  colourCount: number;
  /** Custom palette to map the artwork onto (numbers follow this order). */
  customPalette?: { name: string; hex: string }[] | null;
  keyPlacement: string; // "bottom" | "none"
}

export interface CbnProcessResult {
  /** Print-ready numbered outline page (2550×3300). */
  numberedPage: Buffer;
  /** Exactly matching coloured reference (2550×3300). */
  reference: Buffer;
  palette: { number: number; name: string; hex: string }[];
  regions: { id: number; number: number; areaPx: number }[];
  validation: string[];
}

export async function processColourByNumbers(
  input: CbnProcessInput,
): Promise<CbnProcessResult> {
  const params = DIFFICULTY_PARAMS[input.difficulty] ?? DIFFICULTY_PARAMS.medium;
  const keyBand = input.keyPlacement === "bottom" ? KEY_BAND_H : 0;
  const artW = W - 2 * INSET;
  const artH = H - 2 * INSET - keyBand;

  // 1. Fit + simplify + quantise. libimagequant (sharp palette PNG) does
  //    the colour reduction; re-reading the PNG gives us quantised pixels.
  const fitted = await sharp(input.image)
    .flatten({ background: "#ffffff" })
    .resize(artW, artH, { fit: "inside" })
    .blur(Math.max(0.3, params.blur))
    .png({ palette: true, colors: Math.max(2, Math.min(32, input.colourCount + 1)), dither: 0 })
    .toBuffer();
  const { data, info } = await sharp(fitted)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gw = info.width;
  const gh = info.height;
  const ch = info.channels;

  // Colour index per pixel; -1 = background/near-white (left uncoloured).
  const colourKeyOf = (i: number) => {
    const r = data[i * ch];
    const g = data[i * ch + 1];
    const b = data[i * ch + 2];
    if (r > 235 && g > 235 && b > 235) return -1;
    return (r << 16) | (g << 8) | b;
  };
  const colourIdx = new Int32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) colourIdx[i] = colourKeyOf(i);

  // 2–3. Segment + merge small/thin regions until stable.
  let labels!: Int32Array;
  let regionColour!: Int32Array;
  let regionArea!: Int32Array;
  let regionCount = 0;

  const segment = () => {
    labels = new Int32Array(gw * gh).fill(-1);
    const colours: number[] = [];
    const areas: number[] = [];
    const queue = new Int32Array(gw * gh);
    let next = 0;
    for (let start = 0; start < gw * gh; start++) {
      if (labels[start] !== -1) continue;
      const id = next++;
      const col = colourIdx[start];
      colours.push(col);
      let area = 0;
      let qh = 0;
      let qt = 0;
      queue[qt++] = start;
      labels[start] = id;
      while (qh < qt) {
        const p = queue[qh++];
        area++;
        const x = p % gw;
        const y = (p / gw) | 0;
        if (x > 0 && labels[p - 1] === -1 && colourIdx[p - 1] === col) { labels[p - 1] = id; queue[qt++] = p - 1; }
        if (x < gw - 1 && labels[p + 1] === -1 && colourIdx[p + 1] === col) { labels[p + 1] = id; queue[qt++] = p + 1; }
        if (y > 0 && labels[p - gw] === -1 && colourIdx[p - gw] === col) { labels[p - gw] = id; queue[qt++] = p - gw; }
        if (y < gh - 1 && labels[p + gw] === -1 && colourIdx[p + gw] === col) { labels[p + gw] = id; queue[qt++] = p + gw; }
      }
      areas.push(area);
    }
    // Near-white only counts as background when it reaches the artwork edge.
    // Enclosed white pockets are sections the colourer will see — they must
    // carry a number, so promote them to a real "White" key colour.
    const WHITE = 0xffffff;
    const touchesEdge = new Uint8Array(next);
    for (let x = 0; x < gw; x++) {
      touchesEdge[labels[x]] = 1;
      touchesEdge[labels[(gh - 1) * gw + x]] = 1;
    }
    for (let y = 0; y < gh; y++) {
      touchesEdge[labels[y * gw]] = 1;
      touchesEdge[labels[y * gw + gw - 1]] = 1;
    }
    const promote = new Uint8Array(next);
    let promoted = false;
    for (let r = 0; r < next; r++) {
      if (colours[r] === -1 && !touchesEdge[r]) {
        colours[r] = WHITE;
        promote[r] = 1;
        promoted = true;
      }
    }
    if (promoted) {
      for (let p = 0; p < gw * gh; p++) {
        if (promote[labels[p]]) colourIdx[p] = WHITE;
      }
    }
    regionCount = next;
    regionColour = Int32Array.from(colours);
    regionArea = Int32Array.from(areas);
  };

  /** Multi-source BFS distance to the nearest region boundary. */
  const distanceTransform = (): Int32Array => {
    const dist = new Int32Array(gw * gh).fill(-1);
    const queue = new Int32Array(gw * gh);
    let qh = 0;
    let qt = 0;
    for (let p = 0; p < gw * gh; p++) {
      const x = p % gw;
      const y = (p / gw) | 0;
      const l = labels[p];
      if (
        x === 0 || y === 0 || x === gw - 1 || y === gh - 1 ||
        labels[p - 1] !== l || labels[p + 1] !== l ||
        labels[p - gw] !== l || labels[p + gw] !== l
      ) {
        dist[p] = 0;
        queue[qt++] = p;
      }
    }
    while (qh < qt) {
      const p = queue[qh++];
      const d = dist[p];
      const l = labels[p];
      const x = p % gw;
      const y = (p / gw) | 0;
      if (x > 0 && dist[p - 1] === -1 && labels[p - 1] === l) { dist[p - 1] = d + 1; queue[qt++] = p - 1; }
      if (x < gw - 1 && dist[p + 1] === -1 && labels[p + 1] === l) { dist[p + 1] = d + 1; queue[qt++] = p + 1; }
      if (y > 0 && dist[p - gw] === -1 && labels[p - gw] === l) { dist[p - gw] = d + 1; queue[qt++] = p - gw; }
      if (y < gh - 1 && dist[p + gw] === -1 && labels[p + gw] === l) { dist[p + gw] = d + 1; queue[qt++] = p + gw; }
    }
    return dist;
  };

  segment();
  for (let pass = 0; pass < 6; pass++) {
    const dist = distanceTransform();
    const maxDist = new Int32Array(regionCount);
    for (let p = 0; p < gw * gh; p++) {
      if (dist[p] > maxDist[labels[p]]) maxDist[labels[p]] = dist[p];
    }
    // Neighbour with the longest shared border, per region.
    const borderCount: Map<number, Map<number, number>> = new Map();
    const bump = (a: number, b: number) => {
      let m = borderCount.get(a);
      if (!m) borderCount.set(a, (m = new Map()));
      m.set(b, (m.get(b) ?? 0) + 1);
    };
    for (let p = 0; p < gw * gh; p++) {
      const x = p % gw;
      const l = labels[p];
      if (x < gw - 1 && labels[p + 1] !== l) { bump(l, labels[p + 1]); bump(labels[p + 1], l); }
      if (((p / gw) | 0) < gh - 1 && labels[p + gw] !== l) { bump(l, labels[p + gw]); bump(labels[p + gw], l); }
    }
    // Recolour doomed regions to their dominant neighbour's colour.
    const newColourOf = new Map<number, number>();
    for (let r = 0; r < regionCount; r++) {
      const doomed =
        regionColour[r] !== -1 &&
        (regionArea[r] < params.minArea || maxDist[r] < params.minDist);
      if (!doomed) continue;
      const neighbours = borderCount.get(r);
      if (!neighbours) continue;
      let bestN = -1;
      let bestShared = -1;
      for (const [n, shared] of neighbours) {
        // Prefer surviving coloured neighbours; background white also OK.
        const nDoomed =
          regionColour[n] !== -1 &&
          (regionArea[n] < params.minArea || maxDist[n] < params.minDist);
        const weight = shared + (nDoomed ? 0 : 1_000_000) + (regionColour[n] !== -1 ? 500_000 : 0);
        if (weight > bestShared) {
          bestShared = weight;
          bestN = n;
        }
      }
      if (bestN >= 0) newColourOf.set(r, regionColour[bestN]);
    }
    if (newColourOf.size === 0) break;
    for (let p = 0; p < gw * gh; p++) {
      const nc = newColourOf.get(labels[p]);
      if (nc !== undefined) colourIdx[p] = nc;
    }
    segment();
  }

  // 4. Palette from surviving colours (optionally mapped onto the custom
  //    palette — the artwork pixels are recoloured to match exactly).
  const usedColours = new Map<number, number>(); // colour key -> area
  for (let r = 0; r < regionCount; r++) {
    if (regionColour[r] === -1) continue;
    usedColours.set(regionColour[r], (usedColours.get(regionColour[r]) ?? 0) + regionArea[r]);
  }
  let palette: { number: number; name: string; hex: string; key: number }[] = [];
  const colourToNumber = new Map<number, number>();
  if (input.customPalette && input.customPalette.length > 0) {
    const custom = input.customPalette;
    const customUsed = new Set<number>();
    for (const [key] of [...usedColours.entries()].sort((a, b) => b[1] - a[1])) {
      const r = (key >> 16) & 255;
      const g = (key >> 8) & 255;
      const b = key & 255;
      let bestI = 0;
      let bestD = Infinity;
      custom.forEach((c, i) => {
        const [cr, cg, cb] = hexToRgbTuple(c.hex);
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (d < bestD) { bestD = d; bestI = i; }
      });
      colourToNumber.set(key, bestI + 1);
      customUsed.add(bestI);
    }
    palette = custom
      .map((c, i) => ({ number: i + 1, name: c.name, hex: c.hex, key: -1 }))
      .filter((p) => customUsed.has(p.number - 1));
    // Recolour pixels to the custom palette so the reference matches the key.
    const mapped = new Map<number, number>();
    for (const [key, num] of colourToNumber) {
      const [cr, cg, cb] = hexToRgbTuple(custom[num - 1].hex);
      mapped.set(key, (cr << 16) | (cg << 8) | cb);
    }
    for (let p = 0; p < gw * gh; p++) {
      const m = mapped.get(colourIdx[p]);
      if (m !== undefined) colourIdx[p] = m;
    }
    const remappedNumbers = new Map<number, number>();
    for (const num of colourToNumber.values()) {
      const [cr, cg, cb] = hexToRgbTuple(custom[num - 1].hex);
      remappedNumbers.set((cr << 16) | (cg << 8) | cb, num);
    }
    colourToNumber.clear();
    for (const [k, num] of remappedNumbers) colourToNumber.set(k, num);
    segment();
  } else {
    let n = 1;
    const usedNames = new Set<string>();
    for (const [key] of [...usedColours.entries()].sort((a, b) => b[1] - a[1])) {
      const r = (key >> 16) & 255;
      const g = (key >> 8) & 255;
      const b = key & 255;
      palette.push({
        number: n,
        name: nearestColourName(r, g, b, usedNames),
        hex: hexOf(r, g, b),
        key,
      });
      colourToNumber.set(key, n);
      n++;
    }
  }

  // 5. Number placement: each coloured region's most interior point.
  const dist = distanceTransform();
  const bestPoint = new Int32Array(regionCount).fill(-1);
  const bestDist = new Int32Array(regionCount).fill(-1);
  for (let p = 0; p < gw * gh; p++) {
    const l = labels[p];
    if (dist[p] > bestDist[l]) {
      bestDist[l] = dist[p];
      bestPoint[l] = p;
    }
  }

  const sizeFor = (d: number) => Math.max(16, Math.min(46, Math.floor(d * 1.1)));

  const regions: { id: number; number: number; areaPx: number }[] = [];
  const numberMarks: { x: number; y: number; size: number; number: number }[] = [];
  const validation: string[] = [];
  const regionNumber = new Map<number, number>();
  const marksOfRegion = new Map<number, { x: number; y: number }[]>();
  for (let r = 0; r < regionCount; r++) {
    const col = regionColour[r] === -1 ? -1 : colourIdx[bestPoint[r]];
    if (col === -1) continue;
    let number = colourToNumber.get(col);
    if (!number && palette.length > 0) {
      // Rare: a colour survived segmentation but missed the palette map.
      // Number it as the nearest key colour — never leave a section blank.
      const cr = (col >> 16) & 255;
      const cg = (col >> 8) & 255;
      const cb = col & 255;
      let bestD = Infinity;
      for (const pal of palette) {
        const [pr, pg, pb] = hexToRgbTuple(pal.hex);
        const d = (cr - pr) ** 2 + (cg - pg) ** 2 + (cb - pb) ** 2;
        if (d < bestD) {
          bestD = d;
          number = pal.number;
        }
      }
    }
    if (!number) continue;
    regions.push({ id: r, number, areaPx: regionArea[r] });
    regionNumber.set(r, number);
    const p = bestPoint[r];
    if (bestDist[r] < 7) {
      validation.push(`Region ${regions.length} is too small for a readable number.`);
    }
    const x = p % gw;
    const y = (p / gw) | 0;
    numberMarks.push({ x, y, size: sizeFor(bestDist[r]), number });
    marksOfRegion.set(r, [{ x, y }]);
  }

  // Large or sprawling regions get their number REPEATED so every part of
  // the section has a number close by — one number at the deepest point of
  // a big background area reads as "unnumbered" everywhere else.
  const GRID = 190; // candidate sites: deepest pixel per region per grid cell
  const SPACING = 170; // min gap between repeated numbers of one region
  const EXTRA_MIN_DIST = 12; // only where the number still fits comfortably
  const cellsX = Math.ceil(gw / GRID);
  const cellBest = new Map<number, { p: number; d: number }>();
  for (let p = 0; p < gw * gh; p++) {
    const l = labels[p];
    if (dist[p] < EXTRA_MIN_DIST || !regionNumber.has(l)) continue;
    const cell = ((p % gw) / GRID | 0) + cellsX * (((p / gw) | 0) / GRID | 0);
    const key = l * 4096 + cell;
    const cur = cellBest.get(key);
    if (!cur || dist[p] > cur.d) cellBest.set(key, { p, d: dist[p] });
  }
  const sitesOfRegion = new Map<number, { p: number; d: number }[]>();
  for (const [key, site] of cellBest) {
    const r = Math.floor(key / 4096);
    let list = sitesOfRegion.get(r);
    if (!list) sitesOfRegion.set(r, (list = []));
    list.push(site);
  }
  for (const [r, sites] of sitesOfRegion) {
    const number = regionNumber.get(r)!;
    const placed = marksOfRegion.get(r)!;
    sites.sort((a, b) => b.d - a.d);
    let added = 0;
    for (const s of sites) {
      if (added >= 12) break;
      const x = s.p % gw;
      const y = (s.p / gw) | 0;
      if (placed.some((m) => (m.x - x) ** 2 + (m.y - y) ** 2 < SPACING * SPACING)) continue;
      placed.push({ x, y });
      numberMarks.push({ x, y, size: sizeFor(s.d), number });
      added++;
    }
  }

  if (palette.length < 2) {
    validation.push("Fewer than two usable colours were found — regenerate this page.");
  }
  if (regions.length > params.targetMax * 1.8) {
    validation.push(
      `${regions.length} regions is well above the ${params.targetMax} ideal for this difficulty.`,
    );
  }
  if (regions.length < 3) {
    validation.push("Fewer than three numbered regions — the artwork is too simple.");
  }
  const numbersUsed = new Set(regions.map((r) => r.number));
  for (const p of palette) {
    if (!numbersUsed.has(p.number)) {
      validation.push(`Colour ${p.number} (${p.name}) appears in the key but on no region.`);
    }
  }

  // 6. Outline bitmap (greyscale, white bg, black boundaries), art area only.
  const outline = Buffer.alloc(gw * gh, 255);
  for (let p = 0; p < gw * gh; p++) {
    const x = p % gw;
    const y = (p / gw) | 0;
    const l = labels[p];
    if (
      (x < gw - 1 && labels[p + 1] !== l) ||
      (y < gh - 1 && labels[p + gw] !== l)
    ) {
      outline[p] = 0;
      if (x > 0) outline[p - 1] = 0;
      if (y > 0) outline[p - gw] = 0;
    }
  }

  const offX = INSET + Math.floor((artW - gw) / 2);
  const offY = INSET + Math.floor((artH - gh) / 2);
  const scale = 2; // working → print

  const outlinePng = await sharp(outline, {
    raw: { width: gw, height: gh, channels: 1 },
  })
    .resize(gw * scale, gh * scale, { kernel: "lanczos3" })
    .threshold(200)
    .png()
    .toBuffer();

  // SVG overlay at print scale: numbers + colour key.
  const svgParts: string[] = [];
  for (const m of numberMarks) {
    const x = (offX + m.x) * scale;
    const y = (offY + m.y) * scale;
    const fs = m.size * scale;
    svgParts.push(
      `<text x="${x}" y="${y}" font-size="${fs}" font-family="Arial, Helvetica, sans-serif" font-weight="bold" fill="#111111" stroke="#ffffff" stroke-width="${Math.max(2, fs * 0.14)}" paint-order="stroke" text-anchor="middle" dominant-baseline="central">${m.number}</text>`,
    );
  }
  const keySvg = (withColours: boolean): string => {
    if (input.keyPlacement !== "bottom") return "";
    const bandTop = (H - INSET - KEY_BAND_H) * scale + 30;
    const perRow = Math.min(palette.length, 6);
    const cellW = ((W - 2 * INSET) * scale) / perRow;
    const parts: string[] = [];
    palette.forEach((p, i) => {
      const row = Math.floor(i / perRow);
      const colI = i % perRow;
      const cx = INSET * scale + colI * cellW + 40;
      const cy = bandTop + row * 130 + 40;
      const [pr, pg, pb] = hexToRgbTuple(p.hex);
      const lightSwatch = 0.299 * pr + 0.587 * pg + 0.114 * pb > 165;
      const numberFill = !withColours || lightSwatch ? "#111111" : "#ffffff";
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="36" fill="${withColours ? p.hex : "#ffffff"}" stroke="#111111" stroke-width="4"/>`,
        `<text x="${cx}" y="${cy}" font-size="40" font-family="Arial, Helvetica, sans-serif" font-weight="bold" fill="${numberFill}" text-anchor="middle" dominant-baseline="central">${p.number}</text>`,
        `<text x="${cx + 52}" y="${cy}" font-size="38" font-family="Arial, Helvetica, sans-serif" fill="#111111" dominant-baseline="central">${p.name}</text>`,
      );
    });
    return parts.join("");
  };
  const overlaySvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_W}" height="${PRINT_H}">${svgParts.join("")}${keySvg(false)}</svg>`,
  );

  const numberedPage = await sharp({
    create: { width: PRINT_W, height: PRINT_H, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: outlinePng, left: offX * scale, top: offY * scale },
      { input: overlaySvg, left: 0, top: 0 },
    ])
    .png({ palette: true, compressionLevel: 9 })
    .toBuffer();

  // 7. Completed reference: the recoloured artwork itself + coloured key.
  const colourRaw = Buffer.alloc(gw * gh * 3);
  for (let p = 0; p < gw * gh; p++) {
    const c = colourIdx[p];
    if (c === -1) {
      colourRaw[p * 3] = 255;
      colourRaw[p * 3 + 1] = 255;
      colourRaw[p * 3 + 2] = 255;
    } else {
      colourRaw[p * 3] = (c >> 16) & 255;
      colourRaw[p * 3 + 1] = (c >> 8) & 255;
      colourRaw[p * 3 + 2] = c & 255;
    }
  }
  const colourPng = await sharp(colourRaw, {
    raw: { width: gw, height: gh, channels: 3 },
  })
    .resize(gw * scale, gh * scale, { kernel: "nearest" })
    .png()
    .toBuffer();
  const referenceSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_W}" height="${PRINT_H}">${keySvg(true)}</svg>`,
  );
  const reference = await sharp({
    create: { width: PRINT_W, height: PRINT_H, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: colourPng, left: offX * scale, top: offY * scale },
      { input: referenceSvg, left: 0, top: 0 },
    ])
    .png({ palette: true, compressionLevel: 9 })
    .toBuffer();

  return {
    numberedPage,
    reference,
    palette: palette.map(({ number, name, hex }) => ({ number, name, hex })),
    regions,
    validation,
  };
}
