import type { Candle, Quote } from "@/types";
import { attribution, type MarketProvider } from "./types";
import { logger } from "@/lib/log";
import { getEnv } from "@/lib/env";

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const QUOTE = "https://query1.finance.yahoo.com/v7/finance/quote";
const SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";

async function yahooFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; KodoScanner/1.0; +local personal use)",
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });
}

async function quoteFromChart(symbol: string): Promise<Quote | null> {
  try {
    const url = `${CHART}/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const res = await yahooFetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            symbol?: string;
            currency?: string;
          };
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
        }>;
      };
    };
    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    const closes = result?.indicators?.quote?.[0]?.close?.filter(
      (c): c is number => c != null
    );
    const price =
      meta?.regularMarketPrice ??
      (closes && closes.length ? closes[closes.length - 1] : undefined);
    if (price == null || !Number.isFinite(price)) return null;
    const prev =
      meta?.chartPreviousClose ??
      meta?.previousClose ??
      (closes && closes.length > 1 ? closes[closes.length - 2] : price);
    const change = price - (prev ?? price);
    const changePct = prev ? (change / prev) * 100 : 0;
    return {
      symbol: (meta?.symbol ?? symbol).toUpperCase(),
      price,
      change,
      changePct,
      currency: meta?.currency ?? "USD",
      asOf: new Date().toISOString(),
      attribution: attribution("yahoo", true, 15),
    };
  } catch (e) {
    logger.warn("yahoo chart quote failed", { symbol, error: String(e) });
    return null;
  }
}

function mapQuote(raw: Record<string, unknown>): Quote | null {
  const symbol = String(raw.symbol ?? "").toUpperCase();
  const price = Number(raw.regularMarketPrice ?? raw.postMarketPrice ?? 0);
  if (!symbol || !Number.isFinite(price) || price <= 0) return null;
  const change = Number(raw.regularMarketChange ?? 0);
  const changePct = Number(raw.regularMarketChangePercent ?? 0);
  return {
    symbol,
    price,
    change: Number.isFinite(change) ? change : 0,
    changePct: Number.isFinite(changePct) ? changePct : 0,
    volume: Number(raw.regularMarketVolume ?? 0) || undefined,
    marketCap: Number(raw.marketCap ?? 0) || undefined,
    currency: String(raw.currency ?? "USD"),
    asOf: new Date().toISOString(),
    attribution: attribution("yahoo", true, 15),
  };
}

export const yahooProvider: MarketProvider = {
  name: "yahoo",

  async getQuote(symbol: string): Promise<Quote | null> {
    if (!getEnv().ENABLE_YAHOO) return null;
    try {
      const res = await yahooFetch(
        `${QUOTE}?symbols=${encodeURIComponent(symbol)}`
      );
      if (res.ok) {
        const json = (await res.json()) as {
          quoteResponse?: { result?: Record<string, unknown>[] };
        };
        const row = json.quoteResponse?.result?.[0];
        const mapped = row ? mapQuote(row) : null;
        if (mapped) return mapped;
      }
    } catch (e) {
      logger.warn("yahoo quote failed", { symbol, error: String(e) });
    }
    // Fallback: chart meta (more reliable when quote endpoint is blocked)
    return quoteFromChart(symbol);
  },

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (!getEnv().ENABLE_YAHOO || symbols.length === 0) return [];
    try {
      const chunkSize = 40;
      const out: Quote[] = [];
      const missing: string[] = [];
      for (let i = 0; i < symbols.length; i += chunkSize) {
        const chunk = symbols.slice(i, i + chunkSize);
        try {
          const res = await yahooFetch(
            `${QUOTE}?symbols=${encodeURIComponent(chunk.join(","))}`
          );
          if (res.ok) {
            const json = (await res.json()) as {
              quoteResponse?: { result?: Record<string, unknown>[] };
            };
            const got = new Set<string>();
            for (const row of json.quoteResponse?.result ?? []) {
              const q = mapQuote(row);
              if (q) {
                out.push(q);
                got.add(q.symbol);
              }
            }
            for (const s of chunk) {
              if (!got.has(s.toUpperCase())) missing.push(s);
            }
            continue;
          }
        } catch {
          /* fall through */
        }
        missing.push(...chunk);
      }
      // Chart fallback for any missing
      for (const s of missing) {
        const q = await quoteFromChart(s);
        if (q) out.push(q);
      }
      return out;
    } catch (e) {
      logger.warn("yahoo quotes failed", { error: String(e) });
      const out: Quote[] = [];
      for (const s of symbols) {
        const q = await quoteFromChart(s);
        if (q) out.push(q);
      }
      return out;
    }
  },

  async getCandles(symbol: string, range = "1y"): Promise<Candle[] | null> {
    if (!getEnv().ENABLE_YAHOO) return null;
    try {
      const url = `${CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
      const res = await yahooFetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                open?: (number | null)[];
                high?: (number | null)[];
                low?: (number | null)[];
                close?: (number | null)[];
                volume?: (number | null)[];
              }>;
            };
          }>;
        };
      };
      const result = json.chart?.result?.[0];
      if (!result?.timestamp?.length) return null;
      const q = result.indicators?.quote?.[0];
      const candles: Candle[] = [];
      for (let i = 0; i < result.timestamp.length; i++) {
        const open = q?.open?.[i];
        const high = q?.high?.[i];
        const low = q?.low?.[i];
        const close = q?.close?.[i];
        const volume = q?.volume?.[i] ?? 0;
        if (
          open == null ||
          high == null ||
          low == null ||
          close == null ||
          !Number.isFinite(close)
        ) {
          continue;
        }
        candles.push({
          time: result.timestamp[i],
          open,
          high,
          low,
          close,
          volume: volume ?? 0,
        });
      }
      return candles.length ? candles : null;
    } catch (e) {
      logger.warn("yahoo candles failed", { symbol, error: String(e) });
      return null;
    }
  },

  async getMovers(): Promise<string[]> {
    // Best-effort day gainers via search / static liquid universe fallback
    const fallback = [
      "AAPL",
      "MSFT",
      "NVDA",
      "AMZN",
      "META",
      "GOOGL",
      "TSLA",
      "AMD",
      "AVGO",
      "NFLX",
      "CRM",
      "ORCL",
      "COST",
      "JPM",
      "XOM",
      "UNH",
      "LLY",
      "V",
      "MA",
      "BAC",
      "WMT",
      "HD",
      "PG",
      "KO",
      "PEP",
      "DIS",
      "INTC",
      "QCOM",
      "TXN",
      "AMAT",
      "MU",
      "SMCI",
      "PLTR",
      "UBER",
      "SHOP",
      "SQ",
      "COIN",
      "BA",
      "CAT",
      "GE",
      "GS",
      "MS",
      "C",
      "WFC",
      "T",
      "VZ",
      "PFE",
      "MRK",
      "ABBV",
      "CVX",
    ];
    try {
      const res = await yahooFetch(
        `${SEARCH}?q=day%20gainers&quotesCount=25&newsCount=0`
      );
      if (!res.ok) return fallback;
      const json = (await res.json()) as {
        quotes?: Array<{ symbol?: string; quoteType?: string }>;
      };
      const syms = (json.quotes ?? [])
        .filter((q) => q.quoteType === "EQUITY" && q.symbol)
        .map((q) => String(q.symbol).toUpperCase())
        .filter((s) => !s.includes("=") && !s.includes("^"));
      const merged = Array.from(new Set([...syms, ...fallback]));
      return merged.slice(0, 50);
    } catch {
      return fallback;
    }
  },

  async getNews(symbol?: string) {
    try {
      const q = symbol ? encodeURIComponent(symbol) : "stock%20market";
      const res = await yahooFetch(
        `${SEARCH}?q=${q}&quotesCount=0&newsCount=12`
      );
      if (!res.ok) return [];
      const json = (await res.json()) as {
        news?: Array<{
          title?: string;
          link?: string;
          publisher?: string;
          providerPublishTime?: number;
        }>;
      };
      return (json.news ?? []).map((n) => ({
        title: n.title ?? "Untitled",
        url: n.link,
        source: n.publisher,
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : undefined,
      }));
    } catch {
      return [];
    }
  },
};
