import type { Candle } from "@/types";

export interface SRLevels {
  support: number | null;
  resistance: number | null;
  pivots: number[];
}

function cluster(levels: number[], atr: number): number[] {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const out: number[] = [];
  let bucket: number[] = [sorted[0]];
  const thr = 0.25 * atr;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - bucket[bucket.length - 1] <= thr) {
      bucket.push(sorted[i]);
    } else {
      out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length);
      bucket = [sorted[i]];
    }
  }
  out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length);
  return out;
}

export function findSR(candles: Candle[], atr14: number): SRLevels {
  const window = candles.slice(-60);
  const highs: number[] = [];
  const lows: number[] = [];
  const N = 2;
  for (let i = N; i < window.length - N; i++) {
    const h = window[i].high;
    const l = window[i].low;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= N; k++) {
      if (window[i - k].high >= h || window[i + k].high >= h) isHigh = false;
      if (window[i - k].low <= l || window[i + k].low <= l) isLow = false;
    }
    if (isHigh) highs.push(h);
    if (isLow) lows.push(l);
  }
  const pivots = cluster([...highs, ...lows], Math.max(atr14, 1e-6));
  const close = window[window.length - 1]?.close ?? 0;
  const below = pivots.filter((p) => p < close);
  const above = pivots.filter((p) => p > close);
  return {
    support: below.length ? Math.max(...below) : null,
    resistance: above.length ? Math.min(...above) : null,
    pivots,
  };
}
