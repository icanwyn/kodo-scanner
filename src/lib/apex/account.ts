/** Browser-only APEX account prefs (localStorage). */

import type { ApexProfileId } from "./engine";
import { getProfile } from "./engine";

export const APEX_ACCOUNT_KEY = "kodo_apex_account_v1";

export interface ApexAccountPrefs {
  /** compound = original path · velocity = aggressive */
  mode: ApexProfileId;
  equity: number;
  mtdReturnPct: number;
  peakDrawdownPct: number;
  cashUsedCore: number;
  monthlyAdd: number;
  monthlyRatePct: number;
  defaultSpreadWidth: number;
  defaultCredit: number;
}

export const DEFAULT_APEX_ACCOUNT: ApexAccountPrefs = {
  mode: "compound",
  equity: 100000,
  mtdReturnPct: 0,
  peakDrawdownPct: 0,
  cashUsedCore: 0,
  monthlyAdd: 0,
  monthlyRatePct: 2.5,
  defaultSpreadWidth: 5,
  defaultCredit: 1.2,
};

export function loadApexAccount(): ApexAccountPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_APEX_ACCOUNT };
  try {
    const raw = localStorage.getItem(APEX_ACCOUNT_KEY);
    if (!raw) return { ...DEFAULT_APEX_ACCOUNT };
    const parsed = { ...DEFAULT_APEX_ACCOUNT, ...JSON.parse(raw) };
    if (parsed.mode !== "velocity" && parsed.mode !== "compound") {
      parsed.mode = "compound";
    }
    return parsed;
  } catch {
    return { ...DEFAULT_APEX_ACCOUNT };
  }
}

export function saveApexAccount(
  prefs: Partial<ApexAccountPrefs>
): ApexAccountPrefs {
  const prev = loadApexAccount();
  let next = { ...prev, ...prefs };

  // Switching into Velocity: bump planning rate to profile default if still on compound default
  if (prefs.mode === "velocity" && prev.mode !== "velocity") {
    const vel = getProfile("velocity");
    if (prev.monthlyRatePct <= 3.5) {
      next.monthlyRatePct = vel.planningMonthlyRate * 100;
    }
  }
  if (prefs.mode === "compound" && prev.mode !== "compound") {
    const c = getProfile("compound");
    if (prev.monthlyRatePct >= 5) {
      next.monthlyRatePct = c.planningMonthlyRate * 100;
    }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(APEX_ACCOUNT_KEY, JSON.stringify(next));
  }
  return next;
}

export function activeProfileId(): ApexProfileId {
  return loadApexAccount().mode === "velocity" ? "velocity" : "compound";
}
