/**
 * APEX — dual profile options engine for Kōdō.
 * compound = survivable path · velocity = aggressive timeline (higher ruin risk)
 */

import type { MarketRegimeLabel } from "@/types";

export type ApexProfileId = "compound" | "velocity";

export type ApexEngine = "CORE" | "SATELLITE";

export type ApexStructure =
  | "CASH_SECURED_PUT"
  | "COVERED_CALL"
  | "BULL_PUT_CREDIT_SPREAD"
  | "BULL_CALL_DEBIT_SPREAD"
  | "BEAR_CALL_CREDIT_SPREAD"
  | "BEAR_PUT_DEBIT_SPREAD"
  | "SKIP_OR_IRON_CONDOR_ADVANCED";

export interface ApexProfile {
  id: ApexProfileId;
  name: string;
  version: string;
  tagline: string;
  coreAlloc: number;
  satAlloc: number;
  cashAlloc: number;
  riskPerTrade: number;
  riskPerDay: number;
  maxSatPositions: number;
  maxWheelNames: number;
  /** New full-size SAT entries per day */
  maxNewSatPerDay: number;
  /** Target new SAT entries per week (guidance) */
  targetSatPerWeek: [number, number];
  ddCut: number;
  killMtd: number;
  killPeak: number;
  cspDelta: [number, number];
  dteCore: [number, number];
  dteSatDebit: [number, number];
  dteSatCredit: [number, number];
  profitTakePct: number;
  /** Planning assumption for $1M path (not a promise) */
  planningMonthlyRate: number;
  minConfluenceSat: number;
  satPriorityBoost: boolean;
  coreUniverse: readonly string[];
  banned: readonly string[];
}

const CORE_UNIVERSE = [
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
  "SHOP",
  "TSLA",
  "CRM",
  "NFLX",
] as const;

/** Original APEX — keep for play / base path */
export const PROFILE_COMPOUND: ApexProfile = {
  id: "compound",
  name: "APEX Compound",
  version: "1.1.0",
  tagline: "Survivable dual-engine. ~8–12y path from $100k at ~2%/mo.",
  coreAlloc: 0.7,
  satAlloc: 0.25,
  cashAlloc: 0.05,
  riskPerTrade: 0.01,
  riskPerDay: 0.02,
  maxSatPositions: 4,
  maxWheelNames: 6,
  maxNewSatPerDay: 2,
  targetSatPerWeek: [2, 4],
  ddCut: -0.06,
  killMtd: -0.12,
  killPeak: -0.2,
  cspDelta: [0.2, 0.3],
  dteCore: [21, 45],
  dteSatDebit: [30, 60],
  dteSatCredit: [21, 45],
  profitTakePct: 0.5,
  planningMonthlyRate: 0.025,
  minConfluenceSat: 70,
  satPriorityBoost: false,
  coreUniverse: CORE_UNIVERSE,
  banned: ["0DTE", "naked short calls", "undefined risk", "revenge size-up"],
};

/**
 * Aggressive timeline profile.
 * Higher SAT share, 2.5% risk/trade, shorter DTE, more frequency.
 * Still defined-risk only — not 0DTE lotto. Ruin risk is real.
 */
export const PROFILE_VELOCITY: ApexProfile = {
  id: "velocity",
  name: "APEX Velocity",
  version: "1.1.0",
  tagline:
    "Aggressive path. ~3–5y from $100k if you hit ~5–6%/mo net — high drawdown risk.",
  coreAlloc: 0.35,
  satAlloc: 0.6,
  cashAlloc: 0.05,
  riskPerTrade: 0.025,
  riskPerDay: 0.06,
  maxSatPositions: 6,
  maxWheelNames: 4,
  maxNewSatPerDay: 3,
  targetSatPerWeek: [5, 10],
  ddCut: -0.1,
  killMtd: -0.18,
  killPeak: -0.3,
  cspDelta: [0.25, 0.35],
  dteCore: [14, 35],
  dteSatDebit: [21, 45],
  dteSatCredit: [14, 35],
  profitTakePct: 0.4,
  planningMonthlyRate: 0.055,
  minConfluenceSat: 62,
  satPriorityBoost: true,
  coreUniverse: CORE_UNIVERSE,
  banned: [
    "0DTE",
    "naked short calls",
    "undefined risk",
    "revenge size-up",
    "averaging losers",
  ],
};

export const PROFILES: Record<ApexProfileId, ApexProfile> = {
  compound: PROFILE_COMPOUND,
  velocity: PROFILE_VELOCITY,
};

