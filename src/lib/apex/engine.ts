/**
 * APEX Compound — options strategy engine (wired into Kōdō).
 * Pure functions: sizing, structure pick, compound path, risk gates.
 */

import type { MarketRegimeLabel } from "@/types";

export const APEX = {
  name: "APEX Compound",
  version: "1.0.0",
  coreAlloc: 0.7,
  satAlloc: 0.25,
  cashAlloc: 0.05,
  riskPerTrade: 0.01,
  riskPerDay: 0.02,
  maxSatPositions: 4,
  maxWheelNames: 6,
  ddCut: -0.06,
  killMtd: -0.12,
  killPeak: -0.2,
  cspDelta: [0.2, 0.3] as [number, number],
  dteCore: [21, 45] as [number, number],
  dteSatDebit: [30, 60] as [number, number],
  profitTakePct: 0.5,
  coreUniverse: [
    "SPY",
    "QQQ",
    "IWM",
    "DIA",
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "META",
    "NVDA",
    "AMD",
    "AVGO",
    "JPM",
    "XOM",
    "COST",
    "UNH",
    "XLK",
    "XLF",
    "XLE",
  ] as readonly string[],
} as const;

export type ApexEngine = "CORE" | "SATELLITE";

export type ApexStructure =
  | "CASH_SECURED_PUT"
  | "COVERED_CALL"
  | "BULL_PUT_CREDIT_SPREAD"
  | "BULL_CALL_DEBIT_SPREAD"
  | "BEAR_CALL_CREDIT_SPREAD"
  | "BEAR_PUT_DEBIT_SPREAD"
  | "SKIP_OR_IRON_CONDOR_ADVANCED";

export interface ApexPlan {
  engine: ApexEngine;
  structure: ApexStructure;
  priority: number;
  notes: string;
  sizeHint: number;
  dte?: [number, number];
  delta?: [number, number];
  minConfluence?: number;
}

export interface SizeGate {
  mult: number;
  status: "FULL" | "HALF_SIZE" | "KILL_SWITCH";
  message: string;
}

export interface ContractSize {
  contracts: number;
  riskDollars?: number;
  perContract?: number;
  riskPct?: number;
  cashNeeded?: number;
  coreBudget?: number;
  remaining?: number;
  reason: string;
}

export function isCoreUniverse(symbol: string): boolean {
  return APEX.coreUniverse.includes(symbol.toUpperCase());
}

/** Map VIX level to a crude IV Rank proxy (0–100) when true IVR is unavailable. */
export function ivRankFromVix(vix: number | null | undefined): number {
  if (vix == null || !Number.isFinite(vix)) return 30;
  if (vix < 13) return 12;
  if (vix < 15) return 18;
  if (vix < 18) return 28;
  if (vix < 22) return 40;
  if (vix < 26) return 52;
  if (vix < 30) return 62;
  if (vix < 40) return 75;
  return 88;
}

export function sizeMultiplier(
  mtdReturn: number,
  peakDrawdown: number
): SizeGate {
  if (mtdReturn <= APEX.killMtd || peakDrawdown <= APEX.killPeak) {
    return {
      mult: 0,
      status: "KILL_SWITCH",
      message: "Flat — no new risk. Review journal 20 trading days.",
    };
  }
  if (mtdReturn <= APEX.ddCut || peakDrawdown <= APEX.ddCut) {
    return {
      mult: 0.5,
      status: "HALF_SIZE",
      message: "Drawdown gate: trade half size until recovered.",
    };
  }
  return {
    mult: 1,
    status: "FULL",
    message: "Full size allowed within rules.",
  };
}

export function satContracts(
  equity: number,
  maxLossPerShare: number,
  mult = 1
): ContractSize {
  if (maxLossPerShare <= 0 || equity <= 0) {
    return { contracts: 0, riskDollars: 0, reason: "Invalid inputs" };
  }
  const riskDollars = equity * APEX.riskPerTrade * mult;
  const perContract = maxLossPerShare * 100;
  const contracts = Math.floor(riskDollars / perContract);
  if (contracts < 1) {
    return {
      contracts: 0,
      riskDollars,
      perContract,
      reason: `Need ≥ $${perContract.toFixed(0)} risk budget for 1 contract; have $${riskDollars.toFixed(0)}. Use a tighter spread or more equity.`,
    };
  }
  return {
    contracts,
    riskDollars: contracts * perContract,
    perContract,
    riskPct: (contracts * perContract) / equity,
    reason: "OK",
  };
}

