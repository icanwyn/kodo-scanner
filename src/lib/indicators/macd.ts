import { ema } from "./ema";

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdPoint[] {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const macdLine: (number | null)[] = closes.map((_, i) => {
    if (fastE[i] == null || slowE[i] == null) return null;
    return (fastE[i] as number) - (slowE[i] as number);
  });

  const macdNums = macdLine.map((v) => (v == null ? 0 : v));
  // Seed signal only where macd is defined — use standard EMA on macd series from first non-null
  const first = macdLine.findIndex((v) => v != null);
  const out: MacdPoint[] = closes.map(() => ({
    macd: null,
    signal: null,
    hist: null,
  }));
  if (first < 0) return out;

  const validMacd = macdLine.slice(first) as number[];
  // rebuild contiguous for signal EMA
  const signalFull = ema(
    macdLine.map((v, i) => (v == null ? (i > 0 ? (macdLine[i - 1] ?? 0) : 0) : v)) as number[],
    signalPeriod
  );

  for (let i = 0; i < closes.length; i++) {
    const m = macdLine[i];
    const s = signalFull[i];
    out[i] = {
      macd: m,
      signal: m == null ? null : s,
      hist: m == null || s == null ? null : m - s,
    };
  }
  // silence unused
  void validMacd;
  return out;
}

export function lastMacd(closes: number[]) {
  const series = macd(closes);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].hist != null) return series[i];
  }
  return { macd: null, signal: null, hist: null };
}
