// PDC: profiling and benchmarking - sequential baseline vs 1, 2, 4, 8, 16 threads
import { useState } from 'react';
import BenchmarkCharts from '../components/BenchmarkCharts.jsx';

const SIZES = [1000, 2000, 5000, 10000, 20000];
const SCHEDULES = ['static', 'dynamic', 'guided']; // PDC: 5.7 scheduling loops

export default function Benchmark({ socket }) {
  const { benchResults, benchRunning, startBench, connected } = socket;
  const [n, setN] = useState(5000);
  const [steps, setSteps] = useState(10);
  const [schedule, setSchedule] = useState('static');

  const base = benchResults.find((r) => r.mode === 'seq');
  const rows = benchResults.map((r) => {
    // PDC: 2.6 speedup = T(sequential) / T(p), efficiency = speedup / p
    const speedup = base.totalMs / r.totalMs;
    return { ...r, speedup, efficiency: speedup / r.threads };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="box flex flex-wrap items-end gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Particles</span>
          <select value={n} onChange={(e) => setN(Number(e.target.value))}>
            {SIZES.map((s) => (
              <option key={s} value={s}>{s.toLocaleString()}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Time steps</span>
          <input
            type="number"
            min={1}
            value={steps}
            onChange={(e) => setSteps(Math.max(1, Number(e.target.value)))}
            className="w-24"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Schedule</span>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
            {SCHEDULES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="btn-main"
          onClick={() => startBench({ n, steps, schedule })}
          disabled={!connected || benchRunning}
        >
          {benchRunning ? `Running... (${benchResults.length}/6)` : 'Run benchmark'}
        </button>
        <span className="text-muted">Runs sequential, then 1, 2, 4, 8 and 16 threads.</span>
      </div>

      {rows.length > 0 && (
        <div className="box overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Threads</th>
                <th className="px-4 py-2 font-medium">Time (s)</th>
                <th className="px-4 py-2 font-medium">Speedup</th>
                <th className="px-4 py-2 font-medium">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{r.mode === 'seq' ? 'Sequential' : `Parallel (${r.schedule})`}</td>
                  <td className="px-4 py-2">{r.threads}</td>
                  <td className="px-4 py-2">{(r.totalMs / 1000).toFixed(3)}</td>
                  <td className="px-4 py-2">{r.speedup.toFixed(2)}</td>
                  <td className="px-4 py-2">{(r.efficiency * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BenchmarkCharts rows={rows} />
    </div>
  );
}
