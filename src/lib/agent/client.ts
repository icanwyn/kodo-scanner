import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import {
  extractJsonObject,
  normalizeRawThesis,
  tradeThesisSchema,
  type ThesisParsed,
} from "./schema";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompts";
import { postValidateThesis } from "./validate";
import { analysisBudgetStatus, consumeAnalysisBudget } from "./budget";
import { logger } from "@/lib/log";

function client() {
  const key = getEnv().XAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://api.x.ai/v1",
    timeout: 90_000, // grok-4.5 can be slower
  });
}

/** Stable key so reopening the same symbol reuses thesis (token saver). */
function cacheKey(symbol: string, model: string) {
  return `analysis:thesis:${symbol.toUpperCase()}:${model}`;
}

function formatZodError(err: { issues?: readonly { path: PropertyKey[]; message: string }[] }) {
  if (!err?.issues?.length) return "unknown schema error";
  return err.issues
    .slice(0, 6)
    .map((i) => `${i.path.map(String).join(".") || "root"}: ${i.message}`)
    .join("; ");
}

function parseThesis(
  rawText: string,
  symbol: string,
  lastPrice: number
):
  | { ok: true; thesis: ThesisParsed }
  | { ok: false; detail: string } {
  try {
    const extracted = extractJsonObject(rawText);
    const normalized = normalizeRawThesis(extracted, symbol, lastPrice);
    const parsed = tradeThesisSchema.safeParse(normalized);
    if (!parsed.success) {
      return {
        ok: false,
        detail: formatZodError(parsed.error),
      };
    }
    const withSymbol = {
      ...parsed.data,
      symbol: symbol.toUpperCase(),
    };
    const check = postValidateThesis(withSymbol, lastPrice);
    if (!check.ok) return { ok: false, detail: check.reason };
    return { ok: true, thesis: check.thesis };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runDeepAnalysis(input: {
  symbol: string;
  price: number;
  regime: { label: string };
  factors: unknown;
  confluenceScore: number;
  sideBias: string;
  headlines: string[];
}): Promise<
  | { ok: true; thesis: ThesisParsed; cached: boolean; model: string }
  | { ok: false; code: string; message: string; model?: string }
> {
  const model = getEnv().XAI_MODEL?.trim() || "grok-4.5";
  const key = cacheKey(input.symbol, model);
  const hit = cacheGet<ThesisParsed>(key);
  if (hit) return { ok: true, thesis: hit, cached: true, model };

  const c = client();
  if (!c) {
    return {
      ok: false,
      code: "XAI_NOT_CONFIGURED",
      message:
        "Set XAI_API_KEY for deep analysis. Factor breakdown is still available.",
      model,
    };
  }

  const budget = analysisBudgetStatus();
  if (budget.remaining <= 0) {
    return {
      ok: false,
      code: "BUDGET_EXCEEDED",
      message: `Daily analysis budget (${budget.limit}) exhausted. Restarts reset the counter.`,
      model,
    };
  }

  if (!consumeAnalysisBudget()) {
    return {
      ok: false,
      code: "BUDGET_EXCEEDED",
      message: "Analysis budget exhausted.",
      model,
    };
  }

  const user = buildUserMessage(input);

  async function once(modelId: string, extra?: string): Promise<string> {
    const resp = await c!.chat.completions.create({
      model: modelId,
      temperature: 0.2,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: extra ? `${user}\n\nRepair note: ${extra}` : user,
        },
      ],
    });
    const text = resp.choices[0]?.message?.content;
    if (!text) {
      throw new Error("Empty model response (no content)");
    }
    return text;
  }

  try {
    let text = await once(model);
    let result = parseThesis(text, input.symbol, input.price);

    if (!result.ok) {
      logger.warn("thesis schema retry", { detail: result.detail });
      text = await once(
        model,
        `Your previous JSON failed validation (${result.detail}). Return ONLY a single JSON object with exactly these keys: symbol, bias (long|short|avoid), confidence (0-100 number), marketConditionSummary, technicalSummary, sentimentSummary, confluenceNarrative, entry:{zoneLow,zoneHigh,rationale}, stop:{price,rationale}, targets:[{price,portion,rationale}] (portions sum to 1), riskReward (number), invalidation, risks (string[]), checklist (string[]), disclaimer (must include "Not financial advice"). All prices must be near lastPrice ${input.price}.`
      );
      result = parseThesis(text, input.symbol, input.price);
    }

    if (!result.ok) {
      logger.error("thesis schema failed after retry", {
        detail: result.detail,
        sample: text.slice(0, 400),
      });
      return {
        ok: false,
        code: "SCHEMA_INVALID",
        message: `Model output failed validation: ${result.detail}`,
        model,
      };
    }

    cacheSet(key, result.thesis, TTL.analysis);
    return { ok: true, thesis: result.thesis, cached: false, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("deep analysis failed", { error: msg, model });

    const fallback = getEnv().XAI_MODEL_FALLBACK?.trim();
    if (fallback && fallback !== model) {
      try {
        const text = await once(fallback);
        const result = parseThesis(text, input.symbol, input.price);
        if (result.ok) {
          cacheSet(key, result.thesis, TTL.analysis);
          return {
            ok: true,
            thesis: result.thesis,
            cached: false,
            model: fallback,
          };
        }
      } catch (e2) {
        logger.error("fallback model failed", { error: String(e2) });
      }
    }

    // Surface API errors (403 credits, 404 model, etc.) clearly
    return {
      ok: false,
      code: "ANALYSIS_FAILED",
      message: msg,
      model,
    };
  }
}
