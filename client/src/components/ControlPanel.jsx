// PDC: large data processing - up to 20,000 particles = 400M force calculations per step
const SIZES = [1000, 2000, 5000, 10000, 20000];
const THREADS = [1, 2, 4, 8, 16];
const SCHEDULES = ['static', 'dynamic', 'guided']; // PDC: 5.7 scheduling loops

export default function ControlPanel({ settings, update, status, actions, connected }) {
  const running = status !== 'idle';

  return (
    <div className="box flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <span className="font-medium">Mode</span>
        <label className="flex items-center gap-2">
          <input type="radio" checked={settings.mode === 'seq'} onChange={() => update({ mode: 'seq' })} />
          Sequential
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={settings.mode === 'par'} onChange={() => update({ mode: 'par' })} />
          Parallel (OpenMP)
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Threads</span>
        <select
          value={settings.threads}
          disabled={settings.mode === 'seq'}
          onChange={(e) => update({ threads: Number(e.target.value) })}
        >
          {THREADS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Schedule</span>
        <select
          value={settings.schedule}
          disabled={settings.mode === 'seq'}
          onChange={(e) => update({ schedule: e.target.value })}
        >
          {SCHEDULES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Particles</span>
        <select value={settings.n} onChange={(e) => update({ n: Number(e.target.value) })}>
          {SIZES.map((s) => (
            <option key={s} value={s}>{s.toLocaleString()}</option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-col gap-2">
        {!running && (
          <button className="btn-main" onClick={actions.start} disabled={!connected}>Start</button>
        )}
        {status === 'running' && <button className="btn" onClick={actions.pause}>Pause</button>}
        {status === 'paused' && <button className="btn-main" onClick={actions.resume}>Resume</button>}
        {running && <button className="btn" onClick={actions.stop}>Stop</button>}
      </div>
    </div>
  );
}
