import { ok } from "@/lib/api";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { detectMarketRegime } from "@/lib/regime/detect";
import type { MarketRegime } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = "regime:v1";
  const hit = cacheGet<MarketRegime>(key);
  if (hit) return ok({ regime: hit, cached: true });

  const regime = await detectMarketRegime();
  cacheSet(key, regime, TTL.regime);
  return ok({ regime, cached: false });
}
