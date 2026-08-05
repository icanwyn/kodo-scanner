"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  APEX,
  compoundPath,
  selectStructure,
  sizeMultiplier,
  structureLabel,
  type ApexStructure,
} from "@/lib/apex/engine";
import {
  DEFAULT_APEX_ACCOUNT,
  loadApexAccount,
  saveApexAccount,
  type ApexAccountPrefs,
} from "@/lib/apex/account";
import type { MarketRegime, MarketRegimeLabel } from "@/types";

export default function ApexPage() {
  const [acct, setAcct] = useState<ApexAccountPrefs>(DEFAULT_APEX_ACCOUNT);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const [regimeLabel, setRegimeLabel] =
    useState<MarketRegimeLabel>("TREND_UP");
  const [ivRank, setIvRank] = useState(35);
  const [bias, setBias] = useState<"long" | "short" | "neutral">("long");
  const [confluence, setConfluence] = useState(72);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAcct(loadApexAccount());
    setHydrated(true);
    fetch("/api/regime")
      .then((r) => r.json())
      .then((j) => {
        const reg = (j.regime ?? j) as MarketRegime;
        if (reg?.label) {
          setRegime(reg);
          setRegimeLabel(reg.label);
          if (reg.vixLevel != null) {
            // rough IVR from VIX for display defaults
            const v = reg.vixLevel;
            if (v < 15) setIvRank(18);
            else if (v < 20) setIvRank(32);
            else if (v < 25) setIvRank(48);
            else if (v < 30) setIvRank(60);
            else setIvRank(75);
          }
        }
      })
      .catch(() => null);
  }, []);

  function patch(p: Partial<ApexAccountPrefs>) {
    const next = saveApexAccount(p);
    setAcct(next);
  }

  const gate = useMemo(
    () =>
      sizeMultiplier(acct.mtdReturnPct / 100, acct.peakDrawdownPct / 100),
    [acct.mtdReturnPct, acct.peakDrawdownPct]
  );

  const plans = useMemo(
    () =>
      selectStructure({
        regime: regimeLabel,
        ivRank,
        bias,
        confluence,
      }),
    [regimeLabel, ivRank, bias, confluence]
  );

  const path = useMemo(
    () =>
      compoundPath(
        acct.equity,
        acct.monthlyRatePct / 100,
        1_000_000,
        acct.monthlyAdd
      ),
    [acct.equity, acct.monthlyRatePct, acct.monthlyAdd]
  );

  if (!hydrated) {
    return (
      <div className="glass p-8 text-[var(--kodo-ink-muted)]">Loading APEX…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            APEX Compound
          </h1>
          <p className="text-sm text-[var(--kodo-ink-muted)] mt-1 max-w-xl">
            Options desk inside Kōdō — 70% Wheel CORE + 25% defined-risk SAT.
            Scanner cards and analysis pages attach structures automatically.
            Account prefs stay in this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/scanner" className="btn btn-primary no-underline text-sm">
            Open scanner
          </Link>
          <span className="chip mono text-[10px]">v{APEX.version}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="glass p-4">
          <div className="text-[11px] text-[var(--kodo-ink-muted)] uppercase tracking-wide">
            Size gate
          </div>
          <div
            className="text-xl font-semibold mt-1"
            style={{
              color:
                gate.mult === 0
                  ? "var(--kodo-danger)"
                  : gate.mult < 1
                    ? "var(--kodo-warning)"
                    : "var(--kodo-success)",
            }}
          >
            {gate.status.replaceAll("_", " ")} · {gate.mult}×
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            {gate.message}
          </p>
        </div>
        <div className="glass p-4">
          <div className="text-[11px] text-[var(--kodo-ink-muted)] uppercase tracking-wide">
            CORE budget (70%)
          </div>
          <div className="text-xl font-semibold mt-1 mono text-[var(--kodo-cyan)]">
            $
            {(acct.equity * APEX.coreAlloc * gate.mult).toLocaleString(
              undefined,
              { maximumFractionDigits: 0 }
            )}
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            1% SAT risk $
            {(acct.equity * APEX.riskPerTrade * gate.mult).toLocaleString(
              undefined,
              { maximumFractionDigits: 0 }
            )}
          </p>
        </div>
        <div className="glass p-4">
          <div className="text-[11px] text-[var(--kodo-ink-muted)] uppercase tracking-wide">
            Path to $1M
          </div>
          <div
            className="text-xl font-semibold mt-1"
            style={{
              color: path.hit ? "var(--kodo-success)" : "var(--kodo-warning)",
            }}
          >
            {path.hit ? `${path.years} years` : "—"}
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            @ {acct.monthlyRatePct}%/mo
            {acct.monthlyAdd > 0
              ? ` + $${acct.monthlyAdd.toLocaleString()}/mo`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass p-5 space-y-3">
          <h2 className="font-medium">Account (local)</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["equity", "Equity $", acct.equity, 1000],
                ["mtdReturnPct", "MTD return %", acct.mtdReturnPct, 0.1],
                ["peakDrawdownPct", "Peak DD %", acct.peakDrawdownPct, 0.1],
                ["cashUsedCore", "CORE cash used $", acct.cashUsedCore, 100],
                ["monthlyAdd", "Monthly deposit $", acct.monthlyAdd, 100],
                ["monthlyRatePct", "Assumed mo. %", acct.monthlyRatePct, 0.1],
                [
                  "defaultSpreadWidth",
                  "Default spread width",
                  acct.defaultSpreadWidth,
                  0.5,
                ],
                [
                  "defaultCredit",
                  "Default credit/debit",
                  acct.defaultCredit,
                  0.05,
                ],
              ] as const
            ).map(([key, label, val, step]) => (
              <label
                key={key}
                className="flex flex-col gap-1 text-[var(--kodo-ink-muted)] text-xs"
              >
                {label}
                <input
                  type="number"
                  step={step}
                  className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[var(--kodo-ink)] mono text-sm"
                  value={val}
                  onChange={(e) =>
                    patch({ [key]: Number(e.target.value) || 0 })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="glass p-5 space-y-3">
          <h2 className="font-medium">Structure lab</h2>
          <p className="text-xs text-[var(--kodo-ink-muted)]">
            Live regime:{" "}
            <span className="mono text-[var(--kodo-cyan)]">
              {regime?.label ?? "loading…"}
            </span>
            {regime?.vixLevel != null && (
              <> · VIX {regime.vixLevel.toFixed(1)}</>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1 text-xs text-[var(--kodo-ink-muted)]">
              Regime
              <select
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[var(--kodo-ink)]"
                value={regimeLabel}
                onChange={(e) =>
                  setRegimeLabel(e.target.value as MarketRegimeLabel)
                }
              >
                {(
                  [
                    "STRONG_TREND_UP",
                    "TREND_UP",
                    "RANGE",
                    "TREND_DOWN",
                    "STRONG_TREND_DOWN",
                    "HIGH_VOLATILITY",
                    "UNKNOWN",
                  ] as MarketRegimeLabel[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--kodo-ink-muted)]">
              IV Rank
              <input
                type="number"
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[var(--kodo-ink)] mono"
                value={ivRank}
                onChange={(e) => setIvRank(Number(e.target.value) || 0)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--kodo-ink-muted)]">
              Bias
              <select
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[var(--kodo-ink)]"
                value={bias}
                onChange={(e) =>
                  setBias(e.target.value as "long" | "short" | "neutral")
                }
              >
                <option value="long">long</option>
                <option value="neutral">neutral</option>
                <option value="short">short</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--kodo-ink-muted)]">
              Confluence
              <input
                type="number"
                className="bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[var(--kodo-ink)] mono"
                value={confluence}
                onChange={(e) => setConfluence(Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {plans.map((p) => (
              <div
                key={p.engine + p.structure}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <span
                    className="chip mono text-[10px]"
                    style={{
                      color:
                        p.engine === "CORE"
                          ? "var(--kodo-cyan)"
                          : "var(--kodo-magenta)",
                    }}
                  >
                    {p.engine} · P{p.priority}
                  </span>
                  <strong>
                    {structureLabel(p.structure as ApexStructure)}
                  </strong>
                  <span className="text-[var(--kodo-ink-muted)] mono">
                    size {p.sizeHint}×
                  </span>
                </div>
                <p className="text-[11px] text-[var(--kodo-ink-muted)] mt-1 leading-relaxed">
                  {p.notes}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass p-5 space-y-2 text-sm text-[var(--kodo-ink-muted)]">
        <h2 className="font-medium text-[var(--kodo-ink)]">How it wires in</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Run <Link href="/scanner">Scanner</Link> — each card gets an APEX
            primary structure from regime + confluence + side bias.
          </li>
          <li>
            Open <strong>APEX size</strong> on a card or deep analysis for
            contract sizing against your equity &amp; DD gates.
          </li>
          <li>
            <strong>Log APEX trade</strong> writes to the same journal with{" "}
            <span className="mono">setupType: apex_…</span> tags.
          </li>
          <li>
            Grok deep analysis receives the APEX plan so theses stay structure-aware.
          </li>
        </ol>
        <p className="text-xs pt-2">
          Not financial advice. No 0DTE. Max SAT risk 1% equity. Kill switch at
          −12% MTD or −20% peak. IV Rank on scans is proxied from VIX until
          option-chain IVR is available.
        </p>
      </div>
    </div>
  );
}
