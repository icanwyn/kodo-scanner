import type { Candle } from "@/types";

/** Multi-day volume-weighted average price over last N bars (swing proxy). */
export function anchoredVwap(candles: Candle[], lookback = 20): number | null {
  if (candles.length === 0) return null;
  const slice = candles.slice(-lookback);
  let pv = 0;
  let vol = 0;
  for (const c of slice) {
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
  }
  if (vol <= 0) {
    // fallback: average of typical prices
    const t =
      slice.reduce((a, c) => a + (c.high + c.low + c.close) / 3, 0) /
      slice.length;
    return t;
  }
  return pv / vol;
}
