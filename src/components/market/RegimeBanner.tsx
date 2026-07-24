"use client";

import { useEffect, useState } from "react";
import type { MarketRegime } from "@/types";

const labelColor: Record<string, string> = {
  STRONG_TREND_UP: "var(--kodo-cyan)",
  TREND_UP: "var(--kodo-success)",
  RANGE: "var(--kodo-warning)",
  TREND_DOWN: "var(--kodo-magenta)",
  STRONG_TREND_DOWN: "var(--kodo-danger)",
  HIGH_VOLATILITY: "var(--kodo-seal)",
  UNKNOWN: "var(--kodo-ink-muted)",
};

export function RegimeBanner() {
  const [regime, setRegime] = useState<MarketRegime | null>(null);

  useEffect(() => {
    fetch("/api/regime")
      .then((r) => r.json())
      .then((j) => setRegime(j.regime))
      .catch(() => null);
  }, []);

  if (!regime) {
    return (
      <div className="glass p-4 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="glass p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--kodo-ink-muted)] mb-1">
            Market regime
          </div>
          <div
            className="text-2xl font-semibold tracking-wide"
            style={{ color: labelColor[regime.label] ?? "var(--kodo-ink)" }}
          >
            {regime.label.replaceAll("_", " ")}
          </div>
          <div className="mt-2 text-sm text-[var(--kodo-ink-muted)] flex flex-wrap gap-3">
            <span>
              SPY {regime.spyTrend} · QQQ {regime.qqqTrend}
            </span>
            <span className="mono">
              ADX {regime.adxSpy?.toFixed(1) ?? "—"}
            </span>
            <span className="mono">
              VIX {regime.vixLevel?.toFixed(1) ?? "—"} ({regime.vixContext})
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-[var(--kodo-ink-muted)] space-y-1">
          <div>
            Leaders:{" "}
            {regime.sectorLeaders.map((s) => s.symbol).join(" · ") || "—"}
          </div>
          <div>
            Laggards:{" "}
            {regime.sectorLaggards.map((s) => s.symbol).join(" · ") || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
