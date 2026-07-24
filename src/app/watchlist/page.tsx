"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Quote } from "@/types";

type Item = { id: string; symbol: string; notes: string | null };

export default function WatchlistPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/watchlist");
    const json = await res.json();
    const list: Item[] = json.items ?? [];
    setItems(list);
    if (list.length) {
      const qres = await fetch(
        `/api/market/quote?symbols=${list.map((i) => i.symbol).join(",")}`
      );
      const qjson = await qres.json();
      const map: Record<string, Quote> = {};
      for (const q of qjson.quotes ?? (qjson.quote ? [qjson.quote] : [])) {
        map[q.symbol] = q;
      }
      setQuotes(map);
    }
  }

  useEffect(() => {
    load().catch(() => null);
  }, []);

  async function add() {
    if (!symbol.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase() }),
      });
      setSymbol("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(sym: string) {
    await fetch(`/api/watchlist?symbol=${sym}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      <div className="glass p-4 flex flex-wrap gap-2">
        <input
          className="mono flex-1 min-w-[140px]"
          placeholder="Symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn btn-primary" disabled={busy} onClick={add}>
          Add
        </button>
      </div>
      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="glass p-8 text-center text-[var(--kodo-ink-muted)]">
            Empty — star symbols from the scanner or add above.
          </div>
        )}
        {items.map((item) => {
          const q = quotes[item.symbol];
          const up = (q?.changePct ?? 0) >= 0;
          return (
            <div
              key={item.id}
              className="glass p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-lg">{item.symbol}</div>
                {q && (
                  <div className="mono text-sm">
                    ${q.price.toFixed(2)}{" "}
                    <span
                      style={{
                        color: up ? "var(--kodo-success)" : "var(--kodo-danger)",
                      }}
                    >
                      {up ? "+" : ""}
                      {q.changePct.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/analysis/${item.symbol}`}
                  className="btn btn-ghost no-underline"
                >
                  Analyze
                </Link>
                <button
                  className="btn btn-ghost"
                  onClick={() => remove(item.symbol)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
