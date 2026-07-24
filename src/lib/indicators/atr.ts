import type { Candle } from "@/types";

export function trueRange(candles: Candle[]): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      tr.push(c.high - c.low);
      continue;
    }
    const prev = candles[i - 1].close;
    tr.push(
      Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev))
    );
  }
  return tr;
}

/** Wilder ATR */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  const tr = trueRange(candles);
  const out: (number | null)[] = Array(candles.length).fill(null);
  if (tr.length < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  let prev = sum / period;
  out[period - 1] = prev;

  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function lastAtr(candles: Candle[], period = 14): number | null {
  const series = atr(candles, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i] as number;
  }
  return null;
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
