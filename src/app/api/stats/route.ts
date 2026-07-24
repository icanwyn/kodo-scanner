import { ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { computeJournalStats } from "@/lib/journal/stats";
import { getQuotes } from "@/lib/providers/cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const trades = await prisma.trade.findMany({
    orderBy: { openedAt: "desc" },
  });
  const openSyms = Array.from(
    new Set(trades.filter((t) => t.status === "OPEN").map((t) => t.symbol))
  );
  const quotes = openSyms.length ? await getQuotes(openSyms) : [];
  const marks = Object.fromEntries(quotes.map((q) => [q.symbol, q.price]));
  const stats = computeJournalStats(trades, marks);
  return ok({ stats, openMarks: marks });
}
