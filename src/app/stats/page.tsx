"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Stats = {
  closedCount: number;
  openCount: number;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  totalRealized: number;
  totalUnrealized: number;
  avgR: number | null;
  equityCurve: { date: string; cumulative: number; symbol: string }[];
};

function fmtPct(n: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmt(n: number | null, d = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(d);
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j) => setStats(j.stats))
      .catch(() => null);
  }, []);

  if (!stats) {
    return <div className="glass p-8">Loading stats…</div>;
  }

  const cards = [
    { label: "Win rate", value: fmtPct(stats.winRate) },
    { label: "Expectancy $", value: fmt(stats.expectancy) },
    {
      label: "Profit factor",
      value: stats.profitFactor == null ? "—" : fmt(stats.profitFactor),
    },
    { label: "Avg R", value: stats.avgR == null ? "—" : `${fmt(stats.avgR)}R` },
    { label: "Realized P&L", value: fmt(stats.totalRealized) },
    { label: "Unrealized", value: fmt(stats.totalUnrealized) },
    { label: "Closed", value: String(stats.closedCount) },
    { label: "Open", value: String(stats.openCount) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Performance</h1>
        <p className="text-sm text-[var(--kodo-ink-muted)]">
          CLOSED trades only for win rate / expectancy / profit factor. Cancelled
          excluded.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass p-4">
            <div className="text-xs text-[var(--kodo-ink-muted)]">{c.label}</div>
            <div className="mono text-xl font-semibold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="glass p-4 md:p-6">
        <h2 className="text-sm text-[var(--kodo-ink-muted)] mb-4">
          Equity curve (realized)
        </h2>
        {stats.equityCurve.length === 0 ? (
          <div className="text-[var(--kodo-ink-muted)] text-sm py-12 text-center">
            Close trades to build the curve.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityCurve}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2de2e6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#2de2e6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => String(v).slice(5, 10)}
                  stroke="rgba(232,228,220,0.4)"
                  fontSize={11}
                />
                <YAxis stroke="rgba(232,228,220,0.4)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#161822",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#2de2e6"
                  fill="url(#eq)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
