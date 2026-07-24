export type Side = "LONG" | "SHORT";

export function sideSign(side: Side): 1 | -1 {
  return side === "LONG" ? 1 : -1;
}

export function realizedPnl(args: {
  side: Side;
  entry: number;
  exit: number;
  quantity: number;
  fees?: number;
}): number {
  const { side, entry, exit, quantity, fees = 0 } = args;
  return (exit - entry) * quantity * sideSign(side) - fees;
}

export function riskPerShare(
  entry: number,
  stopAtEntry: number | null | undefined
): number | null {
  if (stopAtEntry == null) return null;
  const r = Math.abs(entry - stopAtEntry);
  return r > 0 ? r : null;
}

export function rMultiple(args: {
  side: Side;
  entry: number;
  exit: number;
  quantity: number;
  stopAtEntry: number | null | undefined;
  fees?: number;
}): number | null {
  const risk = riskPerShare(args.entry, args.stopAtEntry);
  if (risk == null) return null;
  const pnl = realizedPnl(args);
  const denom = risk * args.quantity;
  return denom > 0 ? pnl / denom : null;
}

export function unrealizedPnl(args: {
  side: Side;
  entry: number;
  mark: number;
  quantity: number;
}): number {
  return (args.mark - args.entry) * args.quantity * sideSign(args.side);
}

export function profitFactor(closedPnls: number[]): number | null {
  const wins = closedPnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const losses = closedPnls.filter((p) => p < 0).reduce((a, b) => a + b, 0);
  if (losses === 0) return null;
  return wins / Math.abs(losses);
}

export function winRate(closedPnls: number[]): number | null {
  if (closedPnls.length === 0) return null;
  return closedPnls.filter((p) => p > 0).length / closedPnls.length;
}

export function expectancy(closedPnls: number[]): number | null {
  if (closedPnls.length === 0) return null;
  return closedPnls.reduce((a, b) => a + b, 0) / closedPnls.length;
}
