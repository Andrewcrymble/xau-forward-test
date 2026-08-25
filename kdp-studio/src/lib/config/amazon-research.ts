// Amazon niche research helper — links the user opens themselves plus a
// rough BSR → sales estimator. The app NEVER scrapes Amazon or invents
// market data: the user reads public BSR/price figures off Amazon pages and
// types them in; everything derived from them is clearly labelled a rough
// estimate.

export const AMAZON_MARKETS = [
  { id: "amazon_com", label: "Amazon.com (US)", host: "www.amazon.com", spelling: "coloring book" },
  { id: "amazon_co_uk", label: "Amazon.co.uk (UK)", host: "www.amazon.co.uk", spelling: "colouring book" },
] as const;

export type AmazonMarketId = (typeof AMAZON_MARKETS)[number]["id"];

/** Books-department search URL for a niche, spelled for the marketplace. */
export function amazonSearchUrl(market: AmazonMarketId, nicheName: string): string {
  const m = AMAZON_MARKETS.find((x) => x.id === market) ?? AMAZON_MARKETS[0];
  // Strip our own qualifiers so "Cosy Cottages Colouring Book" doesn't
  // double up, then append the marketplace's spelling.
  const base = nicheName.replace(/colou?ring\s*(book|pages)?/gi, "").replace(/\s+/g, " ").trim();
  const q = encodeURIComponent(`${base} ${m.spelling}`.trim());
  return `https://${m.host}/s?k=${q}&i=stripbooks`;
}

/**
 * Rough monthly-sales estimate from a Books Best Sellers Rank. Power-law
 * fitted to widely published industry approximations for Amazon US books
 * (~80/day at BSR 1,000; ~1/day at BSR 100,000), capped at 500/day. The UK
 * marketplace is far smaller, so the same rank is scaled down to ~30%.
 * ESTIMATE ONLY — real sales vary widely, especially day to day.
 */
export function estimateMonthlySales(bsr: number, market: AmazonMarketId): number | null {
  if (!Number.isFinite(bsr) || bsr < 1) return null;
  const perDay = Math.min(500, 57000 * Math.pow(bsr, -0.951));
  const scaled = market === "amazon_co_uk" ? perDay * 0.3 : perDay;
  const monthly = scaled * 30;
  // Round to a sensibly fuzzy precision — false precision misleads.
  if (monthly >= 1000) return Math.round(monthly / 100) * 100;
  if (monthly >= 100) return Math.round(monthly / 10) * 10;
  return Math.max(1, Math.round(monthly));
}

export const AMAZON_RESEARCH_DISCLAIMER =
  "Estimates derived from public Best Sellers Rank using a rough industry curve — " +
  "not actual sales figures. BSR moves daily; treat these as order-of-magnitude only.";
