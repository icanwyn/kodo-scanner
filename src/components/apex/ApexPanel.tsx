"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApexRecommendation } from "@/types";
import {
  buildTicket,
  getProfile,
  profileLabel,
  structureLabel,
  type ApexProfileId,
  type ApexStructure,
} from "@/lib/apex/engine";
import {
  loadApexAccount,
  saveApexAccount,
  type ApexAccountPrefs,
} from "@/lib/apex/account";

function shortStructure(s: string): string {
  const map: Record<string, string> = {
    CASH_SECURED_PUT: "CSP",
    COVERED_CALL: "CC",
    BULL_PUT_CREDIT_SPREAD: "Bull put credit",
    BULL_CALL_DEBIT_SPREAD: "Bull call debit",
    BEAR_CALL_CREDIT_SPREAD: "Bear call credit",
    BEAR_PUT_DEBIT_SPREAD: "Bear put debit",
    SKIP_OR_IRON_CONDOR_ADVANCED: "Skip / IC",
  };
  return map[s] ?? structureLabel(s);
}

function resolvePrimary(
  apex: ApexRecommendation,
  mode: ApexProfileId
) {
  if (mode === "velocity" && apex.velocityPrimary) {
    return {
      primary: apex.velocityPrimary,
      plans: apex.velocityPlans?.length ? apex.velocityPlans : apex.plans,
    };
  }
  return { primary: apex.primary, plans: apex.plans };
}

export function ApexChip({ apex }: { apex?: ApexRecommendation | null }) {
  const [mode, setMode] = useState<ApexProfileId>("compound");
  useEffect(() => {
    setMode(loadApexAccount().mode);
  }, []);

  if (!apex) {
    return (
      <span className="chip text-[10px] text-[var(--kodo-ink-muted)]">
        APEX —
      </span>
    );
  }
  const { primary } = resolvePrimary(apex, mode);
  if (!primary) {
    return (
      <span className="chip text-[10px] text-[var(--kodo-ink-muted)]">
        APEX —
      </span>
    );
  }
  const isSat = primary.engine === "SATELLITE";
  const isVel = mode === "velocity";
  return (
    <span
      className="chip mono text-[10px]"
      title={primary.notes}
      style={{
        color: isVel
          ? "var(--kodo-warning)"
          : isSat
            ? "var(--kodo-magenta)"
            : "var(--kodo-cyan)",
        borderColor: isVel
          ? "rgba(240,180,41,0.4)"
          : isSat
            ? "rgba(255,43,214,0.35)"
            : "rgba(45,226,230,0.35)",
      }}
    >
      {isVel ? "VEL" : "APEX"} · {primary.engine === "CORE" ? "CORE" : "SAT"} ·{" "}
      {shortStructure(primary.structure)}
    </span>
  );
}

