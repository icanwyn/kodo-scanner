"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/types";

export function PriceChart({ candles }: { candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || candles.length === 0) return;
    let disposed = false;
    let chart: { remove: () => void } | null = null;

    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !ref.current) return;
      ref.current.innerHTML = "";
      const c = lc.createChart(ref.current, {
        height: 320,
        layout: {
          background: { color: "transparent" },
          textColor: "rgba(232,228,220,0.7)",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
        timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      });
      chart = c;

      const series = c.addSeries(lc.CandlestickSeries, {
        upColor: "#2de2e6",
        downColor: "#ff2bd6",
        borderUpColor: "#2de2e6",
        borderDownColor: "#ff2bd6",
        wickUpColor: "#2de2e6",
        wickDownColor: "#ff2bd6",
      });

      series.setData(
        candles.map((x) => ({
          time: x.time as import("lightweight-charts").UTCTimestamp,
          open: x.open,
          high: x.high,
          low: x.low,
          close: x.close,
        }))
      );
      c.timeScale().fitContent();
    })();

    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [candles]);

  return <div ref={ref} className="w-full rounded-xl overflow-hidden" />;
}
