import { ok } from "@/lib/api";
import { getQuotes } from "@/lib/providers/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDICES = ["SPY", "QQQ", "DIA", "IWM", "^VIX"];

export async function GET() {
  const quotes = await getQuotes(INDICES);
  return ok({
    indices: quotes,
    delayed: true,
    asOf: new Date().toISOString(),
  });
}
