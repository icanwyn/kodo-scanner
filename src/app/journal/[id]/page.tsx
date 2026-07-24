"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { realizedPnl, rMultiple, type Side } from "@/lib/journal/pnl";

export default function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [trade, setTrade] = useState<{
    id: string;
    symbol: string;
    side: "LONG" | "SHORT";
    status: string;
    quantity: number;
    entryPrice: number;
    exitPrice: number | null;
    stopPrice: number | null;
    stopAtEntry: number | null;
    fees: number;
    thesisSummary: string | null;
    notes: string | null;
    postmortem: {
      id: string;
      whatWentRight: string | null;
      whatWentWrong: string | null;
      emotions: string | null;
      processGrade: string | null;
      lessons: string | null;
      wouldRepeat: boolean | null;
      bodyMarkdown: string | null;
    } | null;
  } | null>(null);

  const [form, setForm] = useState({
    whatWentRight: "",
    whatWentWrong: "",
    emotions: "",
    processGrade: "" as string,
    lessons: "",
    wouldRepeat: "" as string,
    bodyMarkdown: "",
  });
  const [saved, setSaved] = useState("");

  async function load() {
    const res = await fetch(`/api/trades/${id}`);
    const json = await res.json();
    setTrade(json.trade);
    const pm = json.trade?.postmortem;
    if (pm) {
      setForm({
        whatWentRight: pm.whatWentRight ?? "",
        whatWentWrong: pm.whatWentWrong ?? "",
        emotions: pm.emotions ?? "",
        processGrade: pm.processGrade ?? "",
        lessons: pm.lessons ?? "",
        wouldRepeat:
          pm.wouldRepeat == null ? "" : pm.wouldRepeat ? "yes" : "no",
        bodyMarkdown: pm.bodyMarkdown ?? "",
      });
    }
  }

  useEffect(() => {
    load().catch(() => null);
  }, [id]);

  async function savePostmortem() {
    if (!trade) return;
    const res = await fetch("/api/postmortems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradeId: trade.id,
        whatWentRight: form.whatWentRight || undefined,
        whatWentWrong: form.whatWentWrong || undefined,
        emotions: form.emotions || undefined,
        processGrade: form.processGrade || null,
        lessons: form.lessons || undefined,
        wouldRepeat:
          form.wouldRepeat === ""
            ? null
            : form.wouldRepeat === "yes",
        bodyMarkdown: form.bodyMarkdown || undefined,
      }),
    });
    if (res.ok) {
      setSaved("Post-mortem saved");
      await load();
    } else setSaved("Save failed");
  }

  if (!trade) {
    return <div className="glass p-8">Loading…</div>;
  }

  const pnl =
    trade.exitPrice != null
      ? realizedPnl({
          side: trade.side as Side,
          entry: trade.entryPrice,
          exit: trade.exitPrice,
          quantity: trade.quantity,
          fees: trade.fees,
        })
      : null;
  const r =
    trade.exitPrice != null
      ? rMultiple({
          side: trade.side as Side,
          entry: trade.entryPrice,
          exit: trade.exitPrice,
          quantity: trade.quantity,
          stopAtEntry: trade.stopAtEntry,
          fees: trade.fees,
        })
      : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/journal"
        className="text-sm text-[var(--kodo-ink-muted)] no-underline"
      >
        ← Journal
      </Link>
      <div className="glass p-5">
        <h1 className="text-2xl font-semibold">
          {trade.symbol}{" "}
          <span className="text-base font-normal text-[var(--kodo-ink-muted)]">
            {trade.side} · {trade.status}
          </span>
        </h1>
        <div className="mono mt-2 text-sm">
          {trade.quantity} @ {trade.entryPrice.toFixed(2)}
          {trade.exitPrice != null && ` → ${trade.exitPrice.toFixed(2)}`}
          {trade.stopAtEntry != null &&
            ` · stop@entry ${trade.stopAtEntry.toFixed(2)}`}
        </div>
        {pnl != null && (
          <div className="mt-2 mono">
            P&L {pnl.toFixed(2)}
            {r != null && ` · ${r.toFixed(2)}R`}
          </div>
        )}
        {trade.thesisSummary && (
          <p className="mt-3 text-sm text-[var(--kodo-ink-muted)]">
            {trade.thesisSummary}
          </p>
        )}
      </div>

      <div className="glass p-5 space-y-4">
        <h2 className="text-lg font-medium">Post-mortem</h2>
        <p className="text-xs text-[var(--kodo-ink-muted)]">
          Write whether the thesis was right or wrong — process over outcome.
        </p>
        {(
          [
            ["whatWentRight", "What went right"],
            ["whatWentWrong", "What went wrong"],
            ["emotions", "Emotions / discipline"],
            ["lessons", "Lessons"],
            ["bodyMarkdown", "Freeform notes"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-xs text-[var(--kodo-ink-muted)]">{label}</span>
            <textarea
              className="w-full mt-1 min-h-[72px]"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs text-[var(--kodo-ink-muted)]">
              Process grade
            </span>
            <select
              className="w-full mt-1"
              value={form.processGrade}
              onChange={(e) =>
                setForm({ ...form, processGrade: e.target.value })
              }
            >
              <option value="">—</option>
              {["A", "B", "C", "D", "F"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs text-[var(--kodo-ink-muted)]">
              Would repeat?
            </span>
            <select
              className="w-full mt-1"
              value={form.wouldRepeat}
              onChange={(e) =>
                setForm({ ...form, wouldRepeat: e.target.value })
              }
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" onClick={savePostmortem}>
          Save post-mortem
        </button>
        {saved && (
          <span className="ml-3 text-sm text-[var(--kodo-cyan)]">{saved}</span>
        )}
      </div>
    </div>
  );
}
