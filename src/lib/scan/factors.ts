export interface FactorConfig {
  id: string;
  name: string;
  weight: number;
  passThreshold: number;
}

export const FACTOR_CONFIG: FactorConfig[] = [
  { id: "price_breakout", name: "Range breakout", weight: 0.12, passThreshold: 60 },
  { id: "vwap_relation", name: "Anchored VWAP (20D)", weight: 0.1, passThreshold: 60 },
  { id: "rvol", name: "Prior-day RVOL", weight: 0.12, passThreshold: 50 },
  { id: "rsi", name: "RSI(14)", weight: 0.08, passThreshold: 60 },
  { id: "macd", name: "MACD hist", weight: 0.1, passThreshold: 60 },
  { id: "ema_stack", name: "EMA stack", weight: 0.12, passThreshold: 60 },
  { id: "atr_expansion", name: "ATR expansion", weight: 0.06, passThreshold: 50 },
  { id: "sr_proximity", name: "S/R proximity", weight: 0.1, passThreshold: 60 },
  { id: "momentum", name: "Momentum ROC", weight: 0.08, passThreshold: 60 },
  { id: "regime_align", name: "Regime align", weight: 0.12, passThreshold: 60 },
];

export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export function rsiScoreLong(rsi: number): number {
  if (rsi < 30) return (rsi / 30) * 40;
  if (rsi <= 45) return 40 + ((rsi - 30) / 15) * 20;
  if (rsi <= 70) return 60 + ((rsi - 45) / 25) * 40;
  return clamp(100 - ((rsi - 70) / 30) * 100, 0, 100);
}

export function rsiScoreShort(rsi: number): number {
  if (rsi > 70) return clamp(60 + ((rsi - 70) / 20) * 40, 0, 100);
  if (rsi >= 50) return clamp(50 + ((rsi - 50) / 20) * 50, 0, 100);
  if (rsi >= 30) return clamp(((rsi - 30) / 20) * 50, 0, 50);
  return clamp((rsi / 30) * 25, 0, 25);
}
