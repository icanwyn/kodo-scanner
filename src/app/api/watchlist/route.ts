import { err, isValidSymbol, normalizeSymbol, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.watchlistItem.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return ok({ items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const symbol = normalizeSymbol(String(body.symbol ?? ""));
  if (!isValidSymbol(symbol)) return err("INVALID_SYMBOL", "Invalid symbol");

  const item = await prisma.watchlistItem.upsert({
    where: { symbol },
    create: { symbol, notes: body.notes ?? null },
    update: { notes: body.notes ?? undefined },
  });
  return ok({ item }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = normalizeSymbol(searchParams.get("symbol") ?? "");
  if (!isValidSymbol(symbol)) return err("INVALID_SYMBOL", "Invalid symbol");
  await prisma.watchlistItem.deleteMany({ where: { symbol } });
  return ok({ deleted: true });
}
