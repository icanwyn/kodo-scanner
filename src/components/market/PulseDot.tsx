export function PulseDot({ delayed = true }: { delayed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-[var(--kodo-ink-muted)]">
      <span className={`pulse-dot ${delayed ? "delayed" : ""}`} />
      {delayed ? "Delayed data" : "Realtime"}
    </span>
  );
}
