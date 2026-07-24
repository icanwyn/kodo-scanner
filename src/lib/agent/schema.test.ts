import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  normalizeRawThesis,
  tradeThesisSchema,
} from "./schema";
import { postValidateThesis } from "./validate";

describe("thesis parse resilience", () => {
  it("extracts fenced json", () => {
    const raw = '```json\n{"bias":"long","confidence":70}\n```';
    const obj = extractJsonObject(raw) as { bias: string };
    expect(obj.bias).toBe("long");
  });

  it("coerces string numbers and missing fields", () => {
    const normalized = normalizeRawThesis(
      {
        bias: "LONG",
        confidence: "65",
        entry: { zoneLow: "100", zoneHigh: "101", rationale: "x" },
        stop: { price: "98", rationale: "y" },
        targets: [{ price: "105", portion: "1", rationale: "t" }],
      },
      "AAPL",
      100
    );
    const parsed = tradeThesisSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const check = postValidateThesis(
        { ...parsed.data, symbol: "AAPL" },
        100
      );
      expect(check.ok).toBe(true);
    }
  });
});
