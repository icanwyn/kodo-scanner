import { describe, expect, it } from "vitest";
import {
  compoundPath,
  cspContracts,
  getProfile,
  ivRankFromVix,
  pickPrimary,
  satContracts,
  selectStructure,
  sizeMultiplier,
} from "./engine";

describe("apex engine", () => {
  it("compound kill switch and half size gates", () => {
    expect(sizeMultiplier(0, 0, "compound").status).toBe("FULL");
    expect(sizeMultiplier(-0.07, 0, "compound").mult).toBe(0.5);
    expect(sizeMultiplier(-0.13, 0, "compound").status).toBe("KILL_SWITCH");
    expect(sizeMultiplier(0, -0.21, "compound").status).toBe("KILL_SWITCH");
  });

  it("velocity allows deeper DD before kill", () => {
    expect(sizeMultiplier(-0.13, 0, "velocity").status).toBe("HALF_SIZE");
    expect(sizeMultiplier(-0.19, 0, "velocity").status).toBe("KILL_SWITCH");
  });

  it("compound sizes sat to 1% risk", () => {
    const s = satContracts(100_000, 2, 1, "compound");
    expect(s.contracts).toBe(5); // $1000 / $200
    expect(s.reason).toBe("OK");
  });

  it("velocity sizes sat to 2.5% risk", () => {
    // $2500 / $235 per ct at 2.35 debit ≈ 10
    const s = satContracts(100_000, 2.35, 1, "velocity");
    expect(s.contracts).toBe(10);
    expect(s.riskDollars).toBeLessThanOrEqual(2500);
  });

  it("csp respects profile core budget", () => {
    const s = cspContracts(25_000, 100, 1, 0, "compound");
    expect(s.contracts).toBe(1);
    const v = cspContracts(100_000, 100, 1, 0, "velocity");
    // 35% of 100k = 35k → 3 contracts
    expect(v.contracts).toBe(3);
  });

  it("selects bull put credit in uptrend high IV high confluence", () => {
    const plans = selectStructure({
      regime: "TREND_UP",
      ivRank: 45,
      bias: "long",
      confluence: 78,
      profileId: "compound",
    });
    const primary = pickPrimary(plans, 78, "AAPL", "compound");
    expect(primary?.structure).toBe("BULL_PUT_CREDIT_SPREAD");
  });

  it("velocity boosts SAT primary", () => {
    const plans = selectStructure({
      regime: "TREND_UP",
      ivRank: 25,
      bias: "long",
      confluence: 68,
      profileId: "velocity",
    });
    const primary = pickPrimary(plans, 68, "SHOP", "velocity");
    expect(primary?.engine).toBe("SATELLITE");
    expect(primary?.structure).toBe("BULL_CALL_DEBIT_SPREAD");
  });

  it("prefers CSP on core name with modest confluence (compound)", () => {
    const plans = selectStructure({
      regime: "TREND_UP",
      ivRank: 40,
      bias: "long",
      confluence: 58,
      profileId: "compound",
    });
    const primary = pickPrimary(plans, 58, "SPY", "compound");
    expect(primary?.structure).toBe("CASH_SECURED_PUT");
  });

  it("iv proxy and compound path", () => {
    expect(ivRankFromVix(12)).toBeLessThan(20);
    expect(ivRankFromVix(35)).toBeGreaterThan(60);
    const p = compoundPath(25_000, 0.03, 1_000_000, 1000);
    expect(p.hit).toBe(true);
    expect(p.years).toBeGreaterThan(5);
    expect(p.years).toBeLessThan(15);
  });

  it("velocity planning path is faster than compound default", () => {
    const c = compoundPath(100_000, getProfile("compound").planningMonthlyRate);
    const v = compoundPath(100_000, getProfile("velocity").planningMonthlyRate);
    expect(v.years).toBeLessThan(c.years);
    expect(v.years).toBeLessThan(5);
  });
});
