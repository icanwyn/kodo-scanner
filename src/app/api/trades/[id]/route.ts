import { err, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { postmortem: true },
  });
  if (!trade) return err("NOT_FOUND", "Trade not found", 404);
  return ok({ trade });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) return err("NOT_FOUND", "Trade not found", 404);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "close") {
    if (trade.status !== "OPEN") {
      return err("TRADE_ALREADY_CLOSED", "Trade is not open", 409);
    }
    const exitPrice = Number(body.exitPrice);
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
      return err("VALIDATION", "exitPrice required");
    }
    const updated = await prisma.trade.update({
      where: { id },
      data: {
        status: "CLOSED",
        exitPrice,
        closedAt: new Date(),
        fees: body.fees != null ? Number(body.fees) : trade.fees,
        notes: body.notes ?? trade.notes,
      },
      include: { postmortem: true },
    });
    return ok({ trade: updated });
  }

  if (action === "cancel") {
    if (trade.status !== "OPEN") {
      return err("TRADE_ALREADY_CLOSED", "Trade is not open", 409);
    }
    const updated = await prisma.trade.update({
      where: { id },
      data: { status: "CANCELLED", closedAt: new Date() },
      include: { postmortem: true },
    });
    return ok({ trade: updated });
  }

  // update open fields
  if (trade.status !== "OPEN") {
    return err("INVALID_STATE", "Only open trades can be edited", 409);
  }

  const updated = await prisma.trade.update({
    where: { id },
    data: {
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      stopPrice: body.stopPrice != null ? Number(body.stopPrice) : undefined,
      // stopAtEntry frozen — never update here
      targetPrices:
        body.targetPrices != null
          ? JSON.stringify(body.targetPrices)
          : undefined,
      notes: body.notes ?? undefined,
      thesisSummary: body.thesisSummary ?? undefined,
      setupType: body.setupType ?? undefined,
      tags: body.tags != null ? JSON.stringify(body.tags) : undefined,
    },
    include: { postmortem: true },
  });
  return ok({ trade: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await prisma.trade.delete({ where: { id } }).catch(() => null);
  return ok({ deleted: true });
}
