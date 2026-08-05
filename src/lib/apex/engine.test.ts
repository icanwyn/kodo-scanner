import { describe, expect, it } from "vitest";
import {
  compoundPath,
  cspContracts,
  ivRankFromVix,
  pickPrimary,
  satContracts,
  selectStructure,
  sizeMultiplier,
} from "./engine";

describe("apex engine", () => {
  it("kill switch and half size gates", () => {
    expect(sizeMultiplier(0, 0).status).toBe("FULL");
    expect(sizeMultiplier(-0.07, 0).mult).toBe(0.5);
    expect(sizeMultiplier(-0.13, 0).status).toBe("KILL_SWITCH");
    expect(sizeMultiplier(0, -0.21).status).toBe("KILL_SWITCH");
  });

  it("sizes sat to 1% risk", () => {
    const s = satContracts(100_000, 2, 1);
    expect(s.contracts).toBe(5); // $1000 / $200
    expect(s.reason).toBe("OK");
  });

  it("csp respects core budget", () => {
    const s = cspContracts(25_000, 100, 1, 0);
    // core 70% = 17500 → 1 contract at $10k
    expect(s.contracts).toBe(1);
  });

  it("selects bull put credit in uptrend high IV high confluence", () => {
    const plans = selectStructure({
      regime: "TREND_UP",
      ivRank: 45,
      bias: "long",
      confluence: 78,
    });
    const primary = pickPrimary(plans, 78, "AAPL");
    expect(primary?.structure).toBe("BULL_PUT_CREDIT_SPREAD");
  });

  it("prefers CSP on core name with modest confluence", () => {
    const plans = selectStructure({
      regime: "TREND_UP",
      ivRank: 40,
      bias: "long",
      confluence: 58,
    });
    const primary = pickPrimary(plans, 58, "SPY");
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
});
