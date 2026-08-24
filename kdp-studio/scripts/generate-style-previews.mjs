#!/usr/bin/env node
// One-off generator for the style/complexity preview images shown in the
// book setup screens. Run via the "Generate style preview images" GitHub
// Actions workflow (needs OPENAI_API_KEY). Each preview uses the SAME
// style prompt text the app uses for real pages, so previews are honest.
//
// Output: public/style-previews/{name}.webp (small web-sized files).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "style-previews",
);
mkdirSync(OUT_DIR, { recursive: true });

const BASE_RULES =
  "ONE standalone colouring page, portrait orientation. Pure white background, clean black line art only, no colour, no grey, no shading. No text, captions, labels or watermarks. Generous white margin on all edges.";

// Style previews — subject chosen to flatter each style.
const STYLES = [
  ["style-clean_childrens", "clean children's colouring book style", "a friendly duck splashing in a pond with reeds and a smiling sun"],
  ["style-cute_cartoon", "cute cartoon style with friendly rounded characters", "an adorable happy puppy playing with a ball"],
  ["style-bold_simple", "bold, simple outline style with thick strokes", "a butterfly resting on a large flower"],
  ["style-detailed_realistic", "detailed, realistic line art", "a horse standing in a meadow with trees behind"],
  ["style-architectural", "precise architectural line drawing style", "an ornate European townhouse facade with windows and balconies"],
  ["style-mandala", "intricate mandala-style patterned line art", "a circular floral mandala with layered petals and geometric rings"],
  ["style-vintage", "vintage engraved-style line illustration", "a songbird perched on a blossoming branch"],
  ["style-custom", "elegant mixed line-art style", "an artist's desk with pencils, brushes and a sketchbook"],
];

// Complexity previews — SAME subject at five detail levels.
const COMPLEXITY = [
  ["complexity-0", "very simple, thick bold outlines with large shapes and minimal detail"],
  ["complexity-1", "simple line art with bold outlines and limited detail"],
  ["complexity-2", "moderately detailed line art, balanced between simplicity and detail"],
  ["complexity-3", "detailed line art with fine lines and rich detail"],
  ["complexity-4", "highly detailed, intricate line art with very fine lines"],
];
const COMPLEXITY_SUBJECT = "an owl perched on a branch";

async function generate(prompt) {
  const attempt = async (model, size, extra = {}) => {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model, prompt, n: 1, size, ...extra }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${model} ${res.status}: ${text.slice(0, 200)}`);
    const b64 = JSON.parse(text).data?.[0]?.b64_json;
    if (!b64) throw new Error(`${model}: no image data`);
    return Buffer.from(b64, "base64");
  };
  try {
    return await attempt("gpt-image-1", "1024x1536", { quality: "medium" });
  } catch (err) {
    console.warn(`  gpt-image-1 failed (${err.message.slice(0, 120)}) — trying dall-e-3`);
    return attempt("dall-e-3", "1024x1792", { response_format: "b64_json" });
  }
}

const jobs = [
  ...STYLES.map(([file, style, subject]) => ({
    file,
    prompt: `Colouring book page illustration: ${subject}. Illustration style: ${style}. ${BASE_RULES}`,
  })),
  ...COMPLEXITY.map(([file, complexity]) => ({
    file,
    prompt: `Colouring book page illustration: ${COMPLEXITY_SUBJECT}. Line-art complexity: ${complexity}. ${BASE_RULES}`,
  })),
];

for (const job of jobs) {
  console.log(`Generating ${job.file}…`);
  const png = await generate(job.prompt);
  const webp = await sharp(png)
    .resize(480, null, { fit: "inside" })
    .webp({ quality: 80 })
    .toBuffer();
  writeFileSync(path.join(OUT_DIR, `${job.file}.webp`), webp);
  console.log(`  saved ${job.file}.webp (${Math.round(webp.length / 1024)} KB)`);
}
console.log("All previews generated.");
