// PDC: load balancing - shows how the particles are split between OpenMP threads
export default function ThreadPanel({ frame }) {
  const counts = frame?.threadCount ?? [];
  const times = frame?.threadMs ?? [];
  const total = counts.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="box flex flex-col gap-3 text-sm">
      <span className="font-medium">Threads</span>
      {counts.length === 0 && <p className="text-muted">No data yet.</p>}
      {counts.map((c, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span>Thread {i}</span>
            <span className="text-muted">{c} particles, {times[i].toFixed(0)} ms</span>
          </div>
          <div className="h-2 bg-bg">
            <div
              className={`h-full ${frame.mode === 'par' ? 'bg-accent' : 'bg-seq'}`}
              style={{ width: `${(c / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
