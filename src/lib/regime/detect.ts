import { getCandles, getQuote } from "@/lib/providers/cascade";
import { lastAdx, lastEma } from "@/lib/indicators";
import type { MarketRegime, MarketRegimeLabel } from "@/types";
import { attribution } from "@/lib/providers/types";

const SECTORS = [
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "XLI",
  "XLY",
  "XLP",
  "XLU",
  "XLRE",
  "XLB",
  "XLC",
];

function ret20(closes: number[]): number | null {
  if (closes.length < 21) return null;
  const a = closes[closes.length - 1];
  const b = closes[closes.length - 21];
  if (!b) return null;
  return (a - b) / b;
}

function trendFrom(closes: number[]): "up" | "down" | "flat" {
  const e20 = lastEma(closes, 20);
  const e50 = lastEma(closes, 50);
  const r = ret20(closes);
  if (e20 == null || e50 == null || r == null) return "flat";
  if (e20 > e50 * 1.001 && r > 0) return "up";
  if (e20 < e50 * 0.999 && r < 0) return "down";
  return "flat";
}

function vixContext(vix: number | null): MarketRegime["vixContext"] {
  if (vix == null) return "unknown";
  if (vix < 15) return "low";
  if (vix <= 20) return "normal";
  if (vix <= 30) return "elevated";
  return "crisis";
}

export async function detectMarketRegime(): Promise<MarketRegime> {
  const notes: string[] = [];
  const attrs = [attribution("yahoo", true, 15)];

  const [spyC, qqqC, vixC] = await Promise.all([
    getCandles("SPY", "6mo"),
    getCandles("QQQ", "6mo"),
    getCandles("^VIX", "6mo"),
  ]);

  const spyCloses = spyC?.map((c) => c.close) ?? [];
  const qqqCloses = qqqC?.map((c) => c.close) ?? [];
  const spyTrend = trendFrom(spyCloses);
  const qqqTrend = trendFrom(qqqCloses);
  const adxSpy = spyC ? lastAdx(spyC, 14) : null;
  const spyR20 = ret20(spyCloses);

  let vixLevel: number | null = null;
  if (vixC?.length) vixLevel = vixC[vixC.length - 1].close;
  else {
    const q = await getQuote("^VIX");
    vixLevel = q?.price ?? null;
  }

  let label: MarketRegimeLabel = "UNKNOWN";

  if (vixLevel != null && vixLevel > 30) {
    label = "HIGH_VOLATILITY";
    notes.push("VIX crisis override (>30)");
  } else if (adxSpy != null && adxSpy < 20) {
    label = "RANGE";
    notes.push("ADX(14) SPY < 20 → range");
  } else if (
    spyTrend === "up" &&
    qqqTrend === "up" &&
    (adxSpy ?? 0) >= 30 &&
    (spyR20 ?? 0) >= 0.05
  ) {
    label = "STRONG_TREND_UP";
  } else if (
    spyTrend === "down" &&
    qqqTrend === "down" &&
    (adxSpy ?? 0) >= 30 &&
    (spyR20 ?? 0) <= -0.05
  ) {
    label = "STRONG_TREND_DOWN";
  } else if (
    spyTrend === "up" &&
    (qqqTrend === "up" || qqqTrend === "flat") &&
    (adxSpy ?? 0) >= 20
  ) {
    label = "TREND_UP";
  } else if (
    spyTrend === "down" &&
    (qqqTrend === "down" || qqqTrend === "flat") &&
    (adxSpy ?? 0) >= 20
  ) {
    label = "TREND_DOWN";
  } else if (spyTrend === "up") {
    label = "TREND_UP";
    notes.push("Weak bullish agreement");
  } else if (spyTrend === "down") {
    label = "TREND_DOWN";
    notes.push("Weak bearish agreement");
  } else {
    label = "RANGE";
  }

  // Sector RS
  const spyRet = spyR20 ?? 0;
  const sectorRS: { symbol: string; relStrength: number }[] = [];
  await Promise.all(
    SECTORS.map(async (sym) => {
      const c = await getCandles(sym, "3mo");
      if (!c) return;
      const r = ret20(c.map((x) => x.close));
      if (r == null) return;
      sectorRS.push({ symbol: sym, relStrength: r - spyRet });
    })
  );
  sectorRS.sort((a, b) => b.relStrength - a.relStrength);

  return {
    label,
    asOf: new Date().toISOString(),
    spyTrend,
    qqqTrend,
    adxSpy,
    vixLevel,
    vixContext: vixContext(vixLevel),
    sectorLeaders: sectorRS.slice(0, 3),
    sectorLaggards: sectorRS.slice(-3).reverse(),
    notes,
    sourceAttribution: attrs,
  };
}
