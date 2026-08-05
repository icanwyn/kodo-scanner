export type MarketRegimeLabel =
  | "STRONG_TREND_UP"
  | "TREND_UP"
  | "RANGE"
  | "TREND_DOWN"
  | "STRONG_TREND_DOWN"
  | "HIGH_VOLATILITY"
  | "UNKNOWN";

export interface DataAttribution {
  provider: string;
  delayed: boolean;
  delayMinutes?: number;
  fetchedAt: string;
}

export interface MarketRegime {
  label: MarketRegimeLabel;
  asOf: string;
  spyTrend: "up" | "down" | "flat";
  qqqTrend: "up" | "down" | "flat";
  adxSpy: number | null;
  vixLevel: number | null;
  vixContext: "low" | "normal" | "elevated" | "crisis" | "unknown";
  sectorLeaders: { symbol: string; relStrength: number }[];
  sectorLaggards: { symbol: string; relStrength: number }[];
  notes: string[];
  sourceAttribution: DataAttribution[];
}

export interface FactorResult {
  id: string;
  name: string;
  weight: number;
  score: number;
  passed: boolean;
  detail: string;
  raw?: number | string;
  value?: number | string;
}

/** APEX options plan (from src/lib/apex). */
export interface ApexPlanDto {
  engine: "CORE" | "SATELLITE";
  structure: string;
  priority: number;
  notes: string;
  sizeHint: number;
  dte?: [number, number];
  delta?: [number, number];
  minConfluence?: number;
}

export interface ApexRecommendation {
  primary: ApexPlanDto | null;
  plans: ApexPlanDto[];
  /** Aggressive profile primary (client may prefer when mode=velocity) */
  velocityPrimary?: ApexPlanDto | null;
  velocityPlans?: ApexPlanDto[];
  ivRankProxy: number;
  regimeLabel: MarketRegimeLabel;
  coreEligible: boolean;
  satEligible: boolean;
  suggestedCspStrike?: number;
  notes: string[];
}

export interface ScoredSetup {
  symbol: string;
  sideBias: "long" | "short" | "neutral";
  confluenceScore: number;
  factors: FactorResult[];
  price: number;
  changePct: number;
  relativeVolume?: number;
  marketCap?: number;
  sector?: string;
  attribution: DataAttribution[];
  /** APEX Compound options structure for this setup + regime */
  apex?: ApexRecommendation;
}

export interface ScanFilters {
  universe: "watchlist" | "movers" | "custom";
  symbols?: string[];
  minScore?: number;
  marketCapMin?: number;
  marketCapMax?: number;
  priceMin?: number;
  priceMax?: number;
  sectors?: string[];
  sideBias?: "long" | "short" | "any";
  minAvgVolume?: number;
  maxSymbols?: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume?: number;
  marketCap?: number;
  currency?: string;
  asOf: string;
  attribution: DataAttribution;
}

export interface TradeThesis {
  symbol: string;
  bias: "long" | "short" | "avoid";
  confidence: number;
  marketConditionSummary: string;
  technicalSummary: string;
  sentimentSummary: string;
  confluenceNarrative: string;
  entry: { zoneLow: number; zoneHigh: number; rationale: string };
  stop: { price: number; rationale: string };
  targets: { price: number; portion: number; rationale: string }[];
  riskReward: number;
  invalidation: string;
  risks: string[];
  checklist: string[];
  disclaimer: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
