// End-to-end test of the CBN processor on a synthetic flat-colour artwork
// containing: small fiddly patches, an enclosed WHITE pocket, and one huge
// sprawling colour. Verifies bigger areas, a numbered white pocket, and
// repeated numbers across large regions.
import sharp from "sharp";
import mod from "./colour-by-numbers.js";
const { processColourByNumbers } = mod;

const W = 1024, H = 1325;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="40" y="40" width="${W - 80}" height="700" fill="#7ec8e3"/>
  <circle cx="820" cy="200" r="120" fill="#f5d90a"/>
  <ellipse cx="300" cy="760" rx="420" ry="180" fill="#4caf50"/>
  <ellipse cx="820" cy="800" rx="380" ry="160" fill="#2e7d32"/>
  <rect x="380" y="620" width="280" height="260" fill="#e53935"/>
  <polygon points="360,620 520,500 680,620" fill="#795548"/>
  <rect x="470" y="680" width="100" height="110" fill="#ffffff"/>
  <rect x="60" y="950" width="900" height="300" fill="#f39c12"/>
  ${Array.from({ length: 40 }, (_, i) =>
    `<circle cx="${90 + (i % 20) * 44}" cy="${1000 + Math.floor(i / 20) * 60}" r="9" fill="${i % 2 ? "#8e44ad" : "#1d4e89"}"/>`
  ).join("")}
</svg>`;
const image = await sharp(Buffer.from(svg)).png().toBuffer();

for (const difficulty of ["easy", "medium"]) {
  const t0 = Date.now();
  const res = await processColourByNumbers({
    image, difficulty, colourCount: 8, customPalette: null, keyPlacement: "bottom",
  });
  const areas = res.regions.map((r) => r.areaPx).sort((a, b) => a - b);
  console.log(`--- ${difficulty} (${Date.now() - t0}ms) ---`);
  console.log("regions:", res.regions.length, "| smallest areas:", areas.slice(0, 4).join(","), "| palette:", res.palette.map((p) => `${p.number}=${p.name}`).join(", "));
  console.log("validation:", res.validation.length ? res.validation.join(" | ") : "(clean)");
  console.log("white pocket numbered:", res.palette.some((p) => p.name.startsWith("White")));
  await sharp(res.numberedPage).toFile(`.cbn-test/cbn-${difficulty}-numbered.png`);
  await sharp(res.reference).toFile(`.cbn-test/cbn-${difficulty}-reference.png`);
}
console.log("done");
