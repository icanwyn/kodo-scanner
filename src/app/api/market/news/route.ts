import { normalizeSymbol, ok } from "@/lib/api";
import { getNews } from "@/lib/providers/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const news = await getNews(symbol ? normalizeSymbol(symbol) : undefined);
  return ok({ news, asOf: new Date().toISOString() });
}
