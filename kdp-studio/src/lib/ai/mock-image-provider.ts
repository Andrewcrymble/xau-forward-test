import sharp from "sharp";
import type {
  GeneratedImage,
  ImageAIProvider,
  ImageGenerationRequest,
} from "./types";

// Keyless placeholder image provider: renders a deterministic black-and-white
// "line art" placeholder (portrait, white background) so the whole
// generation → normalise → validate → review pipeline runs without an API
// key or cost. Clearly watermark-free and obviously a placeholder.

const W = 1024;
const H = 1536;

/** Small deterministic PRNG so each page gets a distinct but stable drawing. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placeholderSvg(seed: number): string {
  const rand = mulberry32(seed * 7919 + 17);
  const shapes: string[] = [];
  // Scattered circles/petals inside a generous margin.
  for (let i = 0; i < 14; i++) {
    const cx = 160 + rand() * (W - 320);
    const cy = 220 + rand() * (H - 440);
    const r = 30 + rand() * 90;
    if (rand() < 0.5) {
      shapes.push(
        `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="none" stroke="black" stroke-width="4"/>`,
      );
    } else {
      shapes.push(
        `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * 0.6).toFixed(0)}" transform="rotate(${(rand() * 90).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})" fill="none" stroke="black" stroke-width="4"/>`,
      );
    }
  }
  // Wavy line across the middle.
  const y0 = 300 + rand() * (H - 600);
  shapes.push(
    `<path d="M 120 ${y0.toFixed(0)} q 120 -90 240 0 t 240 0 t 240 0" fill="none" stroke="black" stroke-width="5"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="70" y="70" width="${W - 140}" height="${H - 140}" fill="none" stroke="black" stroke-width="6" rx="24"/>
  ${shapes.join("\n  ")}
  <text x="${W / 2}" y="150" font-family="Arial, sans-serif" font-size="44" font-weight="bold" fill="black" text-anchor="middle">SAMPLE PAGE ${seed}</text>
  <text x="${W / 2}" y="${H - 110}" font-family="Arial, sans-serif" font-size="28" fill="black" text-anchor="middle">Placeholder — add an image API key for real artwork</text>
</svg>`;
}

function coverPlaceholderSvg(seed: number): string {
  const rand = mulberry32(seed * 104729 + 7);
  const hues = [Math.floor(rand() * 360), Math.floor(rand() * 360)];
  const blobs: string[] = [];
  for (let i = 0; i < 10; i++) {
    const cx = rand() * W;
    const cy = rand() * H;
    const r = 90 + rand() * 200;
    const hue = Math.floor(rand() * 360);
    blobs.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="hsl(${hue} 70% 60%)" opacity="0.55"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hues[0]} 65% 55%)"/>
      <stop offset="1" stop-color="hsl(${hues[1]} 70% 40%)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${blobs.join("\n  ")}
  <text x="${W / 2}" y="${H / 2}" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle" opacity="0.85">SAMPLE COVER ART</text>
  <text x="${W / 2}" y="${H / 2 + 54}" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" opacity="0.75">Add an image API key for real artwork</text>
</svg>`;
}

/** Flat-colour placeholder for colour-by-numbers base artwork: big solid
 *  shapes (sky band, hills, sun, tree, flowers) that quantise and segment
 *  cleanly, so the whole CBN pipeline can run without an API key. */
function cbnPlaceholderSvg(seed: number): string {
  const rand = mulberry32(seed * 31337 + 3);
  const hue = Math.floor(rand() * 360);
  const flower = (cx: number, cy: number, r: number, h: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${h} 75% 60%)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(0)}" fill="hsl(${(h + 160) % 360} 80% 55%)"/>`;
  const flowers: string[] = [];
  for (let i = 0; i < 5; i++) {
    flowers.push(
      flower(
        Math.round(180 + rand() * (W - 360)),
        Math.round(H - 320 - rand() * 160),
        Math.round(46 + rand() * 30),
        Math.floor(rand() * 360),
      ),
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="90" y="120" width="${W - 180}" height="620" fill="hsl(${(hue + 200) % 360} 70% 72%)"/>
  <circle cx="${Math.round(W * 0.7)}" cy="300" r="120" fill="hsl(48 90% 60%)"/>
  <path d="M 90 740 Q ${W / 2} 480 ${W - 90} 740 L ${W - 90} 980 L 90 980 Z" fill="hsl(${(hue + 100) % 360} 55% 55%)"/>
  <rect x="90" y="980" width="${W - 180}" height="${H - 1120}" fill="hsl(${(hue + 130) % 360} 50% 45%)"/>
  <rect x="${Math.round(W * 0.22)}" y="700" width="70" height="240" fill="hsl(25 45% 40%)"/>
  <circle cx="${Math.round(W * 0.25)}" cy="620" r="150" fill="hsl(${(hue + 130) % 360} 60% 38%)"/>
  ${flowers.join("\n  ")}
</svg>`;
}

export class MockImageProvider implements ImageAIProvider {
  readonly name = "mock";

  async generateImage(req: ImageGenerationRequest): Promise<GeneratedImage> {
    // Small artificial delay so queue behaviour (concurrency, pause) is visible.
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    if (req.referenceImage && req.variant !== "cover") {
      // Keyless mode still honours reference photos: a real local edge
      // sketch so the workflow is fully testable without an API key. Each
      // step is a separate sharp() invocation — within one pipeline sharp
      // applies operations in ITS order, not call order. CBN gets a flat
      // posterised version instead, since its pipeline needs colour regions.
      const fitted = sharp(req.referenceImage).resize(W, H, {
        fit: "contain",
        background: "#ffffff",
      });
      let data: Buffer;
      if (req.variant === "cbn-flat") {
        data = await fitted
          .median(9)
          .blur(2)
          .png({ palette: true, colors: 8, dither: 0 })
          .toBuffer();
      } else {
        const grey = await fitted.greyscale().blur(1.2).png().toBuffer();
        const edges = await sharp(grey)
          .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
          .png()
          .toBuffer();
        const binary = await sharp(edges).threshold(16).png().toBuffer();
        const inverted = await sharp(binary).negate().png().toBuffer();
        // Thicken the 1px edge lines into colourable outlines.
        data = await sharp(inverted).blur(0.9).threshold(215).png().toBuffer();
      }
      return {
        data,
        contentType: "image/png",
        provider: this.name,
        model: "placeholder-sketcher",
        estimatedCost: 0,
      };
    }
    const svg =
      req.variant === "cover"
        ? coverPlaceholderSvg(req.seed ?? 1)
        : req.variant === "cbn-flat"
          ? cbnPlaceholderSvg(req.seed ?? 1)
          : placeholderSvg(req.seed ?? 1);
    const data = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
      data,
      contentType: "image/png",
      provider: this.name,
      model: "placeholder-renderer",
      estimatedCost: 0,
    };
  }
}
