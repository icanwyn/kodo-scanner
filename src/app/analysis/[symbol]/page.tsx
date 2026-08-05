"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ApexRecommendation,
  Candle,
  FactorResult,
  TradeThesis,
} from "@/types";
import { PriceChart } from "@/components/charts/PriceChart";
import { ScoreRing } from "@/components/scanner/ScoreRing";
import { ApexPanel } from "@/components/apex/ApexPanel";
import {
  loadAnalysisSession,
  loadSetupSnapshot,
  saveAnalysisSession,
} from "@/lib/scan/session";

function AnalysisInner({ symbol }: { symbol: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromScanner = searchParams.get("from") === "scanner";

  const cachedSetup = useMemo(() => loadSetupSnapshot(symbol), [symbol]);
  const sessionAnalysis = useMemo(
    () => loadAnalysisSession(symbol),
    [symbol]
  );

  const [loading, setLoading] = useState(!sessionAnalysis?.thesis);
  const [fromCache, setFromCache] = useState(Boolean(sessionAnalysis?.thesis));
  const [candles, setCandles] = useState<Candle[]>([]);
  const [factors, setFactors] = useState<FactorResult[]>(
    sessionAnalysis?.factors?.length
      ? sessionAnalysis.factors
      : (cachedSetup?.factors ?? [])
  );
  const [score, setScore] = useState(
    sessionAnalysis?.score ?? cachedSetup?.confluenceScore ?? 0
  );
  const [sideBias, setSideBias] = useState(
    sessionAnalysis?.sideBias ?? cachedSetup?.sideBias ?? "neutral"
  );
  const [thesis, setThesis] = useState<TradeThesis | null>(
    sessionAnalysis?.thesis ?? null
  );
  const [error, setError] = useState(sessionAnalysis?.error ?? "");
  const [news, setNews] = useState(sessionAnalysis?.news ?? []);
  const [price, setPrice] = useState(
    sessionAnalysis?.price ?? cachedSetup?.price ?? 0
  );
  const [logMsg, setLogMsg] = useState("");
  const [modelUsed, setModelUsed] = useState<string | null>(
    sessionAnalysis?.model ?? null
  );
  const [cachedAt, setCachedAt] = useState<string | null>(
    sessionAnalysis?.savedAt ?? null
  );
  const [apex, setApex] = useState<ApexRecommendation | null | undefined>(
    cachedSetup?.apex
  );

  function goBack() {
    if (
      fromScanner ||
      (typeof window !== "undefined" && window.history.length > 1)
    ) {
      router.back();
      return;
    }
    router.push("/scanner");
  }

  const persist = useCallback(
    (payload: {
      thesis: TradeThesis | null;
      factors: FactorResult[];
      score: number;
      sideBias: string;
      price: number;
      news: { title: string }[];
      model: string | null;
      error?: string;
    }) => {
      if (!payload.thesis && !payload.factors.length) return;
      const savedAt = new Date().toISOString();
      saveAnalysisSession({
        symbol,
        thesis: payload.thesis,
        factors: payload.factors,
        score: payload.score,
        sideBias: payload.sideBias,
        price: payload.price,
        news: payload.news,
        model: payload.model,
        error: payload.error,
        savedAt,
      });
      setCachedAt(savedAt);
    },
    [symbol]
  );

  const loadCandlesOnly = useCallback(async () => {
    try {
      const cRes = await fetch(`/api/market/candles?symbol=${symbol}`);
      const cJson = await cRes.json();
      setCandles(cJson.candles ?? []);
    } catch {
      /* chart optional when cached */
    }
  }, [symbol]);

  const runAnalysis = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError("");
      setFromCache(false);
      try {
        const [cRes, aRes] = await Promise.all([
          fetch(`/api/market/candles?symbol=${symbol}`),
          fetch("/api/analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol, force }),
          }),
        ]);
        const cJson = await cRes.json();
        const aJson = await aRes.json();
        setCandles(cJson.candles ?? []);

        const nextFactors = aJson.setup?.factors ?? factors;
        const nextScore = aJson.setup?.confluenceScore ?? score;
        const nextBias = aJson.setup?.sideBias ?? sideBias;
        const nextPrice = aJson.setup?.price ?? price;
        const nextThesis = aJson.thesis ?? null;
        const nextNews = aJson.news ?? [];
        const nextModel = aJson.model ?? null;
        const nextError = aJson.error?.message ?? "";

        if (aJson.setup) {
          setFactors(nextFactors);
          setScore(nextScore);
          setSideBias(nextBias);
          setPrice(nextPrice);
          if (aJson.setup.apex) setApex(aJson.setup.apex);
        }
        setThesis(nextThesis);
        setNews(nextNews);
        setModelUsed(nextModel);
        setError(nextError);
        setFromCache(Boolean(aJson.cached && nextThesis));

        // Only persist successful thesis (or keep factors if thesis missing)
        if (nextThesis) {
          persist({
            thesis: nextThesis,
            factors: nextFactors,
            score: nextScore,
            sideBias: nextBias,
            price: nextPrice,
            news: nextNews,
            model: nextModel,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed");
      } finally {
        setLoading(false);
      }
    },
    [symbol, factors, score, sideBias, price, persist]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      // Session hit: show thesis immediately, only refresh chart — no LLM spend
      const hit = loadAnalysisSession(symbol);
      if (hit?.thesis) {
        setThesis(hit.thesis);
        setFactors(hit.factors ?? []);
        setScore(hit.score);
        setSideBias(hit.sideBias);
        setPrice(hit.price);
        setNews(hit.news ?? []);
        setModelUsed(hit.model);
        setError(hit.error ?? "");
        setFromCache(true);
        setCachedAt(hit.savedAt);
        setLoading(false);
        if (alive) await loadCandlesOnly();
        return;
      }

      if (alive) await runAnalysis(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per symbol
  }, [symbol]);

  async function logFromThesis() {
    if (!thesis || thesis.bias === "avoid") return;
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        side: thesis.bias === "short" ? "SHORT" : "LONG",
        quantity: 10,
        entryPrice: (thesis.entry.zoneLow + thesis.entry.zoneHigh) / 2,
        stopPrice: thesis.stop.price,
        targetPrices: thesis.targets.map((t) => t.price),
        thesisSummary: thesis.confluenceNarrative.slice(0, 280),
        analysisJson: JSON.stringify(thesis),
        scanFactorsJson: JSON.stringify(factors),
        setupType: "deep_analysis",
      }),
    });
    setLogMsg(res.ok ? "Trade logged from thesis" : "Log failed");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="btn btn-ghost text-sm"
            >
              ← Back to scanner
            </button>
            <Link
              href="/scanner"
              className="text-sm text-[var(--kodo-ink-muted)] no-underline hover:text-[var(--kodo-cyan)]"
            >
              Scanner (keep results)
            </Link>
          </div>
          <h1 className="text-3xl font-semibold mt-2 mono">{symbol}</h1>
          <p className="text-sm text-[var(--kodo-ink-muted)]">
            Deep analysis ·{" "}
            <span className="mono">{modelUsed ?? "grok-4.5"}</span>
            {fromCache && thesis && (
              <span className="text-[var(--kodo-cyan)]">
                {" "}
                · cached (no new tokens)
                {cachedAt
                  ? ` · ${new Date(cachedAt).toLocaleTimeString()}`
                  : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-[var(--kodo-ink-muted)]">Confluence</div>
            <div
              className="mono text-sm uppercase"
              style={{ color: "var(--kodo-cyan)" }}
            >
              {sideBias}
            </div>
          </div>
          <ScoreRing score={score} />
        </div>
      </div>

      <div className="glass p-3 md:p-4">
        {candles.length > 0 ? (
          <PriceChart candles={candles} />
        ) : (
          <div className="h-80 grid place-items-center text-[var(--kodo-ink-muted)]">
            {loading ? "Loading chart…" : "No candle data"}
          </div>
        )}
      </div>

      {(apex || price > 0) && (
        <ApexPanel
          symbol={symbol}
          price={price || cachedSetup?.price || 0}
          apex={apex}
        />
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass p-5">
          <h2 className="font-medium mb-3">Factor breakdown</h2>
          <div className="space-y-2">
            {factors.map((f) => (
              <div
                key={f.id}
                className="flex items-start justify-between gap-3 text-sm border-b border-white/5 pb-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span>{f.name}</span>
                    <span className={`chip ${f.passed ? "pass" : "fail"}`}>
                      {f.passed ? "pass" : "fail"}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--kodo-ink-muted)] mt-0.5">
                    {f.detail}
                  </div>
                </div>
                <div className="mono text-[var(--kodo-ink-muted)] shrink-0">
                  {f.score.toFixed(0)} · w{(f.weight * 100).toFixed(0)}%
                </div>
              </div>
            ))}
            {factors.length === 0 && (
              <p className="text-sm text-[var(--kodo-ink-muted)]">
                Loading factors…
              </p>
            )}
          </div>
        </div>

        <div className="glass p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">AI thesis (Grok 4.5)</h2>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              disabled={loading}
              onClick={() => runAnalysis(true)}
              title="Spends tokens for a fresh thesis"
            >
              {loading ? "Working…" : "Re-run analysis"}
            </button>
          </div>
          {loading && (
            <p className="text-sm text-[var(--kodo-ink-muted)]">
              Analyzing with {modelUsed ?? "grok-4.5"}… (may take 15–40s)
            </p>
          )}
          {fromCache && thesis && !loading && (
            <p className="text-xs text-[var(--kodo-cyan)]">
              Restored from this session — opening again from the scanner does
              not call Grok. Use “Re-run analysis” only if you want a fresh
              thesis.
            </p>
          )}
          {error && !thesis && (
            <div className="text-sm text-[var(--kodo-warning)] space-y-2">
              <p>{error}</p>
              <p className="text-[var(--kodo-ink-muted)]">
                {error.toLowerCase().includes("xai_api_key") ||
                error.toLowerCase().includes("not configured")
                  ? "Add XAI_API_KEY to .env from console.x.ai, then restart npm run dev."
                  : error.toLowerCase().includes("credit") ||
                      error.toLowerCase().includes("403")
                    ? "Billing/credits issue on console.x.ai — check team balance."
                    : "Factor breakdown above is still valid. Retry with Re-run analysis."}
              </p>
            </div>
          )}
          {thesis && (
            <>
              <div className="flex flex-wrap gap-2">
                <span
                  className="chip mono uppercase"
                  style={{
                    color:
                      thesis.bias === "long"
                        ? "var(--kodo-cyan)"
                        : thesis.bias === "short"
                          ? "var(--kodo-magenta)"
                          : "var(--kodo-warning)",
                  }}
                >
                  {thesis.bias}
                </span>
                <span className="chip mono">
                  conf {thesis.confidence.toFixed(0)}
                </span>
                <span className="chip mono">R:R {thesis.riskReward}</span>
              </div>
              <p className="text-sm">{thesis.confluenceNarrative}</p>
              <div className="grid grid-cols-2 gap-2 text-xs mono text-[var(--kodo-ink-muted)]">
                <div>
                  Entry {thesis.entry.zoneLow.toFixed(2)}–
                  {thesis.entry.zoneHigh.toFixed(2)}
                </div>
                <div>Stop {thesis.stop.price.toFixed(2)}</div>
                <div className="col-span-2">
                  Targets{" "}
                  {thesis.targets.map((t) => t.price.toFixed(2)).join(" · ")}
                </div>
              </div>
              <p className="text-xs text-[var(--kodo-ink-muted)]">
                {thesis.marketConditionSummary}
              </p>
              <p className="text-xs text-[var(--kodo-ink-muted)]">
                {thesis.technicalSummary}
              </p>
              <ul className="text-xs text-[var(--kodo-ink-muted)] list-disc pl-4 space-y-1">
                {thesis.risks.slice(0, 5).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="text-[10px] text-[var(--kodo-ink-muted)]">
                {thesis.disclaimer}
              </p>
              {thesis.bias !== "avoid" && (
                <button className="btn btn-primary" onClick={logFromThesis}>
                  Log trade from thesis
                </button>
              )}
              {logMsg && (
                <span className="text-sm text-[var(--kodo-cyan)] ml-2">
                  {logMsg}
                </span>
              )}
            </>
          )}
          {!loading && !thesis && !error && (
            <p className="text-sm text-[var(--kodo-ink-muted)]">
              No thesis. Price ~{price.toFixed(2)}.
            </p>
          )}
        </div>
      </div>

      {news.length > 0 && (
        <div className="glass p-5">
          <h2 className="font-medium mb-3">Headlines</h2>
          <ul className="space-y-2 text-sm text-[var(--kodo-ink-muted)]">
            {news.slice(0, 8).map((n) => (
              <li key={n.title}>· {n.title}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={goBack}>
          ← Back to scanner results
        </button>
      </div>
    </div>
  );
}

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();

  return (
    <Suspense
      fallback={
        <div className="glass p-8 text-[var(--kodo-ink-muted)]">
          Loading analysis…
        </div>
      }
    >
      <AnalysisInner symbol={symbol} />
    </Suspense>
  );
}
