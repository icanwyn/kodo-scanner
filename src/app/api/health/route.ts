import { ok } from "@/lib/api";
import { cacheStats } from "@/lib/cache";
import { providerConfigured } from "@/lib/env";
import { analysisBudgetStatus } from "@/lib/agent/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    status: "ok",
    ts: new Date().toISOString(),
    providers: providerConfigured(),
    cache: cacheStats(),
    analysisBudget: analysisBudgetStatus(),
    runtime: "long-lived-node",
    note: "SQLite local-first; not for serverless deploy",
  });
}
