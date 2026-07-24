import { z } from "zod";

const num = z.coerce.number();
const str = z.union([z.string(), z.number(), z.boolean()]).transform((v) =>
  String(v)
);
const strArr = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .transform((v) =>
    Array.isArray(v) ? v.map(String) : v ? [String(v)] : []
  );

export const tradeThesisSchema = z.object({
  symbol: str.optional().default(""),
  bias: z
    .union([z.enum(["long", "short", "avoid"]), z.string()])
    .transform((b) => {
      const s = String(b).toLowerCase().trim();
      if (s.includes("long") || s === "buy") return "long" as const;
      if (s.includes("short") || s === "sell") return "short" as const;
      return "avoid" as const;
    }),
  confidence: num.pipe(z.number().min(0).max(100)).catch(50),
  marketConditionSummary: str.default(""),
  technicalSummary: str.default(""),
  sentimentSummary: str.default(""),
  confluenceNarrative: str.default(""),
  entry: z
    .object({
      zoneLow: num,
      zoneHigh: num,
      rationale: str.default(""),
    })
    .or(
      z.object({
        low: num.optional(),
        high: num.optional(),
        zone_low: num.optional(),
        zone_high: num.optional(),
        price: num.optional(),
        rationale: str.optional(),
      })
    )
    .transform((e) => {
      if ("zoneLow" in e && "zoneHigh" in e) {
        return {
          zoneLow: Number(e.zoneLow),
          zoneHigh: Number(e.zoneHigh),
          rationale: String(e.rationale ?? ""),
        };
      }
      const any = e as Record<string, unknown>;
      const low = Number(any.zoneLow ?? any.low ?? any.zone_low ?? any.price ?? 0);
      const high = Number(
        any.zoneHigh ?? any.high ?? any.zone_high ?? any.price ?? low
      );
      return {
        zoneLow: Math.min(low, high),
        zoneHigh: Math.max(low, high),
        rationale: String(any.rationale ?? ""),
      };
    }),
  stop: z
    .object({
      price: num,
      rationale: str.default(""),
    })
    .or(z.object({ level: num.optional(), stop: num.optional(), price: num.optional(), rationale: str.optional() }))
    .transform((s) => {
      const any = s as Record<string, unknown>;
      return {
        price: Number(any.price ?? any.level ?? any.stop ?? 0),
        rationale: String(any.rationale ?? ""),
      };
    }),
  targets: z
    .array(
      z
        .object({
          price: num.optional(),
          level: num.optional(),
          portion: num.optional(),
          weight: num.optional(),
          rationale: str.optional(),
        })
        .or(num)
    )
    .min(1)
    .max(6)
    .transform((arr) => {
      const mapped = arr.map((t, i) => {
        if (typeof t === "number") {
          return {
            price: t,
            portion: 1 / arr.length,
            rationale: `Target ${i + 1}`,
          };
        }
        const any = t as Record<string, unknown>;
        return {
          price: Number(any.price ?? any.level ?? 0),
          portion: Number(any.portion ?? any.weight ?? 1 / arr.length),
          rationale: String(any.rationale ?? `Target ${i + 1}`),
        };
      });
      const sum = mapped.reduce((a, t) => a + t.portion, 0);
      if (sum > 0 && (sum < 0.85 || sum > 1.15)) {
        return mapped.map((t) => ({ ...t, portion: t.portion / sum }));
      }
      return mapped;
    }),
  riskReward: num.catch(0),
  invalidation: str.default(""),
  risks: strArr.default([]),
  checklist: strArr.default([]),
  disclaimer: str.default(
    "Not financial advice. For educational / journal use only."
  ),
});

export type ThesisParsed = z.infer<typeof tradeThesisSchema>;

/** Pull JSON object from model text (fences, prose wrappers). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* continue */
    }
  }
  throw new Error("Could not parse JSON from model response");
}

/** Coerce common model quirks before/after Zod. */
export function normalizeRawThesis(
  raw: unknown,
  symbol: string,
  lastPrice: number
): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };

  // Nested wrappers
  if (o.thesis && typeof o.thesis === "object") {
    Object.assign(o, o.thesis as object);
  }
  if (o.data && typeof o.data === "object" && !o.entry) {
    Object.assign(o, o.data as object);
  }

  o.symbol = String(o.symbol ?? symbol).toUpperCase();

  // confidence as 0-1 → 0-100
  if (typeof o.confidence === "number" && o.confidence > 0 && o.confidence <= 1) {
    o.confidence = o.confidence * 100;
  }

  // Flat entry fields
  if (!o.entry && (o.entryLow != null || o.entry_zone_low != null)) {
    o.entry = {
      zoneLow: o.entryLow ?? o.entry_zone_low ?? lastPrice * 0.99,
      zoneHigh: o.entryHigh ?? o.entry_zone_high ?? lastPrice * 1.01,
      rationale: o.entryRationale ?? "",
    };
  }
  if (!o.entry) {
    o.entry = {
      zoneLow: lastPrice * 0.995,
      zoneHigh: lastPrice * 1.005,
      rationale: "Anchored near last price",
    };
  }

  if (!o.stop) {
    const bias = String(o.bias ?? "avoid").toLowerCase();
    o.stop = {
      price:
        bias.includes("short")
          ? lastPrice * 1.02
          : lastPrice * 0.98,
      rationale: "Default stop near last price",
    };
  } else if (typeof o.stop === "number") {
    o.stop = { price: o.stop, rationale: "" };
  }

  if (!o.targets || (Array.isArray(o.targets) && o.targets.length === 0)) {
    const bias = String(o.bias ?? "long").toLowerCase();
    const t1 = bias.includes("short") ? lastPrice * 0.97 : lastPrice * 1.03;
    o.targets = [{ price: t1, portion: 1, rationale: "Default target" }];
  }

  for (const k of [
    "marketConditionSummary",
    "technicalSummary",
    "sentimentSummary",
    "confluenceNarrative",
    "invalidation",
    "disclaimer",
  ]) {
    if (o[k] == null) o[k] = "";
  }
  if (!Array.isArray(o.risks)) o.risks = o.risks ? [String(o.risks)] : [];
  if (!Array.isArray(o.checklist))
    o.checklist = o.checklist ? [String(o.checklist)] : [];
  if (o.riskReward == null) o.riskReward = 0;
  if (!o.disclaimer || !String(o.disclaimer).toLowerCase().includes("not financial")) {
    o.disclaimer =
      "Not financial advice. For educational / journal use only. " +
      String(o.disclaimer ?? "");
  }

  return o;
}
