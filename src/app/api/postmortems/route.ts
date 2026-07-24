import { err, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  tradeId: z.string(),
  whatWentRight: z.string().optional(),
  whatWentWrong: z.string().optional(),
  emotions: z.string().optional(),
  processGrade: z.enum(["A", "B", "C", "D", "F"]).optional().nullable(),
  lessons: z.string().optional(),
  wouldRepeat: z.boolean().optional().nullable(),
  bodyMarkdown: z.string().optional(),
});

export async function GET() {
  const postmortems = await prisma.postmortem.findMany({
    include: { trade: true },
    orderBy: { updatedAt: "desc" },
  });
  return ok({ postmortems });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION", "Invalid postmortem", 400, parsed.error.flatten());
  }
  const d = parsed.data;
  const trade = await prisma.trade.findUnique({ where: { id: d.tradeId } });
  if (!trade) return err("NOT_FOUND", "Trade not found", 404);

  const existing = await prisma.postmortem.findUnique({
    where: { tradeId: d.tradeId },
  });

  const data = {
    whatWentRight: d.whatWentRight,
    whatWentWrong: d.whatWentWrong,
    emotions: d.emotions,
    processGrade: d.processGrade ?? null,
    lessons: d.lessons,
    wouldRepeat: d.wouldRepeat ?? null,
    bodyMarkdown: d.bodyMarkdown,
  };

  const postmortem = existing
    ? await prisma.postmortem.update({
        where: { tradeId: d.tradeId },
        data,
      })
    : await prisma.postmortem.create({
        data: { tradeId: d.tradeId, ...data },
      });

  return ok({ postmortem }, { status: existing ? 200 : 201 });
}
