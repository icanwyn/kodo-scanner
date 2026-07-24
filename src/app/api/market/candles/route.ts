import { err, isValidSymbol, normalizeSymbol, ok } from "@/lib/api";
import { getCandles } from "@/lib/providers/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get("symbol") ?? "");
  const range = searchParams.get("range") ?? "1y";
  if (!isValidSymbol(symbol)) return err("INVALID_SYMBOL", "Invalid symbol");

  const candles = await getCandles(symbol, range);
  if (!candles) return err("NOT_FOUND", `No candles for ${symbol}`, 404);

  return ok({
    symbol,
    interval: "1d",
    candles,
    attribution: {
      provider: "yahoo",
      delayed: true,
      delayMinutes: 15,
      fetchedAt: new Date().toISOString(),
    },
  });
}
