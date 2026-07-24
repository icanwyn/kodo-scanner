import { err, ok } from "@/lib/api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const postmortem = await prisma.postmortem
    .update({
      where: { id },
      data: {
        whatWentRight: body.whatWentRight,
        whatWentWrong: body.whatWentWrong,
        emotions: body.emotions,
        processGrade: body.processGrade,
        lessons: body.lessons,
        wouldRepeat: body.wouldRepeat,
        bodyMarkdown: body.bodyMarkdown,
      },
    })
    .catch(() => null);
  if (!postmortem) return err("NOT_FOUND", "Postmortem not found", 404);
  return ok({ postmortem });
}
