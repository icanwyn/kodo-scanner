import type { Trade } from "@prisma/client";
import {
  expectancy,
  profitFactor,
  rMultiple,
  realizedPnl,
  unrealizedPnl,
  winRate,
  type Side,
} from "./pnl";

export function closedPnls(trades: Trade[]): number[] {
  return trades
    .filter((t) => t.status === "CLOSED" && t.exitPrice != null)
    .map((t) =>
      realizedPnl({
        side: t.side as Side,
        entry: t.entryPrice,
        exit: t.exitPrice!,
        quantity: t.quantity,
        fees: t.fees,
      })
    );
}

export function computeJournalStats(
  trades: Trade[],
  marks?: Record<string, number>
) {
  const closed = trades.filter((t) => t.status === "CLOSED");
  const open = trades.filter((t) => t.status === "OPEN");
  const pnls = closedPnls(trades);

  const rMultiples = closed
    .map((t) =>
      t.exitPrice != null
        ? rMultiple({
            side: t.side as Side,
            entry: t.entryPrice,
            exit: t.exitPrice,
            quantity: t.quantity,
            stopAtEntry: t.stopAtEntry,
            fees: t.fees,
          })
        : null
    )
    .filter((x): x is number => x != null);

  let unrealized = 0;
  for (const t of open) {
    const mark = marks?.[t.symbol];
    if (mark == null) continue;
    unrealized += unrealizedPnl({
      side: t.side as Side,
      entry: t.entryPrice,
      mark,
      quantity: t.quantity,
    });
  }

  // Equity curve (cumulative realized by close date)
  const sorted = [...closed]
    .filter((t) => t.exitPrice != null)
    .sort(
      (a, b) =>
        new Date(a.closedAt ?? a.updatedAt).getTime() -
        new Date(b.closedAt ?? b.updatedAt).getTime()
    );
  let cum = 0;
  const equityCurve = sorted.map((t) => {
    const p = realizedPnl({
      side: t.side as Side,
      entry: t.entryPrice,
      exit: t.exitPrice!,
      quantity: t.quantity,
      fees: t.fees,
    });
    cum += p;
    return {
      date: (t.closedAt ?? t.updatedAt).toISOString(),
      symbol: t.symbol,
      pnl: p,
      cumulative: cum,
    };
  });

  return {
    closedCount: closed.length,
    openCount: open.length,
    winRate: winRate(pnls),
    expectancy: expectancy(pnls),
    profitFactor: profitFactor(pnls),
    totalRealized: pnls.reduce((a, b) => a + b, 0),
    totalUnrealized: unrealized,
    avgR:
      rMultiples.length > 0
        ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length
        : null,
    equityCurve,
  };
}
