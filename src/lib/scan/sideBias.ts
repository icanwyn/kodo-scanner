export function inferSideBias(input: {
  ema20: number;
  ema50: number;
  ema200: number;
  macdHist: number;
}): "long" | "short" | "neutral" {
  const bullStack = input.ema20 > input.ema50 && input.ema50 > input.ema200;
  const bearStack = input.ema20 < input.ema50 && input.ema50 < input.ema200;
  const macdBull = input.macdHist >= 0;
  const macdBear = input.macdHist < 0;

  if (bullStack && macdBull) return "long";
  if (bearStack && macdBear) return "short";
  if (bullStack || (input.ema20 > input.ema50 && macdBull)) return "long";
  if (bearStack || (input.ema20 < input.ema50 && macdBear)) return "short";
  return "neutral";
}