export function cspContracts(
  equity: number,
  strike: number,
  mult = 1,
  cashAlreadyUsed = 0
): ContractSize {
  const coreBudget = equity * APEX.coreAlloc * mult;
  const remaining = Math.max(0, coreBudget - cashAlreadyUsed);
  const per = strike * 100;
  if (per <= 0) return { contracts: 0, cashNeeded: 0, reason: "Bad strike" };
  const contracts = Math.floor(remaining / per);
  if (contracts < 1) {
    return {
      contracts: 0,
      cashNeeded: per,
      coreBudget,
      remaining,
      reason: `Not enough CORE cash for 1 CSP at $${strike}. Remaining CORE budget $${remaining.toFixed(0)}.`,
    };
  }
  return {
    contracts,
    cashNeeded: contracts * per,
    coreBudget,
    remaining,
    reason: "OK",
  };
}

export function selectStructure(input: {
  regime: MarketRegimeLabel | string;
  ivRank: number;
  bias: "long" | "short" | "neutral";
  confluence?: number;
}): ApexPlan[] {
  const { regime, ivRank, bias, confluence = 0 } = input;
  const plans: ApexPlan[] = [];

  const up = regime === "STRONG_TREND_UP" || regime === "TREND_UP";
  const down = regime === "TREND_DOWN" || regime === "STRONG_TREND_DOWN";
  const range = regime === "RANGE";
  const crisis = regime === "HIGH_VOLATILITY";
  const highIv = ivRank >= 30;
  const lowIv = ivRank < 20;

  if (!crisis) {
    plans.push({
      engine: "CORE",
      structure: "CASH_SECURED_PUT",
      priority: highIv ? 1 : lowIv ? 3 : 2,
      dte: APEX.dteCore,
      delta: APEX.cspDelta,
      notes: highIv
        ? "IV rich — Wheel premium favorable. Sell CSP 21–45 DTE, Δ 0.20–0.30. Close at 50%."
        : lowIv
          ? "IV poor — half size CSPs or skip; don’t sell nickels."
          : "Normal IV — standard CSP sizing. Prefer support strikes.",
      sizeHint: lowIv || range ? 0.5 : 1,
    });
    plans.push({
      engine: "CORE",
      structure: "COVERED_CALL",
      priority: 2,
      dte: APEX.dteCore,
      delta: APEX.cspDelta,
      notes:
        "Only if you hold shares (or post-assignment). Sell OTM call, close 50%.",
      sizeHint: 1,
    });
  } else {
    plans.push({
      engine: "CORE",
      structure: "CASH_SECURED_PUT",
      priority: 2,
      dte: [30, 45],
      delta: [0.15, 0.25],
      notes:
        "Crisis vol — half size, lower delta, only highest-quality names you want to own.",
      sizeHint: 0.5,
    });
  }

  if (up && bias !== "short") {
    if (highIv) {
      plans.push({
        engine: "SATELLITE",
        structure: "BULL_PUT_CREDIT_SPREAD",
        priority: confluence >= 70 ? 1 : 2,
        dte: APEX.dteCore,
        delta: APEX.cspDelta,
        notes:
          "Uptrend + high IV: sell bull put spread, max loss ≤ 1% equity. Close 50% credit.",
        sizeHint: 1,
        minConfluence: 60,
      });
    } else {
      plans.push({
        engine: "SATELLITE",
        structure: "BULL_CALL_DEBIT_SPREAD",
        priority: confluence >= 70 ? 1 : 3,
        dte: APEX.dteSatDebit,
        notes:
          "Uptrend + low/normal IV: debit call spread 30–60 DTE. Risk full debit ≤ 1%. Target 2R.",
        sizeHint: confluence >= 70 ? 1 : 0.5,
        minConfluence: 70,
      });
    }
  }

  if (down && bias !== "long") {
    if (highIv) {
      plans.push({
        engine: "SATELLITE",
        structure: "BEAR_CALL_CREDIT_SPREAD",
        priority: 2,
        dte: APEX.dteCore,
        notes:
          "Downtrend + high IV: bear call credit spread, defined risk, half size recommended.",
        sizeHint: 0.5,
      });
    } else {
      plans.push({
        engine: "SATELLITE",
        structure: "BEAR_PUT_DEBIT_SPREAD",
        priority: 3,
        dte: APEX.dteSatDebit,
        notes:
          "Downtrend + low IV: put debit spread only with strong thesis. Easy to get chopped.",
        sizeHint: 0.5,
      });
    }
  }

  if (range) {
    plans.push({
      engine: "SATELLITE",
      structure: "SKIP_OR_IRON_CONDOR_ADVANCED",
      priority: 4,
      notes:
        "Range: prefer CORE only. Iron condors only if experienced and IVR ≥ 40.",
      sizeHint: 0,
    });
  }

  plans.sort((a, b) => a.priority - b.priority);
  return plans;
}

