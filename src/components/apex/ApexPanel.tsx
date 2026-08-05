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
  type ContractSize,
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

function money(n: number, digits = 0) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  });
}

function resolvePrimary(apex: ApexRecommendation, mode: ApexProfileId) {
  if (mode === "velocity" && apex.velocityPrimary) {
    return {
      primary: apex.velocityPrimary,
      plans: apex.velocityPlans?.length ? apex.velocityPlans : apex.plans,
    };
  }
  return { primary: apex.primary, plans: apex.plans };
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--kodo-ink-muted)]">
        {label}
      </div>
      <div
        className="text-xl md:text-2xl font-semibold mono mt-1 tabular-nums leading-none"
        style={{ color: accent ?? "var(--kodo-ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-[var(--kodo-ink-muted)] mt-1.5 leading-snug">
          {sub}
        </div>
      )}
    </div>
  );
}

function RulePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-[var(--kodo-ink-muted)]">
      {children}
    </span>
  );
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
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAcct(loadApexAccount());
  }, []);

  const mode: ApexProfileId =
    acct?.mode === "velocity" ? "velocity" : "compound";
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

  const sizeInfo = useMemo(() => {
    if (!ticket || !acct) return null;
    const raw = ticket.size as ContractSize & { contracts?: number | string };
    const isCsp = structure === "CASH_SECURED_PUT";
    const isCc = structure === "COVERED_CALL";
    const isCredit = structure.includes("CREDIT");
    const isDebit = structure.includes("DEBIT");
    const width = acct.defaultSpreadWidth;
    const debitOrCredit = acct.defaultCredit;
    const contractsNum =
      typeof raw.contracts === "number" ? raw.contracts : null;

    let maxGainPer = 0;
    let maxLossPer = 0;
    if (isDebit) {
      maxLossPer = debitOrCredit;
      maxGainPer = Math.max(0, width - debitOrCredit);
    } else if (isCredit) {
      maxGainPer = debitOrCredit;
      maxLossPer = Math.max(0.01, width - debitOrCredit);
    }

    return {
      isCsp,
      isCc,
      isCredit,
      isDebit,
      contractsNum,
      contractsLabel:
        contractsNum != null
          ? String(contractsNum)
          : String(raw.contracts ?? "—"),
      riskDollars: raw.riskDollars ?? (raw.cashNeeded ?? 0),
      riskPct: raw.riskPct ?? 0,
      perContract: raw.perContract,
      reason: raw.reason,
      maxGainTotal:
        contractsNum != null && maxGainPer > 0
          ? contractsNum * maxGainPer * 100
          : null,
      maxLossTotal:
        contractsNum != null && maxLossPer > 0
          ? contractsNum * maxLossPer * 100
          : raw.riskDollars ?? null,
      width,
      debitOrCredit,
      rr:
        maxLossPer > 0 && maxGainPer > 0
          ? maxGainPer / maxLossPer
          : null,
    };
  }, [ticket, acct, structure]);

  if (!apex || !resolved) {
    return (
      <div className="glass p-4 text-sm text-[var(--kodo-ink-muted)]">
        APEX plans attach after a scan or analysis with regime context.
      </div>
    );
  }

  const displayPrimary = resolved.primary;
  const displayPlans = resolved.plans;
  const accent =
    mode === "velocity" ? "var(--kodo-warning)" : "var(--kodo-cyan)";
  const gateColor =
    ticket?.gate.status === "KILL_SWITCH"
      ? "var(--kodo-danger)"
      : ticket?.gate.status === "HALF_SIZE"
        ? "var(--kodo-warning)"
        : "var(--kodo-success)";

  function setMode(next: ApexProfileId) {
    setAcct(saveApexAccount({ mode: next }));
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
            engine: displayPlans.find((p) => p.structure === structure)
              ?.engine,
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
      setMsg("Logged to journal");
      onLogged?.();
    } catch {
      setMsg("Log failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-base tracking-tight">
              {symbol}
              <span className="text-[var(--kodo-ink-muted)] font-normal">
                {" "}
                · APEX
              </span>
            </h2>
            <span
              className="chip mono text-[10px] font-semibold"
              style={{ color: accent, borderColor: accent }}
            >
              {profileLabel(mode)}
            </span>
            {ticket && (
              <span
                className="chip mono text-[10px]"
                style={{ color: gateColor, borderColor: gateColor }}
              >
                {ticket.gate.status.replaceAll("_", " ")} · {ticket.gate.mult}×
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            {apex.regimeLabel.replaceAll("_", " ")} · IVR ~{apex.ivRankProxy}
            {apex.coreEligible ? " · CORE universe" : " · SAT focus"}
            {" · "}
            {money(price, 2)} spot
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center shrink-0">
          <div className="flex rounded-full border border-white/10 overflow-hidden text-[11px] font-medium">
            <button
              type="button"
              className="px-3 py-1.5 transition-colors"
              style={{
                background:
                  mode === "compound" ? "rgba(45,226,230,0.18)" : "transparent",
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
              className="px-3 py-1.5 transition-colors"
              style={{
                background:
                  mode === "velocity" ? "rgba(240,180,41,0.18)" : "transparent",
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
              {open ? "Hide size" : "Size ticket"}
            </button>
          )}
        </div>
      </div>

      {mode === "velocity" && (
        <p className="text-[11px] rounded-xl px-3 py-2 border border-[rgba(240,180,41,0.28)] bg-[rgba(240,180,41,0.07)] text-[var(--kodo-warning)] leading-relaxed">
          Velocity = larger size &amp; faster path. Higher drawdown risk. No
          0DTE / naked shorts.
        </p>
      )}

      {/* Primary plan */}
      {displayPrimary && (
        <div
          className="rounded-2xl px-4 py-3 border"
          style={{
            borderColor:
              mode === "velocity"
                ? "rgba(240,180,41,0.28)"
                : displayPrimary.engine === "SATELLITE"
                  ? "rgba(255,43,214,0.22)"
                  : "rgba(45,226,230,0.22)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))",
          }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: accent }}
            >
              Play
            </span>
            <span className="text-base font-semibold">
              {shortStructure(displayPrimary.structure)}
            </span>
            <span className="chip mono text-[10px]">
              {displayPrimary.engine}
            </span>
            {displayPrimary.dte && (
              <span className="text-[11px] mono text-[var(--kodo-ink-muted)]">
                {displayPrimary.dte[0]}–{displayPrimary.dte[1]} DTE
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] leading-relaxed">
            {displayPrimary.notes}
          </p>
        </div>
      )}

      {/* Structure picker */}
      <div className="flex flex-wrap gap-1.5">
        {displayPlans
          .filter((p) => p.structure !== "SKIP_OR_IRON_CONDOR_ADVANCED")
          .slice(0, 6)
          .map((p) => {
            const active = structure === p.structure;
            return (
              <button
                key={p.structure + p.engine}
                type="button"
                className="rounded-full px-3 py-1.5 text-[11px] font-medium border transition-all"
                style={{
                  borderColor: active ? accent : "rgba(255,255,255,0.1)",
                  background: active
                    ? mode === "velocity"
                      ? "rgba(240,180,41,0.12)"
                      : "rgba(45,226,230,0.12)"
                    : "rgba(0,0,0,0.2)",
                  color: active ? accent : "var(--kodo-ink-muted)",
                }}
                onClick={() => setStructure(p.structure)}
                title={p.notes}
              >
                {shortStructure(p.structure)}
              </button>
            );
          })}
      </div>

      {open && acct && ticket && sizeInfo && (
        <div className="space-y-4">
          {/* Inputs */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 md:p-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--kodo-ink-muted)] mb-3">
              Account & spread inputs
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {(
                [
                  ["equity", "Equity $", acct.equity, 1000],
                  ["mtdReturnPct", "MTD %", acct.mtdReturnPct, 0.1],
                  ["peakDrawdownPct", "Peak DD %", acct.peakDrawdownPct, 0.1],
                  [
                    "defaultSpreadWidth",
                    "Width $",
                    acct.defaultSpreadWidth,
                    0.5,
                  ],
                  ["defaultCredit", "Debit / credit $", acct.defaultCredit, 0.05],
                ] as const
              ).map(([key, label, val, step]) => (
                <label
                  key={key}
                  className="flex flex-col gap-1.5 text-[var(--kodo-ink-muted)]"
                >
                  <span className="text-[10px] uppercase tracking-wide">
                    {label}
                  </span>
                  <input
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[var(--kodo-ink)] mono text-sm focus:outline-none focus:border-[var(--kodo-cyan)]/50"
                    type="number"
                    step={step}
                    value={val}
                    onChange={(e) => {
                      setAcct(
                        saveApexAccount({
                          [key]: Number(e.target.value) || 0,
                        })
                      );
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Big size readout */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard
              label="Contracts"
              value={sizeInfo.contractsLabel}
              sub={
                sizeInfo.contractsNum != null && sizeInfo.contractsNum > 0
                  ? `${sizeInfo.contractsNum * 100} shares equivalent`
                  : sizeInfo.reason
              }
              accent={accent}
            />
            <StatCard
              label="Max risk"
              value={
                sizeInfo.maxLossTotal != null
                  ? money(sizeInfo.maxLossTotal)
                  : money(sizeInfo.riskDollars)
              }
              sub={`${(sizeInfo.riskPct * 100 || profile.riskPerTrade * 100 * ticket.gate.mult).toFixed(1)}% of equity · cap ${(profile.riskPerTrade * 100).toFixed(1)}%`}
              accent="var(--kodo-danger)"
            />
            <StatCard
              label="Max gain"
              value={
                sizeInfo.maxGainTotal != null
                  ? money(sizeInfo.maxGainTotal)
                  : sizeInfo.isCc
                    ? "Call premium"
                    : "—"
              }
              sub={
                sizeInfo.rr != null
                  ? `~${sizeInfo.rr.toFixed(2)} : 1 max R:R`
                  : sizeInfo.isCsp
                    ? "Premium collected"
                    : ticket.rules.profitTake
              }
              accent="var(--kodo-success)"
            />
            <StatCard
              label="DTE window"
              value={
                sizeInfo.isDebit
                  ? `${profile.dteSatDebit[0]}–${profile.dteSatDebit[1]}`
                  : sizeInfo.isCredit
                    ? `${profile.dteSatCredit[0]}–${profile.dteSatCredit[1]}`
                    : `${profile.dteCore[0]}–${profile.dteCore[1]}`
              }
              sub={ticket.rules.dte}
            />
          </div>

          {/* Plain-English play card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-black/30 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--kodo-ink-muted)]">
              Your ticket · {shortStructure(structure)}
            </div>
            <p className="text-sm leading-relaxed">
              {sizeInfo.isDebit && sizeInfo.contractsNum != null && (
                <>
                  Buy{" "}
                  <strong className="text-[var(--kodo-ink)]">
                    {sizeInfo.contractsNum}
                  </strong>{" "}
                  {symbol} call debit spread
                  {sizeInfo.width > 0 && (
                    <>
                      {" "}
                      (~${sizeInfo.width} wide) at about{" "}
                      <strong className="mono">{money(sizeInfo.debitOrCredit, 2)}</strong>{" "}
                      debit
                    </>
                  )}
                  . Risk about{" "}
                  <strong className="text-[var(--kodo-danger)]">
                    {money(sizeInfo.maxLossTotal ?? 0)}
                  </strong>
                  {sizeInfo.maxGainTotal != null && (
                    <>
                      ; max gain about{" "}
                      <strong className="text-[var(--kodo-success)]">
                        {money(sizeInfo.maxGainTotal)}
                      </strong>
                    </>
                  )}
                  . Use{" "}
                  <strong>
                    {profile.dteSatDebit[0]}–{profile.dteSatDebit[1]} DTE
                  </strong>
                  .
                </>
              )}
              {sizeInfo.isCredit && sizeInfo.contractsNum != null && (
                <>
                  Sell{" "}
                  <strong>{sizeInfo.contractsNum}</strong> {symbol} credit
                  spread (~${sizeInfo.width} wide) for about{" "}
                  <strong className="mono">{money(sizeInfo.debitOrCredit, 2)}</strong>{" "}
                  credit. Max loss{" "}
                  <strong className="text-[var(--kodo-danger)]">
                    {money(sizeInfo.maxLossTotal ?? 0)}
                  </strong>
                  . Close at{" "}
                  <strong>{profile.profitTakePct * 100}%</strong> of max profit.
                </>
              )}
              {sizeInfo.isCsp && (
                <>
                  Sell cash-secured put
                  {sizeInfo.contractsNum != null && (
                    <>
                      {" "}
                      × <strong>{sizeInfo.contractsNum}</strong>
                    </>
                  )}{" "}
                  near{" "}
                  <strong className="mono">
                    {money(apex.suggestedCspStrike ?? price * 0.95, 2)}
                  </strong>{" "}
                  (hint only — pick Δ {profile.cspDelta[0]}–{profile.cspDelta[1]}{" "}
                  on the chain). Cash reserve ≈{" "}
                  <strong>
                    {money(
                      (apex.suggestedCspStrike ?? price * 0.95) *
                        100 *
                        (sizeInfo.contractsNum ?? 0)
                    )}
                  </strong>
                  .
                </>
              )}
              {sizeInfo.isCc && (
                <>
                  Sell covered calls against shares you hold — 1 call per 100
                  shares, Δ {profile.cspDelta[0]}–{profile.cspDelta[1]}, close at{" "}
                  {profile.profitTakePct * 100}% profit.
                </>
              )}
            </p>

            {/* Only show CSP hint for CSP */}
            {sizeInfo.isCsp && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                <RulePill>
                  CSP strike hint{" "}
                  <span className="mono text-[var(--kodo-ink)] ml-1">
                    {money(apex.suggestedCspStrike ?? price * 0.95, 2)}
                  </span>
                </RulePill>
              </div>
            )}

            {sizeInfo.reason && sizeInfo.reason !== "OK" && (
              <p className="text-xs text-[var(--kodo-warning)]">
                {sizeInfo.reason}
              </p>
            )}
          </div>

          {/* Limits row */}
          <div className="flex flex-wrap gap-2">
            <RulePill>
              Risk/trade{" "}
              <span className="text-[var(--kodo-ink)] mono ml-1">
                {(profile.riskPerTrade * 100).toFixed(1)}%
              </span>
            </RulePill>
            <RulePill>
              Day cap{" "}
              <span className="text-[var(--kodo-ink)] mono ml-1">
                {(profile.riskPerDay * 100).toFixed(0)}%
              </span>
            </RulePill>
            <RulePill>
              Max open SAT{" "}
              <span className="text-[var(--kodo-ink)] mono ml-1">
                {profile.maxSatPositions}
              </span>
            </RulePill>
            <RulePill>
              New SAT/day{" "}
              <span className="text-[var(--kodo-ink)] mono ml-1">
                ≤{profile.maxNewSatPerDay}
              </span>
            </RulePill>
            <RulePill>
              Week pace{" "}
              <span className="text-[var(--kodo-ink)] mono ml-1">
                {profile.targetSatPerWeek[0]}–{profile.targetSatPerWeek[1]}
              </span>
            </RulePill>
            <RulePill>
              Take profit{" "}
              <span className="text-[var(--kodo-ink)] mono ml-1">
                {profile.profitTakePct * 100}%
              </span>
            </RulePill>
          </div>

          {/* Banned */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--kodo-ink-muted)] mb-2">
              Not allowed
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ticket.rules.banned.map((b) => (
                <span
                  key={b}
                  className="rounded-md px-2 py-1 text-[10px] border border-[rgba(255,77,109,0.25)] bg-[rgba(255,77,109,0.08)] text-[var(--kodo-danger)]"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--kodo-ink-muted)] mb-2">
              Before you send
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ticket.checklist.map((c) => (
                <label
                  key={c}
                  className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs cursor-pointer hover:border-white/20 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--kodo-cyan)]"
                    checked={Boolean(checks[c])}
                    onChange={(e) =>
                      setChecks((prev) => ({ ...prev, [c]: e.target.checked }))
                    }
                  />
                  <span
                    className={
                      checks[c]
                        ? "text-[var(--kodo-ink-muted)] line-through"
                        : "text-[var(--kodo-ink)]"
                    }
                  >
                    {c}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 items-center pt-1">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={busy || ticket.gate.mult === 0}
              onClick={logApex}
            >
              {busy ? "Logging…" : "Log to journal"}
            </button>
            <a href="/apex" className="btn btn-ghost text-sm no-underline">
              Full APEX desk
            </a>
            {msg && (
              <span
                className="text-xs"
                style={{
                  color: msg.includes("fail")
                    ? "var(--kodo-danger)"
                    : "var(--kodo-success)",
                }}
              >
                {msg}
              </span>
            )}
          </div>
        </div>
      )}

      {compact && !open && (
        <p className="text-[11px] text-[var(--kodo-ink-muted)]">
          {displayPrimary
            ? `${shortStructure(displayPrimary.structure)} · tap Size ticket for contracts`
            : apex.notes[0]}
        </p>
      )}
    </div>
  );
}
