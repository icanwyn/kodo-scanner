import type { Candle } from "@/types";

/** Wilder ADX(period) */
export function adx(candles: Candle[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = Array(n).fill(null);
  if (n < period * 2) return out;

  const plusDM: number[] = Array(n).fill(0);
  const minusDM: number[] = Array(n).fill(0);
  const tr: number[] = Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
    const c = candles[i];
    const prev = candles[i - 1].close;
    tr[i] = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev),
      Math.abs(c.low - prev)
    );
  }

  // Wilder smooth
  let atr = 0;
  let pDM = 0;
  let mDM = 0;
  for (let i = 1; i <= period; i++) {
    atr += tr[i];
    pDM += plusDM[i];
    mDM += minusDM[i];
  }

  const dx: number[] = Array(n).fill(0);
  let plusDI = atr === 0 ? 0 : (100 * pDM) / atr;
  let minusDI = atr === 0 ? 0 : (100 * mDM) / atr;
  dx[period] =
    plusDI + minusDI === 0
      ? 0
      : (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);

  for (let i = period + 1; i < n; i++) {
    atr = atr - atr / period + tr[i];
    pDM = pDM - pDM / period + plusDM[i];
    mDM = mDM - mDM / period + minusDM[i];
    plusDI = atr === 0 ? 0 : (100 * pDM) / atr;
    minusDI = atr === 0 ? 0 : (100 * mDM) / atr;
    dx[i] =
      plusDI + minusDI === 0
        ? 0
        : (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
  }

  // ADX = Wilder smooth of DX
  let adxVal = 0;
  let count = 0;
  for (let i = period; i < period * 2 && i < n; i++) {
    adxVal += dx[i];
    count += 1;
  }
  if (count === 0) return out;
  adxVal /= count;
  const start = period * 2 - 1;
  if (start < n) out[start] = adxVal;

  for (let i = start + 1; i < n; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]) / period;
    out[i] = adxVal;
  }
  return out;
}

export function lastAdx(candles: Candle[], period = 14): number | null {
  const series = adx(candles, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i] as number;
  }
  return null;
}
