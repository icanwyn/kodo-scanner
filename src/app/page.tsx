import Link from "next/link";
import { IndicesStrip } from "@/components/market/IndicesStrip";
import { RegimeBanner } from "@/components/market/RegimeBanner";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="pt-2">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--kodo-ink-muted)] mb-2">
          高動 · heartbeat of the tape
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          <span className="gradient-text">Kōdō Scanner</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--kodo-ink-muted)]">
          Multi-factor confluence for discretionary traders — transparent scores,
          regime context, deep Grok analysis, and a full trade journal with
          post-mortems. Glass UI. Japanese restraint. Future-funk pulse.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/scanner" className="btn btn-primary no-underline">
            Run scanner
          </Link>
          <Link href="/journal" className="btn btn-ghost no-underline">
            Open journal
          </Link>
          <Link href="/stats" className="btn btn-ghost no-underline">
            Win / loss stats
          </Link>
        </div>
      </section>

      <RegimeBanner />
      <IndicesStrip />

      <section className="grid md:grid-cols-3 gap-4">
        {[
          {
            t: "Transparent confluence",
            d: "10 weighted factors — breakout, 20D anchored VWAP, prior-day RVOL, RSI, MACD, EMA stack, ATR, S/R, momentum, regime.",
          },
          {
            t: "Deep analysis agent",
            d: "xAI Grok synthesizes regime + factors + news into entry, stop, targets, and risk narrative (optional API key).",
          },
          {
            t: "Journal & post-mortem",
            d: "Log setups, track R-multiples, write what went right or wrong, grade process — not just P&L.",
          },
        ].map((c) => (
          <div key={c.t} className="glass p-5">
            <h3 className="font-medium mb-2">{c.t}</h3>
            <p className="text-sm text-[var(--kodo-ink-muted)]">{c.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
