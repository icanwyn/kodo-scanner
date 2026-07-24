"use client";

import { useEffect, useState } from "react";
import type { ScoredSetup, MarketRegime } from "@/types";
import { SetupCard } from "@/components/scanner/SetupCard";
import { PulseDot } from "@/components/market/PulseDot";
import {
  loadScanSession,
  saveScanSession,
  clearScanSession,
  type ScanFiltersState,
} from "@/lib/scan/session";

export default function ScannerPage() {
  const [hydrated, setHydrated] = useState(false);
  const [results, setResults] = useState<ScoredSetup[]>([]);
  const [regime, setRegime] = useState<MarketRegime | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<{
    durationMs?: number;
    symbolsScanned?: number;
  } | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [universe, setUniverse] =
    useState<ScanFiltersState["universe"]>("movers");
  const [sideBias, setSideBias] =
    useState<ScanFiltersState["sideBias"]>("any");
  const [minScore, setMinScore] = useState(55);
  const [custom, setCustom] = useState(
    "AAPL,MSFT,NVDA,AMD,META,TSLA,AMZN,GOOGL"
  );

  // Restore last scan when returning from analysis / other pages
  useEffect(() => {
    const session = loadScanSession();
    if (session) {
      setResults(session.results ?? []);
      setRegime(session.regime ?? null);
      setMeta(session.meta ?? null);
      setRanAt(session.ranAt ?? null);
      if (session.filters) {
        setUniverse(session.filters.universe ?? "movers");
        setSideBias(session.filters.sideBias ?? "any");
        setMinScore(session.filters.minScore ?? 55);
        setCustom(
          session.filters.custom ??
            "AAPL,MSFT,NVDA,AMD,META,TSLA,AMZN,GOOGL"
        );
      }
    }
    setHydrated(true);
  }, []);

  function persist(
    next: {
      results: ScoredSetup[];
      regime: MarketRegime | null;
      meta: { durationMs?: number; symbolsScanned?: number } | null;
      ranAt: string;
    },
    filters?: ScanFiltersState
  ) {
    saveScanSession({
      results: next.results,
      regime: next.regime,
      meta: next.meta,
      ranAt: next.ranAt,
      filters: filters ?? { universe, sideBias, minScore, custom },
    });
  }

  async function run() {
    setLoading(true);
    setError("");
    try {
      const filters: ScanFiltersState = {
        universe,
        sideBias,
        minScore,
        custom,
      };
      const body: Record<string, unknown> = {
        universe,
        sideBias,
        minScore,
        maxSymbols: 40,
      };
      if (universe === "custom") {
        body.symbols = custom
          .split(/[,\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
      }
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Scan failed");
      const nextResults = (json.results ?? []) as ScoredSetup[];
      const nextRegime = (json.regime ?? null) as MarketRegime | null;
      const nextMeta = (json.meta ?? null) as {
        durationMs?: number;
        symbolsScanned?: number;
      } | null;
      const nextRanAt = new Date().toISOString();
      setResults(nextResults);
      setRegime(nextRegime);
      setMeta(nextMeta);
      setRanAt(nextRanAt);
      persist(
        {
          results: nextResults,
          regime: nextRegime,
          meta: nextMeta,
          ranAt: nextRanAt,
        },
        filters
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  function clearResults() {
    clearScanSession();
    setResults([]);
    setRegime(null);
    setMeta(null);
    setRanAt(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Scanner</h1>
          <p className="text-sm text-[var(--kodo-ink-muted)] mt-1">
            Daily swing confluence · max 50 symbols · delayed free-tier data
          </p>
          {hydrated && results.length > 0 && ranAt && (
            <p className="text-xs text-[var(--kodo-cyan)] mt-1">
              Restored last scan · {new Date(ranAt).toLocaleString()} · open a
              ticker and return without rescanning
            </p>
          )}
        </div>
        <PulseDot delayed />
      </div>

      <div className="glass p-4 md:p-5 grid md:grid-cols-4 gap-4 items-end">
        <label className="block text-sm">
          <span className="text-[var(--kodo-ink-muted)] text-xs">Universe</span>
          <select
            className="w-full mt-1"
            value={universe}
            onChange={(e) =>
              setUniverse(e.target.value as ScanFiltersState["universe"])
            }
          >
            <option value="movers">Liquid movers + mega-cap</option>
            <option value="watchlist">Watchlist</option>
            <option value="custom">Custom symbols</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--kodo-ink-muted)] text-xs">Side bias</span>
          <select
            className="w-full mt-1"
            value={sideBias}
            onChange={(e) =>
              setSideBias(e.target.value as ScanFiltersState["sideBias"])
            }
          >
            <option value="any">Any</option>
            <option value="long">Long only</option>
            <option value="short">Short only</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--kodo-ink-muted)] text-xs">
            Min score ({minScore})
          </span>
          <input
            type="range"
            min={0}
            max={90}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full mt-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? "Scanning…" : results.length ? "Re-run scan" : "Run scan"}
          </button>
          {results.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={clearResults}
              disabled={loading}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
        {universe === "custom" && (
          <label className="block text-sm md:col-span-4">
            <span className="text-[var(--kodo-ink-muted)] text-xs">
              Symbols (comma-separated)
            </span>
            <input
              className="w-full mt-1 mono"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        )}
      </div>

      {regime && (
        <div className="text-sm text-[var(--kodo-ink-muted)]">
          Regime:{" "}
          <span className="text-[var(--kodo-ink)] font-medium">
            {regime.label.replaceAll("_", " ")}
          </span>
          {meta?.durationMs != null && (
            <span className="mono ml-3">
              {meta.symbolsScanned ?? results.length} scored · {meta.durationMs}
              ms
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="glass p-4 text-[var(--kodo-danger)] text-sm">{error}</div>
      )}

      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass h-40 animate-pulse" />
          ))}
        </div>
      )}

      {hydrated && !loading && results.length === 0 && !error && (
        <div className="glass p-10 text-center text-[var(--kodo-ink-muted)]">
          Run a scan to surface high-probability setups with factor chips you can
          audit. Results stay cached when you open a ticker and come back.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {results.map((s) => (
          <SetupCard key={s.symbol + s.confluenceScore} setup={s} />
        ))}
      </div>
    </div>
  );
}
