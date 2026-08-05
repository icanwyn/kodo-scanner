import type { MarketRegime, ScoredSetup } from "@/types";
import type { ApexRecommendation } from "@/types";
import {
  ivRankFromVix,
  isCoreUniverse,
  pickPrimary,
  selectStructure,
} from "./engine";

/**
 * Attach APEX structure plans to a scored equity setup using live regime.
 * IV Rank is proxied from VIX when option chains are unavailable.
 */
export function buildApexRecommendation(
  setup: Pick<
    ScoredSetup,
    "symbol" | "sideBias" | "confluenceScore" | "price"
  >,
  regime: MarketRegime
): ApexRecommendation {
  const ivRankProxy = ivRankFromVix(regime.vixLevel);
  const plans = selectStructure({
    regime: regime.label,
    ivRank: ivRankProxy,
    bias: setup.sideBias,
    confluence: setup.confluenceScore,
  });

  const coreEligible = isCoreUniverse(setup.symbol);
  const primary = pickPrimary(plans, setup.confluenceScore, setup.symbol);

  // Soft filter: non-core names shouldn't lead with CSP as primary
  let adjustedPrimary = primary;
  if (
    primary?.engine === "CORE" &&
    !coreEligible &&
    setup.confluenceScore >= 70
  ) {
    const sat = plans.find(
      (p) =>
        p.engine === "SATELLITE" &&
        p.structure !== "SKIP_OR_IRON_CONDOR_ADVANCED" &&
        (p.minConfluence == null || setup.confluenceScore >= p.minConfluence)
    );
    if (sat) adjustedPrimary = sat;
  }

  const satEligible = plans.some(
    (p) =>
      p.engine === "SATELLITE" &&
      p.sizeHint > 0 &&
      p.structure !== "SKIP_OR_IRON_CONDOR_ADVANCED" &&
      (p.minConfluence == null || setup.confluenceScore >= p.minConfluence)
  );

  return {
    primary: adjustedPrimary,
    plans,
    ivRankProxy,
    regimeLabel: regime.label,
    coreEligible,
    satEligible,
    suggestedCspStrike: Math.round(setup.price * 0.95 * 2) / 2,
    notes: [
      `IV Rank proxy from VIX ${regime.vixLevel?.toFixed(1) ?? "?"} → ${ivRankProxy}`,
      coreEligible
        ? "In APEX CORE universe (Wheel eligible)"
        : "Not in CORE universe — prefer SAT defined-risk if confluence qualifies",
      regime.vixContext === "crisis" || regime.vixContext === "elevated"
        ? "Elevated vol — favor credit structures, half size on crisis"
        : "Normal/low vol context",
    ],
  };
}

export function attachApexToResults(
  results: ScoredSetup[],
  regime: MarketRegime
): ScoredSetup[] {
  return results.map((s) => ({
    ...s,
    apex: buildApexRecommendation(s, regime),
  }));
}
