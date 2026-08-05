"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  compoundPath,
  getProfile,
  pathScenarios,
  profileLabel,
  selectStructure,
  sizeMultiplier,
  structureLabel,
  type ApexProfileId,
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
    setAcct(saveApexAccount(p));
  }

  const mode: ApexProfileId =
    acct.mode === "velocity" ? "velocity" : "compound";
  const profile = getProfile(mode);

  const gate = useMemo(
    () =>
      sizeMultiplier(
        acct.mtdReturnPct / 100,
        acct.peakDrawdownPct / 100,
        mode
      ),
    [acct.mtdReturnPct, acct.peakDrawdownPct, mode]
  );

  const plans = useMemo(
    () =>
      selectStructure({
        regime: regimeLabel,
        ivRank,
        bias,
        confluence,
        profileId: mode,
      }),
    [regimeLabel, ivRank, bias, confluence, mode]
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

  const scenarios = useMemo(
    () => pathScenarios(acct.equity, acct.monthlyAdd),
    [acct.equity, acct.monthlyAdd]
  );

  // Side-by-side timeline at profile planning rates
  const compoundPathCmp = useMemo(
    () =>
      compoundPath(
        acct.equity,
        getProfile("compound").planningMonthlyRate,
        1_000_000,
        acct.monthlyAdd
      ),
    [acct.equity, acct.monthlyAdd]
  );
  const velocityPathCmp = useMemo(
    () =>
      compoundPath(
        acct.equity,
        getProfile("velocity").planningMonthlyRate,
        1_000_000,
        acct.monthlyAdd
      ),
    [acct.equity, acct.monthlyAdd]
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
            APEX · {profileLabel(mode)}
          </h1>
          <p className="text-sm text-[var(--kodo-ink-muted)] mt-1 max-w-xl">
            {profile.tagline}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-full border border-white/15 overflow-hidden text-sm">
            <button
              type="button"
              className="px-4 py-2"
              style={{
                background:
                  mode === "compound" ? "rgba(45,226,230,0.22)" : "transparent",
                color:
                  mode === "compound"
                    ? "var(--kodo-cyan)"
                    : "var(--kodo-ink-muted)",
              }}
              onClick={() => patch({ mode: "compound" })}
            >
              Compound
            </button>
            <button
              type="button"
              className="px-4 py-2 font-semibold"
              style={{
                background:
                  mode === "velocity" ? "rgba(240,180,41,0.22)" : "transparent",
                color:
                  mode === "velocity"
                    ? "var(--kodo-warning)"
                    : "var(--kodo-ink-muted)",
              }}
              onClick={() => patch({ mode: "velocity" })}
            >
              Velocity ⚡
            </button>
          </div>
          <Link href="/scanner" className="btn btn-primary no-underline text-sm">
            Scanner
          </Link>
        </div>
      </div>

      {/* Timeline comparison */}
      <div className="grid md:grid-cols-2 gap-3">
        <div
          className="glass p-4 border"
          style={{
            borderColor:
              mode === "compound"
                ? "rgba(45,226,230,0.35)"
                : "rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[11px] uppercase tracking-wide text-[var(--kodo-cyan)]">
            Compound (keep / play)
          </div>
          <div className="text-2xl font-semibold mt-1">
            ~{compoundPathCmp.years}y
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            Planning ~{getProfile("compound").planningMonthlyRate * 100}%/mo net
            · 1% risk/trade · 25% SAT · max 4 open
          </p>
        </div>
        <div
          className="glass p-4 border"
          style={{
            borderColor:
              mode === "velocity"
                ? "rgba(240,180,41,0.4)"
                : "rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-[11px] uppercase tracking-wide text-[var(--kodo-warning)]">
            Velocity (aggressive)
          </div>
          <div className="text-2xl font-semibold mt-1 text-[var(--kodo-warning)]">
            ~{velocityPathCmp.years}y
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            Planning ~{getProfile("velocity").planningMonthlyRate * 100}%/mo net
            · 2.5% risk/trade · 60% SAT · max 6 open · shorter DTE
          </p>
        </div>
      </div>

      {mode === "velocity" && (
        <div className="glass p-4 text-sm border border-[rgba(240,180,41,0.35)] bg-[rgba(240,180,41,0.06)] space-y-2">
          <h2 className="font-medium text-[var(--kodo-warning)]">
            Velocity rules (your aggressive book)
          </h2>
          <ul className="text-xs text-[var(--kodo-ink-muted)] space-y-1 list-disc pl-4">
            <li>
              <strong className="text-[var(--kodo-ink)]">2.5% risk</strong> per
              SAT trade ($2,500 on $100k) — SHOP debit $2.35 → about{" "}
              <strong className="text-[var(--kodo-ink)]">10 contracts</strong>{" "}
              (not 4)
            </li>
            <li>
              Up to <strong className="text-[var(--kodo-ink)]">3 new SAT/day</strong>,{" "}
              <strong className="text-[var(--kodo-ink)]">5–10/week</strong>, max{" "}
              <strong className="text-[var(--kodo-ink)]">6 open</strong>
            </li>
            <li>
              Allocation: <strong className="text-[var(--kodo-ink)]">60% SAT</strong> / 35%
              CORE Wheel / 5% cash — lean directional
            </li>
            <li>
              DTE: credits <strong className="text-[var(--kodo-ink)]">14–35</strong>,
              debits <strong className="text-[var(--kodo-ink)]">21–45</strong> — still{" "}
              <strong className="text-[var(--kodo-ink)]">no 0DTE</strong>
            </li>
            <li>
              Take profits faster ({profile.profitTakePct * 100}% on short premium);
              kill switch at −18% MTD or −30% peak
            </li>
            <li>
              Prefer debit ≤ ~45% of width when possible (better than 1:1 R:R)
            </li>
          </ul>
          <p className="text-[11px] text-[var(--kodo-warning)]">
            Hitting 5–6%/mo net is hard and many accounts fail trying. Compound
            stays one click away.
          </p>
        </div>
      )}

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
            SAT risk / trade
          </div>
          <div
            className="text-xl font-semibold mt-1 mono"
            style={{
              color:
                mode === "velocity"
                  ? "var(--kodo-warning)"
                  : "var(--kodo-cyan)",
            }}
          >
            $
            {(
              acct.equity *
              profile.riskPerTrade *
              gate.mult
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-[var(--kodo-ink-muted)] mt-1">
            {(profile.riskPerTrade * 100).toFixed(1)}% · day cap $
            {(
              acct.equity *
              profile.riskPerDay *
              gate.mult
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="glass p-4">
          <div className="text-[11px] text-[var(--kodo-ink-muted)] uppercase tracking-wide">
            Your path (slider rate)
          </div>
          <div
            className="text-xl font-semibold mt-1"
            style={{
              color: path.hit ? "var(--kodo-success)" : "var(--kodo-warning)",
            }}
          >
            {path.hit ? `${path.years}y` : "—"}
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
          <h2 className="font-medium">Structure lab ({profileLabel(mode)})</h2>
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

      <div className="glass p-5">
        <h2 className="font-medium mb-2">$1M scenarios (your equity + deposits)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-[var(--kodo-ink-muted)] uppercase">
              <th className="py-2">Mo. return</th>
              <th>Years</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr
                key={s.monthlyPct}
                className="border-t border-white/5 mono text-xs"
              >
                <td className="py-2">{s.monthlyPct.toFixed(0)}%</td>
                <td>{s.hit ? `${s.years}y` : ">50y"}</td>
                <td className="text-[var(--kodo-ink-muted)]">
                  {s.monthlyPct <= 3
                    ? "Compound band"
                    : s.monthlyPct <= 6
                      ? "Velocity planning band"
                      : "Extreme — rare to sustain"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass p-5 space-y-2 text-sm text-[var(--kodo-ink-muted)]">
        <h2 className="font-medium text-[var(--kodo-ink)]">How to use both</h2>
        <ol className="list-decimal pl-5 space-y-1 text-xs">
          <li>
            Leave <strong className="text-[var(--kodo-ink)]">Compound</strong> as
            the default when learning or after a rough stretch.
          </li>
          <li>
            Switch to <strong className="text-[var(--kodo-warning)]">Velocity</strong>{" "}
            when you want larger size + more SAT frequency; tickets and chips follow.
          </li>
          <li>
            Scanner still needs confluence — Velocity does not mean “force trades.”
          </li>
          <li>
            Journal tags include <span className="mono">compound</span> or{" "}
            <span className="mono">velocity</span> so you can compare results later.
          </li>
        </ol>
      </div>
    </div>
  );
}
