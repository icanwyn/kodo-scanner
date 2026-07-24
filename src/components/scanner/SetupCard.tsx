"use client";

import Link from "next/link";
import type { ScoredSetup } from "@/types";
import { ScoreRing } from "./ScoreRing";
import { useState } from "react";
import { saveSetupSnapshot } from "@/lib/scan/session";

export function SetupCard({
  setup,
  onLogged,
}: {
  setup: ScoredSetup;
  onLogged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const up = setup.changePct >= 0;
  const sideColor =
    setup.sideBias === "long"
      ? "var(--kodo-cyan)"
      : setup.sideBias === "short"
        ? "var(--kodo-magenta)"
        : "var(--kodo-ink-muted)";

  function rememberSetup() {
    saveSetupSnapshot(setup);
  }

  async function star() {
    setBusy(true);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: setup.symbol }),
      });
      setMsg("Watchlisted");
    } finally {
      setBusy(false);
    }
  }

  async function logTrade() {
    setBusy(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: setup.symbol,
          side: setup.sideBias === "short" ? "SHORT" : "LONG",
          quantity: 10,
          entryPrice: setup.price,
          stopPrice:
            setup.sideBias === "short"
              ? setup.price * 1.02
              : setup.price * 0.98,
          thesisSummary: `Scanner confluence ${setup.confluenceScore.toFixed(1)} · ${setup.sideBias}`,
          scanFactorsJson: JSON.stringify(setup.factors),
          setupType: "scanner_confluence",
          entryAttribution: JSON.stringify(setup.attribution),
        }),
      });
      if (!res.ok) throw new Error("log failed");
      setMsg("Trade logged");
      onLogged?.();
    } catch {
      setMsg("Log failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="glass p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/analysis/${setup.symbol}?from=scanner`}
              onClick={rememberSetup}
              className="text-lg font-semibold tracking-wide no-underline hover:text-[var(--kodo-cyan)] transition-colors"
            >
              {setup.symbol}
            </Link>
            <span
              className="chip mono uppercase"
              style={{ color: sideColor, borderColor: sideColor }}
            >
              {setup.sideBias}
            </span>
          </div>
          <div className="mono text-sm mt-1">
            ${setup.price.toFixed(2)}{" "}
            <span
              style={{ color: up ? "var(--kodo-success)" : "var(--kodo-danger)" }}
            >
              {up ? "+" : ""}
              {setup.changePct.toFixed(2)}%
            </span>
            {setup.relativeVolume != null && (
              <span className="text-[var(--kodo-ink-muted)] ml-2">
                RVOL {setup.relativeVolume.toFixed(2)}×
              </span>
            )}
          </div>
        </div>
        <ScoreRing score={setup.confluenceScore} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {setup.factors.map((f) => (
          <span
            key={f.id}
            className={`chip ${f.passed ? "pass" : "fail"}`}
            title={f.detail}
          >
            {f.name.split(" ")[0]} {f.score.toFixed(0)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-auto pt-1">
        <Link
          href={`/analysis/${setup.symbol}?from=scanner`}
          onClick={rememberSetup}
          className="btn btn-primary no-underline"
        >
          Deep analysis
        </Link>
        <button className="btn btn-ghost" disabled={busy} onClick={logTrade}>
          Log trade
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={star}>
          ★ Watch
        </button>
        {msg && (
          <span className="text-xs self-center text-[var(--kodo-cyan)]">
            {msg}
          </span>
        )}
      </div>
    </article>
  );
}
