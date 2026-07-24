"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { realizedPnl, rMultiple, type Side } from "@/lib/journal/pnl";

type Trade = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  status: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  stopAtEntry: number | null;
  fees: number;
  openedAt: string;
  closedAt: string | null;
  thesisSummary: string | null;
  postmortem?: { id: string } | null;
};

export default function JournalPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState("all");

  async function load() {
    const res = await fetch("/api/trades");
    const json = await res.json();
    setTrades(json.trades ?? []);
  }

  useEffect(() => {
    load().catch(() => null);
  }, []);

  async function closeTrade(id: string) {
    const exitPrice = prompt("Exit price?");
    if (!exitPrice) return;
    await fetch(`/api/trades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", exitPrice: Number(exitPrice) }),
    });
    await load();
  }

  async function cancelTrade(id: string) {
    if (!confirm("Cancel this open idea (excluded from stats)?")) return;
    await fetch(`/api/trades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    await load();
  }

  const filtered = trades.filter((t) =>
    filter === "all" ? true : t.status === filter.toUpperCase()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trade journal</h1>
          <p className="text-sm text-[var(--kodo-ink-muted)]">
            One entry · one exit · freeze risk at open · write post-mortems
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && (
          <div className="glass p-10 text-center text-[var(--kodo-ink-muted)]">
            No trades yet. Log from a scanner card when you take a setup.
          </div>
        )}
        {filtered.map((t) => {
          const pnl =
            t.status === "CLOSED" && t.exitPrice != null
              ? realizedPnl({
                  side: t.side as Side,
                  entry: t.entryPrice,
                  exit: t.exitPrice,
                  quantity: t.quantity,
                  fees: t.fees,
                })
              : null;
          const r =
            t.status === "CLOSED" && t.exitPrice != null
              ? rMultiple({
                  side: t.side as Side,
                  entry: t.entryPrice,
                  exit: t.exitPrice,
                  quantity: t.quantity,
                  stopAtEntry: t.stopAtEntry,
                  fees: t.fees,
                })
              : null;
          return (
            <div key={t.id} className="glass p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{t.symbol}</span>
                    <span
                      className="chip mono"
                      style={{
                        color:
                          t.side === "LONG"
                            ? "var(--kodo-cyan)"
                            : "var(--kodo-magenta)",
                      }}
                    >
                      {t.side}
                    </span>
                    <span className="chip">{t.status}</span>
                  </div>
                  <div className="mono text-sm mt-1 text-[var(--kodo-ink-muted)]">
                    qty {t.quantity} @ {t.entryPrice.toFixed(2)}
                    {t.exitPrice != null && ` → ${t.exitPrice.toFixed(2)}`}
                  </div>
                  {t.thesisSummary && (
                    <p className="text-sm mt-2 text-[var(--kodo-ink-muted)]">
                      {t.thesisSummary}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {pnl != null && (
                    <div
                      className="mono text-lg font-semibold"
                      style={{
                        color:
                          pnl >= 0
                            ? "var(--kodo-success)"
                            : "var(--kodo-danger)",
                      }}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </div>
                  )}
                  {r != null && (
                    <div className="mono text-xs text-[var(--kodo-ink-muted)]">
                      {r.toFixed(2)}R
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href={`/journal/${t.id}`}
                  className="btn btn-ghost no-underline"
                >
                  Detail / post-mortem
                </Link>
                {t.status === "OPEN" && (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => closeTrade(t.id)}
                    >
                      Close
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => cancelTrade(t.id)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
