import { describe, expect, it } from "vitest";
import {
  expectancy,
  profitFactor,
  rMultiple,
  realizedPnl,
  winRate,
} from "./pnl";

describe("pnl", () => {
  it("long realized pnl", () => {
    expect(
      realizedPnl({ side: "LONG", entry: 100, exit: 110, quantity: 10, fees: 1 })
    ).toBe(99);
  });

  it("short realized pnl", () => {
    expect(
      realizedPnl({ side: "SHORT", entry: 100, exit: 90, quantity: 10, fees: 0 })
    ).toBe(100);
  });

  it("r-multiple long/short", () => {
    expect(
      rMultiple({
        side: "LONG",
        entry: 100,
        exit: 110,
        quantity: 10,
        stopAtEntry: 95,
      })
    ).toBeCloseTo(2);

    expect(
      rMultiple({
        side: "SHORT",
        entry: 100,
        exit: 90,
        quantity: 10,
        stopAtEntry: 105,
      })
    ).toBeCloseTo(2);
  });

  it("stats helpers", () => {
    const pnls = [100, -50, 25];
    expect(winRate(pnls)).toBeCloseTo(2 / 3);
    expect(expectancy(pnls)).toBeCloseTo(25);
    expect(profitFactor(pnls)).toBeCloseTo(125 / 50);
  });
});
