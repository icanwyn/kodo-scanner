import type { ThesisParsed } from "./schema";

/**
 * Soft business rules: fix what we can, force avoid only when structure is junk.
 * Never fail the whole thesis for minor RR / portion drift.
 */
export function postValidateThesis(
  thesis: ThesisParsed,
  lastPrice: number
): { ok: true; thesis: ThesisParsed } | { ok: false; reason: string } {
  const t = { ...thesis };
  t.entry = { ...t.entry };
  t.stop = { ...t.stop };
  t.targets = t.targets.map((x) => ({ ...x }));

  if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
    return { ok: false, reason: "invalid last price for validation" };
  }

  // Swap inverted entry zone
  if (t.entry.zoneLow > t.entry.zoneHigh) {
    const tmp = t.entry.zoneLow;
    t.entry.zoneLow = t.entry.zoneHigh;
    t.entry.zoneHigh = tmp;
  }

  // Pull entry toward last price if wildly off
  const mid = (t.entry.zoneLow + t.entry.zoneHigh) / 2;
  if (Math.abs(mid - lastPrice) / lastPrice > 0.12) {
    t.entry.zoneLow = lastPrice * 0.99;
    t.entry.zoneHigh = lastPrice * 1.01;
    t.entry.rationale =
      (t.entry.rationale ? t.entry.rationale + " · " : "") +
      "Re-anchored to last price (model zone was far from market)";
    if (t.bias !== "avoid") {
      t.risks = [
        ...t.risks,
        "Entry zone was far from last price and was re-anchored",
      ];
    }
  }

  if (t.bias === "long") {
    if (!(t.stop.price < t.entry.zoneLow)) {
      t.stop.price = t.entry.zoneLow * 0.98;
      t.stop.rationale =
        (t.stop.rationale ? t.stop.rationale + " · " : "") +
        "Adjusted below entry for long";
    }
    t.targets = t.targets.map((tg) =>
      tg.price <= t.entry.zoneHigh
        ? {
            ...tg,
            price: t.entry.zoneHigh * 1.02,
            rationale: tg.rationale + " · lifted above entry",
          }
        : tg
    );
  }

  if (t.bias === "short") {
    if (!(t.stop.price > t.entry.zoneHigh)) {
      t.stop.price = t.entry.zoneHigh * 1.02;
      t.stop.rationale =
        (t.stop.rationale ? t.stop.rationale + " · " : "") +
        "Adjusted above entry for short";
    }
    t.targets = t.targets.map((tg) =>
      tg.price >= t.entry.zoneLow
        ? {
            ...tg,
            price: t.entry.zoneLow * 0.98,
            rationale: tg.rationale + " · lowered below entry",
          }
        : tg
    );
  }

  // Normalize portions
  const sum = t.targets.reduce((a, x) => a + (Number(x.portion) || 0), 0);
  if (t.targets.length && (sum < 0.85 || sum > 1.15 || sum === 0)) {
    const each = 1 / t.targets.length;
    t.targets = t.targets.map((x) => ({ ...x, portion: each }));
  }

  if (!t.disclaimer.toLowerCase().includes("not financial advice")) {
    t.disclaimer =
      "Not financial advice. For educational / journal use only. " +
      t.disclaimer;
  }

  // Recompute rough R:R if missing
  if (!Number.isFinite(t.riskReward) || t.riskReward <= 0) {
    const entryMid = (t.entry.zoneLow + t.entry.zoneHigh) / 2;
    const risk = Math.abs(entryMid - t.stop.price);
    const reward = Math.abs(t.targets[0]?.price - entryMid);
    t.riskReward = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;
  }

  return { ok: true, thesis: t };
}
