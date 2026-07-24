import { err, isValidSymbol, normalizeSymbol, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  symbol: z.string(),
  side: z.enum(["LONG", "SHORT"]),
  quantity: z.number().positive(),
  entryPrice: z.number().positive(),
  stopPrice: z.number().positive().optional().nullable(),
  targetPrices: z.array(z.number()).optional(),
  fees: z.number().min(0).optional(),
  thesisSummary: z.string().optional(),
  notes: z.string().optional(),
  setupType: z.string().optional(),
  timeframe: z.string().optional(),
  analysisJson: z.string().optional(),
  scanFactorsJson: z.string().optional(),
  entryAttribution: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const symbol = searchParams.get("symbol");

  const trades = await prisma.trade.findMany({
    where: {
      ...(status ? { status: status as "OPEN" | "CLOSED" | "CANCELLED" } : {}),
      ...(symbol ? { symbol: normalizeSymbol(symbol) } : {}),
    },
    include: { postmortem: true },
    orderBy: { openedAt: "desc" },
  });
  return ok({ trades });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid trade payload", 400, parsed.error.flatten());
  }
  const d = parsed.data;
  const symbol = normalizeSymbol(d.symbol);
  if (!isValidSymbol(symbol)) return err("INVALID_SYMBOL", "Invalid symbol");

  const trade = await prisma.trade.create({
    data: {
      symbol,
      side: d.side,
      quantity: d.quantity,
      entryPrice: d.entryPrice,
      stopPrice: d.stopPrice ?? null,
      stopAtEntry: d.stopPrice ?? null,
      targetPrices: d.targetPrices ? JSON.stringify(d.targetPrices) : null,
      fees: d.fees ?? 0,
      thesisSummary: d.thesisSummary,
      notes: d.notes,
      setupType: d.setupType,
      timeframe: d.timeframe ?? "1D",
      analysisJson: d.analysisJson,
      scanFactorsJson: d.scanFactorsJson,
      entryAttribution: d.entryAttribution,
      tags: d.tags ? JSON.stringify(d.tags) : null,
      status: "OPEN",
    },
  });
  return ok({ trade }, { status: 201 });
}
