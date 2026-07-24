export function ScoreRing({ score }: { score: number }) {
  const p = Math.max(0, Math.min(100, score));
  return (
    <div className="score-ring" style={{ ["--p" as string]: p }}>
      <span>{p.toFixed(0)}</span>
    </div>
  );
}
