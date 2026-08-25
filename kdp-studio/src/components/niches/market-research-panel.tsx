"use client";

// Amazon niche research: ready-made search links the user opens themselves,
// plus paste-in fields for the public BSR/price of the top results. The app
// derives rough sales estimates from those observed numbers — it never
// scrapes Amazon and never invents market data.

import { useState } from "react";
import {
  AMAZON_MARKETS,
  AMAZON_RESEARCH_DISCLAIMER,
  amazonSearchUrl,
  estimateMonthlySales,
  type AmazonMarketId,
} from "@/lib/config/amazon-research";
import type { ApiResponse, NicheIdeaDto } from "@/lib/types";
import { Button } from "@/components/ui";

interface Row {
  bsr: string;
  price: string;
}

const EMPTY_ROWS: Row[] = Array.from({ length: 5 }, () => ({ bsr: "", price: "" }));

export function MarketResearchPanel({
  idea,
  onUpdated,
}: {
  idea: NicheIdeaDto;
  onUpdated: (updated: NicheIdeaDto) => void;
}) {
  const saved = idea.marketData?.amazon ?? null;
  const etsy = idea.marketData?.etsy ?? null;
  const [etsyBusy, setEtsyBusy] = useState(false);
  const [etsyError, setEtsyError] = useState<string | null>(null);
  const [etsyManualOpen, setEtsyManualOpen] = useState(false);
  const [em, setEm] = useState({
    listings: "",
    priceMin: "",
    priceMax: "",
    shopName: "",
    shopSales: "",
  });

  const etsySearchLink = `https://www.etsy.com/search?q=${encodeURIComponent(
    `${idea.name.replace(/colou?ring\s*(book|books|pages)?/gi, "").trim()} coloring pages`,
  )}`;

  const saveEtsyManual = async () => {
    const listings = parseInt(em.listings.replace(/[,.\s]/g, ""), 10);
    if (!Number.isFinite(listings)) {
      setEtsyError("Enter at least the number of results Etsy shows.");
      return;
    }
    setEtsyBusy(true);
    setEtsyError(null);
    try {
      const shopSales = parseInt(em.shopSales.replace(/[,.\s]/g, ""), 10);
      const res = await fetch(`/api/niches/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etsyManual: {
            activeListings: listings,
            priceMin: parseFloat(em.priceMin) || null,
            priceMax: parseFloat(em.priceMax) || null,
            topShops:
              em.shopName.trim() && Number.isFinite(shopSales)
                ? [{ name: em.shopName.trim(), sales: shopSales }]
                : [],
          },
        }),
      });
      const json: ApiResponse<NicheIdeaDto> = await res.json();
      if (!json.ok) throw new Error(json.error);
      onUpdated(json.data);
      setEtsyManualOpen(false);
    } catch (err) {
      setEtsyError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setEtsyBusy(false);
    }
  };

  const scanEtsy = async () => {
    setEtsyBusy(true);
    setEtsyError(null);
    try {
      const res = await fetch(`/api/niches/${idea.id}/etsy-scan`, { method: "POST" });
      const json: ApiResponse<NicheIdeaDto> = await res.json();
      if (!json.ok) throw new Error(json.error);
      onUpdated(json.data);
    } catch (err) {
      setEtsyError(err instanceof Error ? err.message : "Etsy scan failed");
    } finally {
      setEtsyBusy(false);
    }
  };
  const [market, setMarket] = useState<AmazonMarketId>(saved?.market ?? "amazon_co_uk");
  const [rows, setRows] = useState<Row[]>(
    saved
      ? [
          ...saved.entries.map((e) => ({ bsr: String(e.bsr), price: e.price != null ? String(e.price) : "" })),
          ...EMPTY_ROWS,
        ].slice(0, 5)
      : EMPTY_ROWS,
  );
  const [note, setNote] = useState(saved?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = rows
    .map((r) => ({ bsr: parseInt(r.bsr.replace(/[,.\s]/g, ""), 10), price: parseFloat(r.price) }))
    .filter((e) => Number.isFinite(e.bsr) && e.bsr >= 1)
    .map((e) => ({ bsr: e.bsr, price: Number.isFinite(e.price) ? e.price : null }));

  const estimates = entries.map((e) => estimateMonthlySales(e.bsr, market)).filter((n): n is number => n != null);
  const totalMonthly = estimates.reduce((a, b) => a + b, 0);
  const prices = entries.map((e) => e.price).filter((p): p is number => p != null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/niches/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amazonResearch: entries.length > 0 ? { market, entries, note: note || null } : null,
        }),
      });
      const json: ApiResponse<NicheIdeaDto> = await res.json();
      if (!json.ok) throw new Error(json.error);
      onUpdated(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save research");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
      <p className="text-xs font-semibold text-amber-900">Amazon research</p>
      <div className="flex flex-wrap gap-2">
        {AMAZON_MARKETS.map((m) => (
          <a
            key={m.id}
            href={amazonSearchUrl(m.id, idea.name)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMarket(m.id)}
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Search {m.label} ↗
          </a>
        ))}
      </div>
      <p className="text-[11px] text-amber-800">
        Open a search, then for the top results copy each book&apos;s{" "}
        <strong>Best Sellers Rank</strong> (on its product page under
        &ldquo;Product details&rdquo;) and price into the rows below.
      </p>
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          <span>Best Sellers Rank</span>
          <span>Price</span>
          <span>Est. sales / month</span>
        </div>
        {rows.map((r, i) => {
          const bsr = parseInt(r.bsr.replace(/[,.\s]/g, ""), 10);
          const est = Number.isFinite(bsr) && bsr >= 1 ? estimateMonthlySales(bsr, market) : null;
          return (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr] items-center gap-1.5">
              <input
                inputMode="numeric"
                placeholder="e.g. 45,000"
                value={r.bsr}
                onChange={(e) =>
                  setRows((prev) => prev.map((x, j) => (j === i ? { ...x, bsr: e.target.value } : x)))
                }
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs"
              />
              <input
                inputMode="decimal"
                placeholder="e.g. 6.99"
                value={r.price}
                onChange={(e) =>
                  setRows((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))
                }
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs"
              />
              <span className="text-xs font-semibold text-stone-700">
                {est != null ? `~${est.toLocaleString()}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      {entries.length > 0 && (
        <p className="text-xs text-stone-700">
          Top {entries.length} combined: <strong>~{totalMonthly.toLocaleString()} sales/month</strong>
          {prices.length > 0 && (
            <>
              {" "}
              · prices {Math.min(...prices).toFixed(2)}–{Math.max(...prices).toFixed(2)}
            </>
          )}
        </p>
      )}
      <input
        placeholder="Note (e.g. search phrase used, results count seen)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-xs"
      />
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={busy || entries.length === 0} onClick={save}>
          {busy ? "Saving…" : saved ? "Update research" : "Save research"}
        </Button>
        {saved && (
          <span className="text-[11px] text-stone-500">
            Saved {new Date(saved.capturedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[10px] text-amber-700">{AMAZON_RESEARCH_DISCLAIMER}</p>

      <div className="mt-1 space-y-2 border-t border-amber-200 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-amber-900">Etsy market scan</p>
          <Button variant="secondary" disabled={etsyBusy} onClick={scanEtsy}>
            {etsyBusy ? "Scanning…" : etsy?.source !== "manual" && etsy ? "Re-scan Etsy" : "Scan Etsy market"}
          </Button>
          <a
            href={etsySearchLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Search Etsy ↗
          </a>
          <button
            type="button"
            onClick={() => setEtsyManualOpen((v) => !v)}
            className="text-[11px] font-semibold text-amber-800 underline underline-offset-2"
          >
            {etsyManualOpen ? "Hide manual entry" : "No API key? Enter manually"}
          </button>
        </div>
        {etsyManualOpen && (
          <div className="space-y-1.5 rounded-md border border-amber-200 bg-white/70 p-2">
            <p className="text-[11px] text-amber-800">
              Open the Etsy search above and copy what you see: the results
              count at the top, the typical price range, and (optional) tap a
              top shop — its total sales show under the shop name.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <input inputMode="numeric" placeholder="Results count" value={em.listings}
                onChange={(e) => setEm((p) => ({ ...p, listings: e.target.value }))}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs" />
              <input inputMode="decimal" placeholder="Price from" value={em.priceMin}
                onChange={(e) => setEm((p) => ({ ...p, priceMin: e.target.value }))}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs" />
              <input inputMode="decimal" placeholder="Price to" value={em.priceMax}
                onChange={(e) => setEm((p) => ({ ...p, priceMax: e.target.value }))}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs" />
            </div>
            <div className="grid grid-cols-[2fr_1fr_auto] items-center gap-1.5">
              <input placeholder="Top shop name (optional)" value={em.shopName}
                onChange={(e) => setEm((p) => ({ ...p, shopName: e.target.value }))}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs" />
              <input inputMode="numeric" placeholder="Its sales" value={em.shopSales}
                onChange={(e) => setEm((p) => ({ ...p, shopSales: e.target.value }))}
                className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs" />
              <Button variant="secondary" disabled={etsyBusy} onClick={saveEtsyManual}>
                Save
              </Button>
            </div>
          </div>
        )}
        {etsy && (
          <div className="space-y-1 text-xs text-stone-700">
            <p>
              <strong>{etsy.activeListings.toLocaleString()}</strong> active listings for
              &ldquo;{etsy.query}&rdquo;
              {etsy.priceMin != null && (
                <>
                  {" "}
                  · prices {etsy.priceMin.toFixed(2)}–{etsy.priceMax?.toFixed(2)}
                  {etsy.currency ? ` ${etsy.currency}` : ""}
                  {etsy.priceMedian != null && <> (median {etsy.priceMedian.toFixed(2)})</>}
                </>
              )}
              {etsy.avgFavourites != null && <> · avg {etsy.avgFavourites} favourites</>}
            </p>
            {etsy.topShops.length > 0 && (
              <p>
                Top shops (lifetime total sales):{" "}
                {etsy.topShops
                  .map((s) => `${s.name} (${s.sales.toLocaleString()})`)
                  .join(", ")}
              </p>
            )}
            <p className="text-[10px] text-amber-700">
              {etsy.source === "manual"
                ? "Figures you read off Etsy's public pages, saved "
                : "Live data from Etsy's official API, captured "}
              {new Date(etsy.capturedAt).toLocaleString()}. Shop sales are
              whole-shop lifetime totals — Etsy publishes no per-listing sales.
            </p>
          </div>
        )}
        {etsyError && <p className="text-xs text-red-600">{etsyError}</p>}
      </div>
    </div>
  );
}
