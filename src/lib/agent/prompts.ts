export const SYSTEM_PROMPT = `You are Kōdō Scanner's deep market analysis agent for discretionary equity traders.
You synthesize market regime, multi-factor technical confluence, and news headlines into a structured trade thesis.

CRITICAL OUTPUT RULES:
- Respond with a single JSON object only. No markdown, no code fences, no commentary.
- All numeric fields must be JSON numbers (not strings).
- bias must be exactly one of: "long", "short", "avoid"
- confidence must be a number from 0 to 100 (not 0-1)
- entry must be { "zoneLow": number, "zoneHigh": number, "rationale": string }
- stop must be { "price": number, "rationale": string }
- targets must be an array of { "price": number, "portion": number, "rationale": string } with portions summing to ~1.0
- risks and checklist must be string arrays
- Always include disclaimer containing: "Not financial advice"

Trading rules:
- Be conservative: weak/conflicting confluence → bias "avoid"
- Never claim certainty
- Stops on correct side of entry (below for long, above for short)
- Prefer risk:reward >= 1.5 when proposing a trade; otherwise lean avoid
- Entry zone within ~5% of the provided lastPrice
`;

export function buildUserMessage(ctx: {
  symbol: string;
  price: number;
  regime: unknown;
  factors: unknown;
  confluenceScore: number;
  sideBias: string;
  headlines: string[];
}) {
  return JSON.stringify(
    {
      task: "Produce a TradeThesis JSON object with the exact schema below",
      symbol: ctx.symbol,
      lastPrice: ctx.price,
      structuralSideBias: ctx.sideBias,
      confluenceScore: ctx.confluenceScore,
      marketRegime: ctx.regime,
      factorBreakdown: ctx.factors,
      recentHeadlines: ctx.headlines,
      exampleShape: {
        symbol: ctx.symbol,
        bias: "long",
        confidence: 62,
        marketConditionSummary: "string",
        technicalSummary: "string",
        sentimentSummary: "string",
        confluenceNarrative: "string",
        entry: {
          zoneLow: ctx.price * 0.995,
          zoneHigh: ctx.price * 1.005,
          rationale: "string",
        },
        stop: { price: ctx.price * 0.97, rationale: "string" },
        targets: [
          { price: ctx.price * 1.03, portion: 0.5, rationale: "string" },
          { price: ctx.price * 1.06, portion: 0.5, rationale: "string" },
        ],
        riskReward: 2.0,
        invalidation: "string",
        risks: ["string"],
        checklist: ["string"],
        disclaimer: "Not financial advice. For educational / journal use only.",
      },
    },
    null,
    2
  );
}