/** Prefer SAT when confluence is high and sat plan is P1; else best actionable plan. */
export function pickPrimary(
  plans: ApexPlan[],
  confluence: number,
  symbol: string
): ApexPlan | null {
  const actionable = plans.filter(
    (p) =>
      p.structure !== "SKIP_OR_IRON_CONDOR_ADVANCED" &&
      p.sizeHint > 0 &&
      (p.minConfluence == null || confluence >= p.minConfluence)
  );
  if (!actionable.length) return plans[0] ?? null;

  const coreOk = isCoreUniverse(symbol);
  const sat = actionable.filter((p) => p.engine === "SATELLITE");
  const core = actionable.filter((p) => p.engine === "CORE");

  if (confluence >= 70 && sat[0]?.priority === 1) return sat[0];
  if (coreOk && core[0]) {
    // Prefer CSP over CC as default primary
    const csp = core.find((p) => p.structure === "CASH_SECURED_PUT");
    if (csp && confluence < 70) return csp;
    if (sat[0] && confluence >= 70) return sat[0];
    return csp ?? core[0];
  }
  return sat[0] ?? (coreOk ? core[0] : null) ?? actionable[0];
}

export function buildTicket(input: {
  equity: number;
  symbol: string;
  price: number;
  strike?: number;
  structure: ApexStructure;
  maxLossPerShare?: number;
  creditOrDebit?: number;
  mtdReturn?: number;
  peakDrawdown?: number;
  cashUsedCore?: number;
}) {
  const {
    equity,
    symbol,
    price,
    strike,
    structure,
    maxLossPerShare,
    creditOrDebit,
    mtdReturn = 0,
    peakDrawdown = 0,
    cashUsedCore = 0,
  } = input;

  const gate = sizeMultiplier(mtdReturn, peakDrawdown);
  const sym = symbol.toUpperCase();
  const isCore =
    structure === "CASH_SECURED_PUT" || structure === "COVERED_CALL";

  let size: ContractSize | { contracts: string; reason: string };
  if (structure === "CASH_SECURED_PUT") {
    size = cspContracts(equity, strike ?? price * 0.95, gate.mult, cashUsedCore);
  } else if (structure === "COVERED_CALL") {
    size = {
      contracts: "matches shares / 100",
      reason:
        "Sell 1 call per 100 shares held. Delta 0.20–0.30, 21–45 DTE, close 50%.",
    };
  } else {
    const loss =
      maxLossPerShare != null
        ? maxLossPerShare
        : creditOrDebit != null
          ? creditOrDebit
          : 0;
    size = satContracts(equity, loss, gate.mult);
  }

  return {
    symbol: sym,
    structure,
    gate,
    size,
    rules: {
      profitTake: "Close short premium at 50% of max profit",
      dte: isCore ? "21–45 DTE" : "Debit 30–60 DTE / Credit 21–45 DTE",
      riskCap: "≤ 1% equity risk on SAT; CORE cash ≤ 70% equity",
      banned: ["0DTE", "naked short calls", "undefined risk", "revenge size-up"],
    },
    checklist: isCore
      ? [
          "Willing to own shares at strike",
          "Cash reserved for assignment",
          "Delta 0.20–0.30",
          "50% profit GTC planned",
          "≤ 6 wheel names total",
        ]
      : [
          "Regime allows this direction",
          "Max loss ≤ 1% equity",
          "Defined risk wings on",
          "Exit rules written first",
          "Not trading emotions",
        ],
  };
}

export function compoundPath(
  start: number,
  monthlyRate: number,
  target = 1_000_000,
  monthlyAdd = 0
) {
  if (start <= 0) {
    return {
      months: Infinity,
      years: Infinity,
      path: [] as { month: number; equity: number }[],
      hit: false,
      finalEquity: 0,
      error: "Start capital must be > 0",
    };
  }
  if (start >= target) {
    return {
      months: 0,
      years: 0,
      path: [{ month: 0, equity: start }],
      hit: true,
      finalEquity: start,
    };
  }

  const path: { month: number; equity: number }[] = [
    { month: 0, equity: start },
  ];
  let equity = start;
  const maxMonths = 600;
  let m = 0;

  while (equity < target && m < maxMonths) {
    m += 1;
    equity = equity * (1 + monthlyRate) + monthlyAdd;
    if (m % 3 === 0 || equity >= target || m <= 12) {
      path.push({ month: m, equity: Math.round(equity * 100) / 100 });
    }
  }

  return {
    months: m,
    years: Math.round((m / 12) * 10) / 10,
    finalEquity: Math.round(equity * 100) / 100,
    hit: equity >= target,
    path,
    monthlyRate,
    start,
    target,
    monthlyAdd,
  };
}

export function structureLabel(s: ApexStructure | string): string {
  return s.replaceAll("_", " ");
}
