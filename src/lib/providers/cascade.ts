import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import type { Candle, Quote } from "@/types";
import { yahooProvider } from "./yahoo";
import type { MarketProvider } from "./types";
import { marketLimit } from "./limit";
import { logger } from "@/lib/log";

const providers: MarketProvider[] = [yahooProvider];

const cooldowns = new Map<string, number>();

function available(p: MarketProvider): boolean {
  const until = cooldowns.get(p.name) ?? 0;
  return Date.now() >= until;
}

function cool(name: string, ms = 60_000) {
  cooldowns.set(name, Date.now() + ms);
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const key = `quote:${symbol}`;
  const hit = cacheGet<Quote>(key);
  if (hit) return hit;

  for (const p of providers) {
    if (!available(p)) continue;
    try {
      const q = await marketLimit(() => p.getQuote(symbol));
      if (q) {
        cacheSet(key, q, TTL.quote);
        return q;
      }
    } catch (e) {
      logger.warn("provider quote error", { provider: p.name, error: String(e) });
      cool(p.name, 30_000);
    }
  }
  return null;
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const uniq = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const out: Quote[] = [];
  const missing: string[] = [];

  for (const s of uniq) {
    const hit = cacheGet<Quote>(`quote:${s}`);
    if (hit) out.push(hit);
    else missing.push(s);
  }

  if (missing.length === 0) return out;

  for (const p of providers) {
    if (!available(p) || missing.length === 0) continue;
    try {
      const batch = await marketLimit(() => p.getQuotes(missing));
      for (const q of batch) {
        cacheSet(`quote:${q.symbol}`, q, TTL.quote);
        out.push(q);
      }
      const got = new Set(batch.map((q) => q.symbol));
      for (let i = missing.length - 1; i >= 0; i--) {
        if (got.has(missing[i])) missing.splice(i, 1);
      }
    } catch (e) {
      logger.warn("provider quotes error", { provider: p.name, error: String(e) });
      cool(p.name, 30_000);
    }
  }
  return out;
}

export async function getCandles(
  symbol: string,
  range = "1y"
): Promise<Candle[] | null> {
  const key = `candles:1d:${symbol}:${range}`;
  const hit = cacheGet<Candle[]>(key);
  if (hit) return hit;

  for (const p of providers) {
    if (!available(p)) continue;
    try {
      const c = await marketLimit(() => p.getCandles(symbol, range));
      if (c && c.length >= 30) {
        cacheSet(key, c, TTL.candles);
        return c;
      }
    } catch (e) {
      logger.warn("provider candles error", {
        provider: p.name,
        symbol,
        error: String(e),
      });
      cool(p.name, 30_000);
    }
  }
  return null;
}

export async function getMovers(): Promise<string[]> {
  const key = "movers";
  const hit = cacheGet<string[]>(key);
  if (hit) return hit;

  for (const p of providers) {
    if (!available(p) || !p.getMovers) continue;
    try {
      const m = await marketLimit(() => p.getMovers!());
      if (m.length) {
        cacheSet(key, m, TTL.movers);
        return m;
      }
    } catch (e) {
      logger.warn("movers error", { provider: p.name, error: String(e) });
    }
  }
  return ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD"];
}

export async function getNews(symbol?: string) {
  const key = `news:${symbol ?? "market"}`;
  const hit = cacheGet<{ title: string; url?: string; source?: string; publishedAt?: string }[]>(key);
  if (hit) return hit;

  for (const p of providers) {
    if (!p.getNews) continue;
    try {
      const n = await marketLimit(() => p.getNews!(symbol));
      if (n.length) {
        cacheSet(key, n, TTL.news);
        return n;
      }
    } catch {
      /* try next */
    }
  }
  return [];
}
