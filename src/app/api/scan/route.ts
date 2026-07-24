import { err, ok } from "@/lib/api";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { runScan } from "@/lib/scan/engine";
import { detectMarketRegime } from "@/lib/regime/detect";
import type { MarketRegime, ScanFilters } from "@/types";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Partial<ScanFilters> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const filters: ScanFilters = {
    universe: body.universe ?? "movers",
    symbols: body.symbols,
    minScore: body.minScore ?? 55,
    marketCapMin: body.marketCapMin,
    marketCapMax: body.marketCapMax,
    priceMin: body.priceMin,
    priceMax: body.priceMax,
    sideBias: body.sideBias ?? "any",
    minAvgVolume: body.minAvgVolume,
    maxSymbols: Math.min(
      body.maxSymbols ?? getEnv().SCAN_MAX_SYMBOLS,
      getEnv().SCAN_MAX_SYMBOLS
    ),
  };

  let regime = cacheGet<MarketRegime>("regime:v1");
  if (!regime) {
    regime = await detectMarketRegime();
    cacheSet("regime:v1", regime, TTL.regime);
  }

  const started = Date.now();
  const { results, universeSize, symbolsScanned } = await runScan(
    filters,
    regime
  );

  return ok({
    results,
    regime,
    filters,
    meta: {
      universeSize,
      symbolsScanned,
      durationMs: Date.now() - started,
      maxSymbols: getEnv().SCAN_MAX_SYMBOLS,
      dataMode: "delayed",
      callBudgetHint:
        "Cold scan ≈ N candle fetches + batch quotes + regime; cache TTL 5m candles.",
    },
    ranAt: new Date().toISOString(),
  });
}
