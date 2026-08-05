import { err, isValidSymbol, normalizeSymbol, ok } from "@/lib/api";
import { getCandles, getNews, getQuote } from "@/lib/providers/cascade";
import { detectMarketRegime } from "@/lib/regime/detect";
import { scoreSymbol, structuralBiasFromCandles } from "@/lib/scan/scorer";
import { runDeepAnalysis } from "@/lib/agent/client";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { getEnv } from "@/lib/env";
import type { MarketRegime } from "@/types";
import { buildApexRecommendation } from "@/lib/apex/attach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CachedAnalysisPayload = {
  setup: unknown;
  regime: MarketRegime;
  news: unknown[];
  thesis: unknown;
  model: string;
  error?: { code: string; message: string };
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = normalizeSymbol(String(body.symbol ?? ""));
  if (!isValidSymbol(symbol)) return err("INVALID_SYMBOL", "Invalid symbol");

  const force = Boolean(body.force);
  const modelDefault = getEnv().XAI_MODEL?.trim() || "grok-4.5";
  const fullKey = `analysis:full:${symbol}:${modelDefault}`;

  // Server-side full response cache — skip LLM + heavy work when possible
  if (!force) {
    const cached = cacheGet<CachedAnalysisPayload>(fullKey);
    if (cached?.thesis) {
      return ok({
        ...cached,
        cached: true,
      });
    }
  }

  const [quote, candles, news] = await Promise.all([
    getQuote(symbol),
    getCandles(symbol, "1y"),
    getNews(symbol),
  ]);

  if (!candles || candles.length < 60) {
    return err("INSUFFICIENT_DATA", "Need ≥60 daily bars", 422);
  }

  let regime = cacheGet<MarketRegime>("regime:v1");
  if (!regime) {
    regime = await detectMarketRegime();
    cacheSet("regime:v1", regime, TTL.regime);
  }

  const price = quote?.price ?? candles[candles.length - 1].close;
  const structural = structuralBiasFromCandles(candles);
  const sideIntent = structural === "neutral" ? "long" : structural;
  const setup = scoreSymbol({
    symbol,
    candles,
    price,
    changePct: quote?.changePct ?? 0,
    regime,
    sideIntent,
    attribution: quote
      ? [quote.attribution]
      : [
          {
            provider: "yahoo",
            delayed: true,
            delayMinutes: 15,
            fetchedAt: new Date().toISOString(),
          },
        ],
  });
  setup.sideBias = structural;
  setup.apex = buildApexRecommendation(setup, regime);

  const analysis = await runDeepAnalysis({
    symbol,
    price,
    regime,
    factors: setup.factors,
    confluenceScore: setup.confluenceScore,
    sideBias: structural,
    headlines: news.map((n) => n.title).slice(0, 8),
    apexPrimary: setup.apex.primary
      ? {
          engine: setup.apex.primary.engine,
          structure: setup.apex.primary.structure,
          notes: setup.apex.primary.notes,
        }
      : null,
    ivRankProxy: setup.apex.ivRankProxy,
  });

  const model =
    (analysis.ok ? analysis.model : analysis.model) || modelDefault;

  if (!analysis.ok) {
    const payload = {
      setup,
      regime,
      news,
      thesis: null as null,
      model,
      error: { code: analysis.code, message: analysis.message },
      cached: false as const,
    };
    return ok(payload);
  }

  const payload: CachedAnalysisPayload & { cached: boolean } = {
    setup,
    regime,
    news,
    thesis: analysis.thesis,
    model: analysis.model,
    cached: analysis.cached,
  };

  // Persist successful thesis for re-opens (server process)
  cacheSet(fullKey, payload, TTL.analysis);

  return ok(payload);
}
