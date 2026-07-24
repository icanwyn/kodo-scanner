import type {
  MarketRegime,
  ScoredSetup,
  TradeThesis,
  FactorResult,
} from "@/types";

const SCAN_KEY = "kodo:lastScan";
const SETUP_PREFIX = "kodo:setup:";
const ANALYSIS_PREFIX = "kodo:analysis:";

export type ScanFiltersState = {
  universe: "movers" | "watchlist" | "custom";
  sideBias: "any" | "long" | "short";
  minScore: number;
  custom: string;
};

export type ScanSession = {
  results: ScoredSetup[];
  regime: MarketRegime | null;
  meta: { durationMs?: number; symbolsScanned?: number } | null;
  filters: ScanFiltersState;
  ranAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function saveScanSession(session: ScanSession): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(SCAN_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function loadScanSession(): ScanSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(SCAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScanSession;
  } catch {
    return null;
  }
}

export function clearScanSession(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(SCAN_KEY);
  } catch {
    /* ignore */
  }
}

/** Cache a single setup so analysis can show factors instantly. */
export function saveSetupSnapshot(setup: ScoredSetup): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(
      SETUP_PREFIX + setup.symbol.toUpperCase(),
      JSON.stringify(setup)
    );
  } catch {
    /* ignore */
  }
}

export function loadSetupSnapshot(symbol: string): ScoredSetup | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(SETUP_PREFIX + symbol.toUpperCase());
    if (!raw) return null;
    return JSON.parse(raw) as ScoredSetup;
  } catch {
    return null;
  }
}

/** Full deep-analysis payload — reuse within the browser session (no re-token spend). */
export type AnalysisSessionCache = {
  symbol: string;
  thesis: TradeThesis | null;
  factors: FactorResult[];
  score: number;
  sideBias: string;
  price: number;
  news: { title: string; url?: string; source?: string; publishedAt?: string }[];
  model: string | null;
  regimeLabel?: string;
  error?: string;
  savedAt: string;
};

export function saveAnalysisSession(payload: AnalysisSessionCache): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(
      ANALYSIS_PREFIX + payload.symbol.toUpperCase(),
      JSON.stringify(payload)
    );
  } catch {
    /* ignore */
  }
}

export function loadAnalysisSession(
  symbol: string
): AnalysisSessionCache | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(
      ANALYSIS_PREFIX + symbol.toUpperCase()
    );
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisSessionCache;
  } catch {
    return null;
  }
}

export function clearAnalysisSession(symbol?: string): void {
  if (!canUseStorage()) return;
  try {
    if (symbol) {
      sessionStorage.removeItem(ANALYSIS_PREFIX + symbol.toUpperCase());
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(ANALYSIS_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
