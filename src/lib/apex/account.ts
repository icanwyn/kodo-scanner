/** Browser-only APEX account prefs (localStorage). */

export const APEX_ACCOUNT_KEY = "kodo_apex_account_v1";

export interface ApexAccountPrefs {
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
  equity: 25000,
  mtdReturnPct: 0,
  peakDrawdownPct: 0,
  cashUsedCore: 0,
  monthlyAdd: 1000,
  monthlyRatePct: 3,
  defaultSpreadWidth: 5,
  defaultCredit: 1.2,
};

export function loadApexAccount(): ApexAccountPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_APEX_ACCOUNT };
  try {
    const raw = localStorage.getItem(APEX_ACCOUNT_KEY);
    if (!raw) return { ...DEFAULT_APEX_ACCOUNT };
    return { ...DEFAULT_APEX_ACCOUNT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_APEX_ACCOUNT };
  }
}

export function saveApexAccount(prefs: Partial<ApexAccountPrefs>): ApexAccountPrefs {
  const next = { ...loadApexAccount(), ...prefs };
  if (typeof window !== "undefined") {
    localStorage.setItem(APEX_ACCOUNT_KEY, JSON.stringify(next));
  }
  return next;
}
