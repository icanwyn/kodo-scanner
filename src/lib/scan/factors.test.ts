import { describe, expect, it } from "vitest";
import { FACTOR_CONFIG, rsiScoreLong, rsiScoreShort } from "./factors";

describe("factors", () => {
  it("weights sum to 1", () => {
    const sum = FACTOR_CONFIG.reduce((a, f) => a + f.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("rsi long prefers mid band", () => {
    expect(rsiScoreLong(55)).toBeGreaterThanOrEqual(60);
    expect(rsiScoreLong(100)).toBeLessThan(10);
    expect(rsiScoreLong(85)).toBeLessThan(60);
  });

  it("rsi short prefers elevated", () => {
    expect(rsiScoreShort(72)).toBeGreaterThanOrEqual(60);
    expect(rsiScoreShort(25)).toBeLessThan(30);
  });
});