export function ApexPanel({
  symbol,
  price,
  apex,
  compact = false,
  onLogged,
}: {
  symbol: string;
  price: number;
  apex?: ApexRecommendation | null;
  compact?: boolean;
  onLogged?: () => void;
}) {
  const [acct, setAcct] = useState<ApexAccountPrefs | null>(null);
  const [structure, setStructure] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    setAcct(loadApexAccount());
  }, []);

  const mode: ApexProfileId = acct?.mode === "velocity" ? "velocity" : "compound";
  const profile = getProfile(mode);
  const resolved = apex ? resolvePrimary(apex, mode) : null;

  useEffect(() => {
    if (resolved?.primary?.structure) setStructure(resolved.primary.structure);
  }, [resolved?.primary?.structure, symbol, mode]);

  const ticket = useMemo(() => {
    if (!acct || !structure) return null;
    const width = acct.defaultSpreadWidth;
    const credit = acct.defaultCredit;
    const isCredit = structure.includes("CREDIT");
    const isDebit = structure.includes("DEBIT");
    const maxLoss = isCredit
      ? Math.max(0.01, width - credit)
      : isDebit
        ? credit
        : undefined;
    return buildTicket({
      equity: acct.equity,
      symbol,
      price,
      strike: apex?.suggestedCspStrike ?? price * 0.95,
      structure: structure as ApexStructure,
      maxLossPerShare: maxLoss,
      creditOrDebit: credit,
      mtdReturn: acct.mtdReturnPct / 100,
      peakDrawdown: acct.peakDrawdownPct / 100,
      cashUsedCore: acct.cashUsedCore,
      profileId: mode,
    });
  }, [acct, structure, symbol, price, apex?.suggestedCspStrike, mode]);

  if (!apex || !resolved) {
    return (
      <div className="glass p-4 text-sm text-[var(--kodo-ink-muted)]">
        APEX plans attach after a scan or analysis with regime context.
      </div>
    );
  }

  const displayPrimary = resolved.primary;
  const displayPlans = resolved.plans;

  function setMode(next: ApexProfileId) {
    const saved = saveApexAccount({ mode: next });
    setAcct(saved);
  }

  async function logApex() {
    if (!ticket || !acct || !apex) return;
    const rec = apex;
    setBusy(true);
    setMsg("");
    try {
      const size = ticket.size as { contracts?: number | string };
      const qty =
        typeof size.contracts === "number"
          ? Math.max(1, size.contracts) * 100
          : 100;

      const isShortPremium =
        (structure.includes("PUT") && structure.includes("CREDIT")) ||
        structure === "CASH_SECURED_PUT" ||
        structure === "COVERED_CALL" ||
        structure.includes("BEAR_CALL");

      const side =
        structure.includes("BEAR") || structure === "COVERED_CALL"
          ? "SHORT"
          : "LONG";

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          quantity: qty,
          entryPrice: price,
          stopPrice: side === "LONG" ? price * 0.97 : price * 1.03,
          thesisSummary: `APEX ${mode.toUpperCase()} ${structure} · ${displayPrimary?.notes?.slice(0, 140) ?? ""} · IVR~${rec.ivRankProxy}`,
          notes: JSON.stringify({
            apex: true,
            mode,
            structure,
            engine: displayPlans.find((p) => p.structure === structure)?.engine,
            ticket,
            ivRankProxy: rec.ivRankProxy,
            regime: rec.regimeLabel,
          }),
          setupType: `apex_${mode}_${structure.toLowerCase()}`,
          tags: [
            "apex",
            mode,
            structure.toLowerCase(),
            isShortPremium ? "premium" : "debit",
          ],
          analysisJson: JSON.stringify({ apex: rec, ticket, mode }),
        }),
      });
      if (!res.ok) throw new Error("fail");
      setMsg("APEX trade logged");
      onLogged?.();
    } catch {
      setMsg("Log failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium text-sm md:text-base">
            APEX options ·{" "}
            <span
              className="font-semibold"
              style={{
                color:
                  mode === "velocity"
                    ? "var(--kodo-warning)"
                    : "var(--kodo-cyan)",
              }}
            >
              {profileLabel(mode)}
            </span>
            <span className="text-[var(--kodo-ink-muted)] font-normal">
              {" "}
              · {apex.regimeLabel.replaceAll("_", " ")}
            </span>
          </h2>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-0.5">
            Risk {(profile.riskPerTrade * 100).toFixed(1)}%/trade · day{" "}
            {(profile.riskPerDay * 100).toFixed(0)}% · max {profile.maxSatPositions}{" "}
            SAT · IVR~{apex.ivRankProxy}
            {apex.coreEligible ? " · CORE ok" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-full border border-white/10 overflow-hidden text-[11px]">
            <button
              type="button"
              className="px-3 py-1"
              style={{
                background:
                  mode === "compound" ? "rgba(45,226,230,0.2)" : "transparent",
                color:
                  mode === "compound"
                    ? "var(--kodo-cyan)"
                    : "var(--kodo-ink-muted)",
              }}
              onClick={() => setMode("compound")}
            >
              Compound
            </button>
            <button
              type="button"
              className="px-3 py-1"
              style={{
                background:
                  mode === "velocity" ? "rgba(240,180,41,0.2)" : "transparent",
                color:
                  mode === "velocity"
                    ? "var(--kodo-warning)"
                    : "var(--kodo-ink-muted)",
              }}
              onClick={() => setMode("velocity")}
            >
              Velocity
            </button>
          </div>
          {compact && (
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Hide" : "Size ticket"}
            </button>
          )}
        </div>
      </div>

      {mode === "velocity" && (
        <p className="text-[11px] rounded-lg px-3 py-2 border border-[rgba(240,180,41,0.3)] bg-[rgba(240,180,41,0.08)] text-[var(--kodo-warning)]">
          Velocity: higher risk of large drawdowns. Still no 0DTE / naked shorts.
          Switch back to Compound anytime for the slower path.
        </p>
      )}

      {displayPrimary && (
        <div
          className="rounded-xl px-3 py-2 text-sm border"
          style={{
            borderColor:
              mode === "velocity"
                ? "rgba(240,180,41,0.3)"
                : displayPrimary.engine === "SATELLITE"
                  ? "rgba(255,43,214,0.25)"
                  : "rgba(45,226,230,0.25)",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <div className="flex flex-wrap gap-2 items-center mb-1">
            <span
              className="chip mono text-[10px]"
              style={{
                color:
                  mode === "velocity"
                    ? "var(--kodo-warning)"
                    : displayPrimary.engine === "SATELLITE"
                      ? "var(--kodo-magenta)"
                      : "var(--kodo-cyan)",
              }}
            >
              PRIMARY · {displayPrimary.engine}
            </span>
            <strong className="text-sm">
              {shortStructure(displayPrimary.structure)}
            </strong>
            <span className="text-[10px] text-[var(--kodo-ink-muted)] mono">
              P{displayPrimary.priority}
              {displayPrimary.dte
                ? ` · ${displayPrimary.dte[0]}–${displayPrimary.dte[1]} DTE`
                : ""}
            </span>
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] leading-relaxed">
            {displayPrimary.notes}
          </p>
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {displayPlans.slice(0, 6).map((p) => (
            <button
              key={p.structure + p.engine}
              type="button"
              className="chip text-[10px] cursor-pointer"
              style={{
                opacity: structure === p.structure ? 1 : 0.65,
                borderColor:
                  structure === p.structure ? "var(--kodo-cyan)" : undefined,
              }}
              onClick={() => setStructure(p.structure)}
              title={p.notes}
            >
              {p.engine[0]} · {shortStructure(p.structure)}
            </button>
          ))}
        </div>
      )}

      {open && acct && ticket && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <label className="flex flex-col gap-1 text-[var(--kodo-ink-muted)]">
              Equity $
              <input
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[var(--kodo-ink)] mono"
                type="number"
                value={acct.equity}
                onChange={(e) => {
                  setAcct(
                    saveApexAccount({ equity: Number(e.target.value) || 0 })
                  );
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[var(--kodo-ink-muted)]">
              MTD %
              <input
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[var(--kodo-ink)] mono"
                type="number"
                value={acct.mtdReturnPct}
                step={0.1}
                onChange={(e) => {
                  setAcct(
                    saveApexAccount({
                      mtdReturnPct: Number(e.target.value) || 0,
                    })
                  );
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[var(--kodo-ink-muted)]">
              Peak DD %
              <input
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[var(--kodo-ink)] mono"
                type="number"
                value={acct.peakDrawdownPct}
                step={0.1}
                onChange={(e) => {
                  setAcct(
                    saveApexAccount({
                      peakDrawdownPct: Number(e.target.value) || 0,
                    })
                  );
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-[var(--kodo-ink-muted)]">
              Width / credit
              <div className="flex gap-1">
                <input
                  className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[var(--kodo-ink)] mono w-full"
                  type="number"
                  value={acct.defaultSpreadWidth}
                  step={0.5}
                  onChange={(e) => {
                    setAcct(
                      saveApexAccount({
                        defaultSpreadWidth: Number(e.target.value) || 0,
                      })
                    );
                  }}
                />
                <input
                  className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[var(--kodo-ink)] mono w-full"
                  type="number"
                  value={acct.defaultCredit}
                  step={0.05}
                  onChange={(e) => {
                    setAcct(
                      saveApexAccount({
                        defaultCredit: Number(e.target.value) || 0,
                      })
                    );
                  }}
                />
              </div>
            </label>
          </div>

          <pre className="text-[11px] mono leading-relaxed p-3 rounded-xl bg-black/35 border border-white/10 overflow-x-auto text-[var(--kodo-ink-muted)] whitespace-pre-wrap">
            {`Profile: ${ticket.profileName}
Gate: ${ticket.gate.status} (${ticket.gate.mult}×)
${ticket.gate.message}

Structure: ${structureLabel(structure)}
CSP strike hint (CSP only): $${(apex.suggestedCspStrike ?? price * 0.95).toFixed(2)}

SIZE
${JSON.stringify(ticket.size, null, 2)}

• ${ticket.rules.profitTake}
• ${ticket.rules.dte}
• ${ticket.rules.riskCap}
• Freq: ${ticket.rules.frequency}
Banned: ${ticket.rules.banned.join(", ")}`}
          </pre>

          <ul className="text-xs text-[var(--kodo-ink-muted)] space-y-1">
            {ticket.checklist.map((c) => (
              <li key={c}>☐ {c}</li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={busy || ticket.gate.mult === 0}
              onClick={logApex}
            >
              Log APEX trade
            </button>
            <a href="/apex" className="btn btn-ghost text-sm no-underline">
              APEX desk
            </a>
            {msg && (
              <span className="text-xs text-[var(--kodo-cyan)]">{msg}</span>
            )}
          </div>
        </>
      )}

      {compact && !open && apex.notes[0] && (
        <p className="text-[11px] text-[var(--kodo-ink-muted)]">{apex.notes[0]}</p>
      )}
    </div>
  );
}
