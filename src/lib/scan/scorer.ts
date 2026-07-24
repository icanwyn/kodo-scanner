import type { Candle, FactorResult, MarketRegime, ScoredSetup } from "@/types";
import {
  atr,
  lastAdx,
  lastAtr,
  lastEma,
  lastMacd,
  lastRsi,
  macd as macdSeries,
  sma,
  anchoredVwap,
} from "@/lib/indicators";
import {
  FACTOR_CONFIG,
  clamp,
  rsiScoreLong,
  rsiScoreShort,
} from "./factors";
import { inferSideBias } from "./sideBias";
import { findSR } from "./levels";

function cfg(id: string) {
  return FACTOR_CONFIG.find((f) => f.id === id)!;
}

function mk(
  id: string,
  score: number,
  detail: string,
  raw?: number | string
): FactorResult {
  const c = cfg(id);
  const s = clamp(score, 0, 100);
  return {
    id,
    name: c.name,
    weight: c.weight,
    score: s,
    passed: s >= c.passThreshold,
    detail,
    raw,
    value: raw,
  };
}

export function scoreSymbol(args: {
  symbol: string;
  candles: Candle[];
  price: number;
  changePct: number;
  regime: MarketRegime;
  sideIntent: "long" | "short";
  attribution: ScoredSetup["attribution"];
}): ScoredSetup {
  const { symbol, candles, price, changePct, regime, sideIntent, attribution } =
    args;
  const closes = candles.map((c) => c.close);
  const n = candles.length;
  const close = closes[n - 1];
  const atr14 = lastAtr(candles, 14) ?? Math.max(close * 0.02, 0.01);
  const atrSeries = atr(candles, 14)
    .filter((v): v is number => v != null);
  const atrAvg =
    atrSeries.length >= 20
      ? atrSeries.slice(-20).reduce((a, b) => a + b, 0) / 20
      : atr14;

  const e20 = lastEma(closes, 20) ?? close;
  const e50 = lastEma(closes, 50) ?? close;
  const e200 = closes.length >= 200 ? lastEma(closes, 200) ?? close : e50;
  const rsiV = lastRsi(closes, 14) ?? 50;
  const macdNow = lastMacd(closes);
  const macdAll = macdSeries(closes);
  const hist = macdNow.hist ?? 0;
  const histPrev =
    macdAll.length >= 2 ? (macdAll[macdAll.length - 2].hist ?? 0) : 0;

  // 1 breakout
  const look = 20;
  const prior = candles.slice(Math.max(0, n - 1 - look), n - 1);
  const highN = Math.max(...prior.map((c) => c.high), close);
  const lowN = Math.min(...prior.map((c) => c.low), close);
  const longBreak = (close - highN) / Math.max(highN * 0.001, atr14);
  const shortBreak = (lowN - close) / Math.max(lowN * 0.001, atr14);
  const rawBreak = sideIntent === "short" ? shortBreak : longBreak;
  const breakScore = clamp(50 + rawBreak * 50, 0, 100);

  // 2 vwap
  const vwap = anchoredVwap(candles, 20) ?? close;
  const dist = (close - vwap) / atr14;
  const signedV = sideIntent === "short" ? -dist : dist;
  const vwapScore = clamp(50 + signedV * 50, 0, 100);

  // 3 rvol prior-day
  const volYesterday = candles[n - 1].volume;
  const volWindow = candles.slice(Math.max(0, n - 21), n - 1);
  const avgVol20 =
    volWindow.length > 0
      ? volWindow.reduce((a, c) => a + c.volume, 0) / volWindow.length
      : volYesterday || 1;
  const rvol = volYesterday / Math.max(avgVol20, 1);
  const rvolScore = clamp(((rvol - 0.5) / 2.0) * 100, 0, 100);

  // 4 rsi
  const rsiScore =
    sideIntent === "short" ? rsiScoreShort(rsiV) : rsiScoreLong(rsiV);

  // 5 macd ladder
  const aligned =
    (sideIntent === "long" && hist > 0 && hist >= histPrev) ||
    (sideIntent === "short" && hist < 0 && hist <= histPrev);
  const improving =
    (sideIntent === "long" && hist > histPrev) ||
    (sideIntent === "short" && hist < histPrev);
  const cross =
    (sideIntent === "long" && histPrev <= 0 && hist > 0) ||
    (sideIntent === "short" && histPrev >= 0 && hist < 0);
  let macdScore = 30;
  if (cross && improving) macdScore = 90;
  else if (aligned && improving) macdScore = 75;
  else if (aligned) macdScore = 65;
  else if (improving) macdScore = 55;

  // 6 ema stack
  const bull = e20 > e50 && e50 > e200;
  const bear = e20 < e50 && e50 < e200;
  const partialBull = e20 > e50 && e50 <= e200;
  const partialBear = e20 < e50 && e50 >= e200;
  let emaScore = 20;
  if (sideIntent === "long") {
    if (bull) emaScore = 100;
    else if (partialBull) emaScore = 70;
    else if (e20 > e50) emaScore = 55;
    else emaScore = 20;
  } else {
    if (bear) emaScore = 100;
    else if (partialBear) emaScore = 70;
    else if (e20 < e50) emaScore = 55;
    else emaScore = 20;
  }
  if (closes.length < 200) {
    emaScore = Math.min(emaScore, 70);
  }

  // 7 atr expansion
  const ratio = atr14 / Math.max(atrAvg, 1e-6);
  let atrScore: number;
  if (ratio < 0.8) atrScore = (ratio / 0.8) * 40;
  else if (ratio <= 1.6) atrScore = 40 + ((ratio - 0.8) / 0.8) * 60;
  else atrScore = Math.max(20, 100 - ((ratio - 1.6) / 1.4) * 80);

  // 8 S/R
  const sr = findSR(candles, atr14);
  const supDist =
    sr.support != null ? (close - sr.support) / atr14 : null;
  const resDist =
    sr.resistance != null ? (sr.resistance - close) / atr14 : null;
  const proximityScore = (distATR: number | null) => {
    if (distATR == null) return 40;
    return clamp(100 * (1 - Math.min(distATR, 1.5) / 1.5), 0, 100);
  };
  const roomScore = (distATR: number | null) => {
    if (distATR == null) return 40;
    return clamp((100 * Math.min(distATR, 2)) / 2, 0, 100);
  };
  const srScore =
    sideIntent === "long"
      ? 0.6 * proximityScore(supDist) + 0.4 * roomScore(resDist)
      : 0.6 * proximityScore(resDist) + 0.4 * roomScore(supDist);

  // 9 momentum
  const ref = closes[Math.max(0, n - 1 - 10)] ?? close;
  const roc10 = ((close - ref) / Math.max(ref, 1e-6)) * 100;
  const signedRoc = sideIntent === "short" ? -roc10 : roc10;
  const momScore = clamp(50 + (signedRoc / 5) * 50, 0, 100);

  // 10 regime
  const regimeTable: Record<string, { long: number; short: number }> = {
    STRONG_TREND_UP: { long: 100, short: 15 },
    TREND_UP: { long: 85, short: 25 },
    RANGE: { long: 50, short: 50 },
    TREND_DOWN: { long: 25, short: 85 },
    STRONG_TREND_DOWN: { long: 15, short: 100 },
    HIGH_VOLATILITY: { long: 35, short: 35 },
    UNKNOWN: { long: 40, short: 40 },
  };
  const rs = regimeTable[regime.label] ?? regimeTable.UNKNOWN;
  const regimeScore = sideIntent === "long" ? rs.long : rs.short;

  const factors: FactorResult[] = [
    mk("price_breakout", breakScore, `Break raw ${rawBreak.toFixed(2)} ATR vs 20D range`, rawBreak),
    mk("vwap_relation", vwapScore, `Close ${dist.toFixed(2)} ATR vs 20D anchored VWAP (not session)`, dist),
    mk("rvol", rvolScore, `Prior-day RVOL ${rvol.toFixed(2)}×`, rvol),
    mk("rsi", rsiScore, `RSI(14)=${rsiV.toFixed(1)}`, rsiV),
    mk("macd", macdScore, `Hist ${hist.toFixed(3)} (prev ${histPrev.toFixed(3)})`, hist),
    mk("ema_stack", emaScore, `EMA20/50/200 ${e20.toFixed(2)}/${e50.toFixed(2)}/${e200.toFixed(2)}`, e20),
    mk("atr_expansion", atrScore, `ATR ratio ${ratio.toFixed(2)}`, ratio),
    mk("sr_proximity", srScore, `S=${sr.support?.toFixed(2) ?? "—"} R=${sr.resistance?.toFixed(2) ?? "—"}`, sr.support ?? undefined),
    mk("momentum", momScore, `ROC10 ${roc10.toFixed(2)}%`, roc10),
    mk("regime_align", regimeScore, `Regime ${regime.label}`, regime.label),
  ];

  const confluenceScore = factors.reduce(
    (a, f) => a + f.score * f.weight,
    0
  );

  void lastAdx;
  void sma;

  return {
    symbol,
    sideBias: sideIntent,
    confluenceScore: Math.round(confluenceScore * 10) / 10,
    factors,
    price,
    changePct,
    relativeVolume: rvol,
    attribution,
  };
}

export function structuralBiasFromCandles(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const e20 = lastEma(closes, 20) ?? closes[closes.length - 1];
  const e50 = lastEma(closes, 50) ?? e20;
  const e200 =
    closes.length >= 200 ? lastEma(closes, 200) ?? e50 : e50;
  const hist = lastMacd(closes).hist ?? 0;
  return inferSideBias({ ema20: e20, ema50: e50, ema200: e200, macdHist: hist });
}
