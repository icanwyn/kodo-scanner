export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period || period <= 0) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function lastEma(values: number[], period: number): number | null {
  const series = ema(values, period);
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i] as number;
  }
  return null;
}
