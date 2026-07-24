"use client";

import { useEffect, useState } from "react";
import { FACTOR_CONFIG } from "@/lib/scan/factors";

export default function SettingsPage() {
  const [health, setHealth] = useState<{
    providers?: Record<string, boolean>;
    analysisBudget?: { used: number; limit: number; remaining: number };
  } | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--kodo-ink-muted)]">
          Server keys live in <span className="mono">.env</span>. Preferences are
          local-only. Factor weights are code constants in v1 (read-only).
        </p>
      </div>

      <div className="glass p-5 space-y-3">
        <h2 className="font-medium">Provider status</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(health?.providers ?? {}).map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between glass glass-sm px-3 py-2"
            >
              <span className="capitalize">{k}</span>
              <span
                style={{
                  color: v ? "var(--kodo-success)" : "var(--kodo-ink-muted)",
                }}
              >
                {v ? "configured" : "off"}
              </span>
            </div>
          ))}
        </div>
        {health?.analysisBudget && (
          <p className="text-xs text-[var(--kodo-ink-muted)] mono">
            Analysis budget {health.analysisBudget.used}/
            {health.analysisBudget.limit} (resets on restart)
          </p>
        )}
      </div>

      <div className="glass p-5">
        <h2 className="font-medium mb-3">Factor weights (read-only)</h2>
        <div className="space-y-2">
          {FACTOR_CONFIG.map((f) => (
            <div
              key={f.id}
              className="flex justify-between text-sm border-b border-white/5 py-2"
            >
              <span>{f.name}</span>
              <span className="mono text-[var(--kodo-ink-muted)]">
                {(f.weight * 100).toFixed(0)}% · pass ≥ {f.passThreshold}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass p-5 text-sm text-[var(--kodo-ink-muted)] space-y-2">
        <h2 className="font-medium text-[var(--kodo-ink)]">Environment</h2>
        <p>
          Copy <span className="mono">.env.example</span> →{" "}
          <span className="mono">.env</span>. Optional:{" "}
          <span className="mono">XAI_API_KEY</span> for deep analysis,{" "}
          <span className="mono">FINNHUB_API_KEY</span> etc. for cascade
          upgrades.
        </p>
        <p>
          Runtime: long-lived Node only (
          <span className="mono">npm run dev</span> /{" "}
          <span className="mono">next start</span>). SQLite is not supported on
          Vercel serverless.
        </p>
      </div>
    </div>
  );
}