/** @deprecated use getProfile("compound") — kept for older imports */
export const APEX = {
  ...PROFILE_COMPOUND,
  name: PROFILE_COMPOUND.name,
  version: PROFILE_COMPOUND.version,
} as const;

export function getProfile(id?: ApexProfileId | string | null): ApexProfile {
  if (id === "velocity") return PROFILE_VELOCITY;
  return PROFILE_COMPOUND;
}

export interface ApexPlan {
  engine: ApexEngine;
  structure: ApexStructure;
  priority: number;
  notes: string;
  sizeHint: number;
  dte?: [number, number];
  delta?: [number, number];
  minConfluence?: number;
  profileId?: ApexProfileId;
}

export interface SizeGate {
  mult: number;
  status: "FULL" | "HALF_SIZE" | "KILL_SWITCH";
  message: string;
  profileId: ApexProfileId;
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

export function isCoreUniverse(
  symbol: string,
  profile: ApexProfile = PROFILE_COMPOUND
): boolean {
  return profile.coreUniverse.includes(symbol.toUpperCase() as never);
}

/** Map VIX level to a crude IV Rank proxy (0–100). */
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
  peakDrawdown: number,
  profileId: ApexProfileId = "compound"
): SizeGate {
  const p = getProfile(profileId);
  if (mtdReturn <= p.killMtd || peakDrawdown <= p.killPeak) {
    return {
      mult: 0,
      status: "KILL_SWITCH",
      profileId: p.id,
      message: `${p.name}: FLAT — kill switch. No new risk. Journal 15–20 sessions.`,
    };
  }
  if (mtdReturn <= p.ddCut || peakDrawdown <= p.ddCut) {
    return {
      mult: 0.5,
      status: "HALF_SIZE",
      profileId: p.id,
      message: `${p.name}: half size until DD recovers past cut.`,
    };
  }
  return {
    mult: 1,
    status: "FULL",
    profileId: p.id,
    message: `${p.name}: full size within profile rules.`,
  };
}

