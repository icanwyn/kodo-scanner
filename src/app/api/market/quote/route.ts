import { err, isValidSymbol, normalizeSymbol, ok } from "@/lib/api";
import { getQuote, getQuotes } from "@/lib/providers/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") ?? searchParams.get("symbol");
  if (!symbolsParam) return err("MISSING_SYMBOL", "symbol or symbols required");

  const symbols = symbolsParam
    .split(",")
    .map(normalizeSymbol)
    .filter(isValidSymbol);

  if (!symbols.length) return err("INVALID_SYMBOL", "No valid symbols");

  if (symbols.length === 1) {
    const q = await getQuote(symbols[0]);
    if (!q) return err("NOT_FOUND", `No quote for ${symbols[0]}`, 404);
    return ok({ quote: q });
  }

  const quotes = await getQuotes(symbols);
  return ok({ quotes });
}
