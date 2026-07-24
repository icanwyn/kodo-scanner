import { getEnv } from "@/lib/env";

/** In-memory daily analysis budget. Resets on process restart (v1). */
let dayKey = "";
let count = 0;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function analysisBudgetStatus() {
  const key = todayKey();
  if (key !== dayKey) {
    dayKey = key;
    count = 0;
  }
  const limit = getEnv().ANALYSIS_DAILY_BUDGET;
  return { used: count, limit, remaining: Math.max(0, limit - count) };
}

export function consumeAnalysisBudget(): boolean {
  const st = analysisBudgetStatus();
  if (st.remaining <= 0) return false;
  count += 1;
  return true;
}
