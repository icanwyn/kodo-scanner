import { getEnv } from "@/lib/env";
import { getCandles, getMovers, getQuotes } from "@/lib/providers/cascade";
import type { MarketRegime, ScanFilters, ScoredSetup } from "@/types";
import { prisma } from "@/lib/db";
import { createLimiter } from "@/lib/providers/limit";
import { scoreSymbol, structuralBiasFromCandles } from "./scorer";
import { logger } from "@/lib/log";
import { attachApexToResults } from "@/lib/apex/attach";

const limit = createLimiter(4);

export async function resolveUniverse(filters: ScanFilters): Promise<string[]> {
  const max = Math.min(
    filters.maxSymbols ?? getEnv().SCAN_MAX_SYMBOLS,
    getEnv().SCAN_MAX_SYMBOLS
  );

  if (filters.universe === "custom" && filters.symbols?.length) {
    return filters.symbols.map((s) => s.toUpperCase()).slice(0, max);
  }

  if (filters.universe === "watchlist") {
    try {
      const items = await prisma.watchlistItem.findMany({
        orderBy: { updatedAt: "desc" },
      });
      if (items.length) return items.map((i) => i.symbol).slice(0, max);
    } catch {
      /* db may not be ready */
    }
  }

  const movers = await getMovers();
  return movers.slice(0, max);
}

export async function runScan(
  filters: ScanFilters,
  regime: MarketRegime
): Promise<{ results: ScoredSetup[]; universeSize: number; symbolsScanned: number }> {
  const symbols = await resolveUniverse(filters);
  const quotes = await getQuotes(symbols);
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  const results: ScoredSetup[] = [];
  let scanned = 0;

  await Promise.all(
    symbols.map((symbol) =>
      limit(async () => {
        try {
          const candles = await getCandles(symbol, "1y");
          if (!candles || candles.length < 60) return;
          const q = quoteMap.get(symbol);
          const price = q?.price ?? candles[candles.length - 1].close;
          const changePct = q?.changePct ?? 0;

          if (filters.priceMin != null && price < filters.priceMin) return;
          if (filters.priceMax != null && price > filters.priceMax) return;
          if (filters.marketCapMin != null && (q?.marketCap ?? 0) < filters.marketCapMin)
            return;
          if (filters.marketCapMax != null && q?.marketCap != null && q.marketCap > filters.marketCapMax)
            return;

          const structural = structuralBiasFromCandles(candles);
          const want = filters.sideBias ?? "any";
          if (want === "long" || want === "short") {
            if (structural !== want) return;
          }

          const sideIntent =
            structural === "neutral" ? "long" : structural;

          const setup = scoreSymbol({
            symbol,
            candles,
            price,
            changePct,
            regime,
            sideIntent,
            attribution: q
              ? [q.attribution]
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
          setup.marketCap = q?.marketCap;

          const minScore = filters.minScore ?? 0;
          if (setup.confluenceScore < minScore) return;

          results.push(setup);
          scanned += 1;
        } catch (e) {
          logger.debug("scan symbol failed", { symbol, error: String(e) });
        }
      })
    )
  );

  results.sort((a, b) => b.confluenceScore - a.confluenceScore);
  const withApex = attachApexToResults(results, regime);
  return {
    results: withApex,
    universeSize: symbols.length,
    symbolsScanned: scanned,
  };
}
