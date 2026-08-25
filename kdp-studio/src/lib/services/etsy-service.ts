import { prisma } from "@/lib/db";
import { PageServiceError } from "@/lib/services/page-service";
import { mergeNicheMarketData } from "@/lib/services/niche-service";
import type { EtsyScan, NicheIdeaDto } from "@/lib/types";

// Live Etsy market scan through Etsy's OFFICIAL Open API v3 — real market
// data (active listing counts, prices, favourites, shop-level lifetime
// sales), fetched legitimately with the user's own API key. Etsy exposes no
// per-listing sales figures; shop totals are the closest public signal.

const ETSY_BASE = "https://openapi.etsy.com/v3/application";

interface EtsyListing {
  listing_id: number;
  shop_id: number;
  num_favorers: number | null;
  price: { amount: number; divisor: number; currency_code: string } | null;
}

async function etsyGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${ETSY_BASE}${path}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new PageServiceError(
        "Etsy rejected the API key — check the ETSY_API_KEY secret (use the app's KEYSTRING from etsy.com/developers).",
        502,
      );
    }
    throw new PageServiceError(
      `Etsy API error (${res.status}): ${text.slice(0, 200)}`,
      502,
    );
  }
  return (await res.json()) as T;
}

/** Search query for a niche: strip our own qualifiers, Etsy skews US. */
function etsyQuery(nicheName: string): string {
  const base = nicheName
    .replace(/colou?ring\s*(book|books|pages)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${base} coloring pages`.trim();
}

export async function scanEtsyMarket(nicheId: string): Promise<NicheIdeaDto> {
  const apiKey = process.env.ETSY_API_KEY;
  if (!apiKey) {
    throw new PageServiceError(
      "Etsy scanning needs an Etsy API key. Register a free app at etsy.com/developers, then add its KEYSTRING as the ETSY_API_KEY secret (see DEPLOY.md).",
      409,
    );
  }
  const idea = await prisma.nicheIdea.findUnique({ where: { id: nicheId } });
  if (!idea) throw new PageServiceError("Niche idea not found", 404);

  const query = etsyQuery(idea.name);
  const search = await etsyGet<{ count: number; results: EtsyListing[] }>(
    `/listings/active?keywords=${encodeURIComponent(query)}&limit=25`,
    apiKey,
  );
  const results = search.results ?? [];

  // Price stats in the dominant currency of the sample.
  const byCurrency = new Map<string, number[]>();
  for (const l of results) {
    if (!l.price) continue;
    const list = byCurrency.get(l.price.currency_code) ?? [];
    list.push(l.price.amount / l.price.divisor);
    byCurrency.set(l.price.currency_code, list);
  }
  let currency: string | null = null;
  let prices: number[] = [];
  for (const [cur, list] of byCurrency) {
    if (list.length > prices.length) {
      currency = cur;
      prices = list;
    }
  }
  prices.sort((a, b) => a - b);

  const favs = results
    .map((l) => l.num_favorers)
    .filter((n): n is number => typeof n === "number");

  // Lifetime sales of the top distinct shops (shop-level public totals).
  const shopIds = [...new Set(results.map((l) => l.shop_id))].slice(0, 5);
  const topShops: { name: string; sales: number }[] = [];
  for (const id of shopIds) {
    try {
      const shop = await etsyGet<{ shop_name: string; transaction_sold_count: number }>(
        `/shops/${id}`,
        apiKey,
      );
      topShops.push({ name: shop.shop_name, sales: shop.transaction_sold_count ?? 0 });
    } catch {
      // One failed shop lookup shouldn't sink the scan.
    }
  }
  topShops.sort((a, b) => b.sales - a.sales);

  const scan: EtsyScan = {
    query,
    activeListings: search.count ?? results.length,
    sampled: results.length,
    currency,
    priceMin: prices.length ? prices[0] : null,
    priceMedian: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    priceMax: prices.length ? prices[prices.length - 1] : null,
    avgFavourites: favs.length
      ? Math.round(favs.reduce((a, b) => a + b, 0) / favs.length)
      : null,
    topShops,
    capturedAt: new Date().toISOString(),
  };
  return mergeNicheMarketData(nicheId, { etsy: scan });
}
