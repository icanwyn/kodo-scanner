import { ok } from "@/lib/api";
import { getMovers, getQuotes } from "@/lib/providers/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const symbols = await getMovers();
  const quotes = await getQuotes(symbols.slice(0, 30));
  quotes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return ok({
    symbols,
    quotes,
    delayed: true,
    asOf: new Date().toISOString(),
  });
}
