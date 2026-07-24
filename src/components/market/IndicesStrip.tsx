"use client";

import { useEffect, useState } from "react";
import { PulseDot } from "./PulseDot";
import type { Quote } from "@/types";

export function IndicesStrip() {
  const [indices, setIndices] = useState<Quote[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market/indices");
        const json = await res.json();
        if (alive) setIndices(json.indices ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 12_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium tracking-wide text-[var(--kodo-ink-muted)]">
          Market pulse
        </h2>
        <PulseDot delayed />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {indices.length === 0 &&
          ["SPY", "QQQ", "DIA", "IWM", "VIX"].map((s) => (
            <div key={s} className="glass glass-sm p-3 opacity-50">
              <div className="text-xs text-[var(--kodo-ink-muted)]">{s}</div>
              <div className="mono text-lg">—</div>
            </div>
          ))}
        {indices.map((q) => {
          const up = q.changePct >= 0;
          return (
            <div key={q.symbol} className="glass glass-sm p-3">
              <div className="text-xs text-[var(--kodo-ink-muted)]">
                {q.symbol.replace("^", "")}
              </div>
              <div className="mono text-lg font-semibold">
                {q.price.toFixed(q.symbol.includes("VIX") ? 2 : 2)}
              </div>
              <div
                className="mono text-xs"
                style={{ color: up ? "var(--kodo-success)" : "var(--kodo-danger)" }}
              >
                {up ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
