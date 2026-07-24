import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgresql://kodo:kodo@localhost:5432/kodo"),
  ENABLE_YAHOO: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SCAN_MAX_SYMBOLS: z.coerce.number().int().min(1).max(100).default(50),
  ANALYSIS_DAILY_BUDGET: z.coerce.number().int().min(0).default(40),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  XAI_API_KEY: z.string().optional(),
  /** Deep analysis model — Grok 4.5 flagship. */
  XAI_MODEL: z.string().default("grok-4.5"),
  XAI_MODEL_FALLBACK: z.string().default("grok-3"),
  FINNHUB_API_KEY: z.string().optional(),
  POLYGON_API_KEY: z.string().optional(),
  TWELVE_DATA_API_KEY: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  APP_PASSWORD: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  cached = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    ENABLE_YAHOO: process.env.ENABLE_YAHOO,
    SCAN_MAX_SYMBOLS: process.env.SCAN_MAX_SYMBOLS,
    ANALYSIS_DAILY_BUDGET: process.env.ANALYSIS_DAILY_BUDGET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    XAI_API_KEY: process.env.XAI_API_KEY,
    XAI_MODEL: process.env.XAI_MODEL,
    XAI_MODEL_FALLBACK: process.env.XAI_MODEL_FALLBACK,
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    POLYGON_API_KEY: process.env.POLYGON_API_KEY,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
    APP_PASSWORD: process.env.APP_PASSWORD,
  });
  return cached;
}

export function providerConfigured() {
  const e = getEnv();
  return {
    yahoo: e.ENABLE_YAHOO,
    finnhub: Boolean(e.FINNHUB_API_KEY),
    polygon: Boolean(e.POLYGON_API_KEY),
    twelveData: Boolean(e.TWELVE_DATA_API_KEY),
    alphaVantage: Boolean(e.ALPHA_VANTAGE_API_KEY),
    xai: Boolean(e.XAI_API_KEY),
  };
}
