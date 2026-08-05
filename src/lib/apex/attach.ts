import type { MarketRegime, ScoredSetup } from "@/types";
import type { ApexRecommendation } from "@/types";
import {
  getProfile,
  ivRankFromVix,
  isCoreUniverse,
  pickPrimary,
  selectStructure,
  type ApexProfileId,
} from "./engine";

/**
 * Attach APEX structure plans to a scored equity setup using live regime.
 * Server attaches both profile lenses; client sizes with user's selected mode.
 * IV Rank is proxied from VIX when option chains are unavailable.
 */
export function buildApexRecommendation(
  setup: Pick<
    ScoredSetup,
    "symbol" | "sideBias" | "confluenceScore" | "price"
  >,
  regime: MarketRegime,
  profileId: ApexProfileId = "compound"
): ApexRecommendation {
  const profile = getProfile(profileId);
  const ivRankProxy = ivRankFromVix(regime.vixLevel);
  const plans = selectStructure({
    regime: regime.label,
    ivRank: ivRankProxy,
    bias: setup.sideBias,
    confluence: setup.confluenceScore,
    profileId,
  });

  const coreEligible = isCoreUniverse(setup.symbol, profile);
  const primary = pickPrimary(
    plans,
    setup.confluenceScore,
    setup.symbol,
    profileId
  );

  let adjustedPrimary = primary;
  if (
    primary?.engine === "CORE" &&
    !coreEligible &&
    setup.confluenceScore >= profile.minConfluenceSat
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

  // Also compute velocity primary for UI toggle without re-scan
  const velPlans = selectStructure({
    regime: regime.label,
    ivRank: ivRankProxy,
    bias: setup.sideBias,
    confluence: setup.confluenceScore,
    profileId: "velocity",
  });
  const velPrimary = pickPrimary(
    velPlans,
    setup.confluenceScore,
    setup.symbol,
    "velocity"
  );

  return {
    primary: adjustedPrimary,
    plans,
    velocityPrimary: velPrimary,
    velocityPlans: velPlans,
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
      "Toggle Compound vs Velocity on APEX desk for sizing & SAT priority",
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