export function satContracts(
  equity: number,
  maxLossPerShare: number,
  mult = 1,
  profileId: ApexProfileId = "compound"
): ContractSize {
  const p = getProfile(profileId);
  if (maxLossPerShare <= 0 || equity <= 0) {
    return { contracts: 0, riskDollars: 0, reason: "Invalid inputs" };
  }
  const riskDollars = equity * p.riskPerTrade * mult;
  const perContract = maxLossPerShare * 100;
  const contracts = Math.floor(riskDollars / perContract);
  if (contracts < 1) {
    return {
      contracts: 0,
      riskDollars,
      perContract,
      reason: `Need ≥ $${perContract.toFixed(0)} for 1 ct; budget $${riskDollars.toFixed(0)} (${(p.riskPerTrade * 100).toFixed(1)}% risk).`,
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
  cashAlreadyUsed = 0,
  profileId: ApexProfileId = "compound"
): ContractSize {
  const p = getProfile(profileId);
  const coreBudget = equity * p.coreAlloc * mult;
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
      reason: `CORE budget $${remaining.toFixed(0)} < 1 CSP at $${strike}.`,
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
  profileId?: ApexProfileId;
}): ApexPlan[] {
  const {
    regime,
    ivRank,
    bias,
    confluence = 0,
    profileId = "compound",
  } = input;
  const p = getProfile(profileId);
  const plans: ApexPlan[] = [];
  const vel = p.id === "velocity";

  const up = regime === "STRONG_TREND_UP" || regime === "TREND_UP";
  const down = regime === "TREND_DOWN" || regime === "STRONG_TREND_DOWN";
  const range = regime === "RANGE";
  const crisis = regime === "HIGH_VOLATILITY";
  const highIv = ivRank >= 30;
  const lowIv = ivRank < 20;
  const riskLabel = `${(p.riskPerTrade * 100).toFixed(1)}%`;

  if (!crisis) {
    plans.push({
      engine: "CORE",
      structure: "CASH_SECURED_PUT",
      priority: vel ? (highIv ? 2 : 3) : highIv ? 1 : lowIv ? 3 : 2,
      dte: p.dteCore,
      delta: p.cspDelta,
      profileId: p.id,
      notes: vel
        ? highIv
          ? `Velocity CORE: CSP ${p.dteCore[0]}–${p.dteCore[1]} DTE, Δ ${p.cspDelta[0]}–${p.cspDelta[1]}. Smaller CORE sleeve (${(p.coreAlloc * 100).toFixed(0)}%). Close ${p.profitTakePct * 100}%.`
          : `Velocity: IV soft — skip CSP or tiny size; push risk into SAT debits/credits.`
        : highIv
          ? "IV rich — Wheel premium favorable. Sell CSP 21–45 DTE, Δ 0.20–0.30. Close at 50%."
          : lowIv
            ? "IV poor — half size CSPs or skip; don’t sell nickels."
            : "Normal IV — standard CSP sizing. Prefer support strikes.",
      sizeHint: lowIv || range ? 0.5 : vel ? 0.75 : 1,
    });
    plans.push({
      engine: "CORE",
      structure: "COVERED_CALL",
      priority: vel ? 3 : 2,
      dte: p.dteCore,
      delta: p.cspDelta,
      profileId: p.id,
      notes: "Only if you hold shares (or post-assignment). Sell OTM call.",
      sizeHint: 1,
    });
  } else {
    plans.push({
      engine: "CORE",
      structure: "CASH_SECURED_PUT",
      priority: 2,
      dte: [Math.max(21, p.dteCore[0]), p.dteCore[1]],
      delta: [0.15, 0.25],
      profileId: p.id,
      notes: "Crisis vol — half size, only names you’d own. Velocity: cut frequency.",
      sizeHint: 0.5,
    });
  }

  if (up && bias !== "short") {
    if (highIv) {
      plans.push({
        engine: "SATELLITE",
        structure: "BULL_PUT_CREDIT_SPREAD",
        priority: confluence >= p.minConfluenceSat ? 1 : 2,
        dte: p.dteSatCredit,
        delta: p.cspDelta,
        profileId: p.id,
        notes: vel
          ? `VELOCITY: bull put credit ${p.dteSatCredit[0]}–${p.dteSatCredit[1]} DTE. Max loss ≤ ${riskLabel} equity. Close @ ${p.profitTakePct * 100}% credit. Stack only uncorrelated names.`
          : `Uptrend + high IV: bull put spread, max loss ≤ ${riskLabel}. Close 50% credit.`,
        sizeHint: 1,
        minConfluence: vel ? 55 : 60,
      });
    } else {
      plans.push({
        engine: "SATELLITE",
        structure: "BULL_CALL_DEBIT_SPREAD",
        priority: confluence >= p.minConfluenceSat ? 1 : vel ? 2 : 3,
        dte: p.dteSatDebit,
        profileId: p.id,
        notes: vel
          ? `VELOCITY: bull call debit ${p.dteSatDebit[0]}–${p.dteSatDebit[1]} DTE. Risk full debit ≤ ${riskLabel}. Prefer debit ≤ 45% of width for better R:R. Scale out into strength.`
          : `Uptrend + low/normal IV: debit call spread. Risk ≤ ${riskLabel}. Target ~2R on mark when possible.`,
        sizeHint: confluence >= p.minConfluenceSat ? 1 : 0.5,
        minConfluence: p.minConfluenceSat,
      });
    }
  }

  if (down && bias !== "long") {
    if (highIv) {
      plans.push({
        engine: "SATELLITE",
        structure: "BEAR_CALL_CREDIT_SPREAD",
        priority: vel ? 1 : 2,
        dte: p.dteSatCredit,
        profileId: p.id,
        notes: `Bear call credit, defined risk ≤ ${riskLabel}. Velocity sizes full in clean downtrends only.`,
        sizeHint: vel ? 1 : 0.5,
        minConfluence: vel ? 58 : 65,
      });
    } else {
      plans.push({
        engine: "SATELLITE",
        structure: "BEAR_PUT_DEBIT_SPREAD",
        priority: 2,
        dte: p.dteSatDebit,
        profileId: p.id,
        notes: `Put debit spread. Risk ≤ ${riskLabel}. Easy to get chopped — Velocity still requires structure break invalidation.`,
        sizeHint: vel ? 0.75 : 0.5,
        minConfluence: p.minConfluenceSat,
      });
    }
  }

  if (range) {
    plans.push({
      engine: "SATELLITE",
      structure: "SKIP_OR_IRON_CONDOR_ADVANCED",
      priority: 4,
      profileId: p.id,
      notes: vel
        ? "Velocity in range: cut size 50% or sit. No force-feeding SAT. Optional IC only if IVR ≥ 45 and you know the play."
        : "Range: prefer CORE only. Iron condors only if experienced and IVR ≥ 40.",
      sizeHint: 0,
    });
  }

  plans.sort((a, b) => a.priority - b.priority);
  return plans;
}

export function pickPrimary(
  plans: ApexPlan[],
  confluence: number,
  symbol: string,
  profileId: ApexProfileId = "compound"
): ApexPlan | null {
  const p = getProfile(profileId);
  const actionable = plans.filter(
    (pl) =>
      pl.structure !== "SKIP_OR_IRON_CONDOR_ADVANCED" &&
      pl.sizeHint > 0 &&
      (pl.minConfluence == null || confluence >= pl.minConfluence)
  );
  if (!actionable.length) return plans[0] ?? null;

  const coreOk = isCoreUniverse(symbol, p);
  const sat = actionable.filter((pl) => pl.engine === "SATELLITE");
  const core = actionable.filter((pl) => pl.engine === "CORE");

  // Velocity: lean SAT hard when confluence clears bar
  if (p.satPriorityBoost && sat[0] && confluence >= p.minConfluenceSat) {
    return sat[0];
  }

  if (confluence >= p.minConfluenceSat && sat[0]?.priority === 1) return sat[0];
  if (coreOk && core[0]) {
    const csp = core.find((pl) => pl.structure === "CASH_SECURED_PUT");
    if (csp && confluence < p.minConfluenceSat) return csp;
    if (sat[0] && confluence >= p.minConfluenceSat) return sat[0];
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
  profileId?: ApexProfileId;
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
    profileId = "compound",
  } = input;

  const p = getProfile(profileId);
  const gate = sizeMultiplier(mtdReturn, peakDrawdown, profileId);
  const sym = symbol.toUpperCase();
  const isCore =
    structure === "CASH_SECURED_PUT" || structure === "COVERED_CALL";

  let size: ContractSize | { contracts: string; reason: string };
  if (structure === "CASH_SECURED_PUT") {
    size = cspContracts(
      equity,
      strike ?? price * 0.95,
      gate.mult,
      cashUsedCore,
      profileId
    );
  } else if (structure === "COVERED_CALL") {
    size = {
      contracts: "matches shares / 100",
      reason: `Sell 1 call / 100 shares. Δ ${p.cspDelta[0]}–${p.cspDelta[1]}, ${p.dteCore[0]}–${p.dteCore[1]} DTE.`,
    };
  } else {
    const loss =
      maxLossPerShare != null
        ? maxLossPerShare
        : creditOrDebit != null
          ? creditOrDebit
          : 0;
    size = satContracts(equity, loss, gate.mult, profileId);
  }

  return {
    symbol: sym,
    structure,
    profileId: p.id,
    profileName: p.name,
    gate,
    size,
    rules: {
      profitTake: `Close short premium at ${p.profitTakePct * 100}% of max profit`,
      dte: isCore
        ? `${p.dteCore[0]}–${p.dteCore[1]} DTE`
        : `Debit ${p.dteSatDebit[0]}–${p.dteSatDebit[1]} / Credit ${p.dteSatCredit[0]}–${p.dteSatCredit[1]} DTE`,
      riskCap: `≤ ${p.riskPerTrade * 100}% equity / SAT · day cap ${p.riskPerDay * 100}% · CORE cash ≤ ${p.coreAlloc * 100}% · max ${p.maxSatPositions} SAT open · ≤${p.maxNewSatPerDay} new SAT/day`,
      banned: [...p.banned],
      frequency: `${p.targetSatPerWeek[0]}–${p.targetSatPerWeek[1]} new SAT / week (guidance)`,
    },
    checklist: isCore
      ? [
          "Willing to own shares at strike",
          "Cash reserved for assignment",
          `Delta ~${p.cspDelta[0]}–${p.cspDelta[1]}`,
          `${p.profitTakePct * 100}% profit plan`,
          `≤ ${p.maxWheelNames} wheel names`,
        ]
      : [
          "Regime allows this direction",
          `Max loss ≤ ${p.riskPerTrade * 100}% equity`,
          "Defined risk wings on",
          "Exit rules written first",
          p.id === "velocity"
            ? "Uncorrelated to other open SAT books"
            : "Not trading emotions",
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

/** Side-by-side path table for UI */
export function pathScenarios(
  start: number,
  monthlyAdd = 0,
  rates: number[] = [0.02, 0.03, 0.04, 0.05, 0.06, 0.08]
) {
  return rates.map((r) => {
    const p = compoundPath(start, r, 1_000_000, monthlyAdd);
    return {
      monthlyPct: r * 100,
      years: p.years,
      months: p.months,
      hit: p.hit,
    };
  });
}

export function structureLabel(s: ApexStructure | string): string {
  return s.replaceAll("_", " ");
}

export function profileLabel(id: ApexProfileId): string {
  return id === "velocity" ? "Velocity" : "Compound";
}
