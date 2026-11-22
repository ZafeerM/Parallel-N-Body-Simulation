import { useState } from 'react';
import useSocket from './hooks/useSocket.js';
import Simulator from './pages/Simulator.jsx';
import Benchmark from './pages/Benchmark.jsx';

export default function App() {
  const socket = useSocket();
  const [tab, setTab] = useState('sim');

  const tabClass = (t) =>
    `px-3 py-1.5 text-sm border-b-2 ${tab === t ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line">
        <div className="pb-2">
          <h1 className="text-xl font-semibold">Molecular Dynamics Simulation (Parallel N-Body)</h1>
          <p className="text-sm text-muted">Sequential vs OpenMP</p>
        </div>
        <nav className="flex">
          <button className={tabClass('sim')} onClick={() => setTab('sim')}>Simulation</button>
          <button className={tabClass('perf')} onClick={() => setTab('perf')}>Performance</button>
        </nav>
      </header>

      {!socket.connected && <p className="text-sm text-seq">Not connected to the server. Is it running?</p>}

      {/* both stay mounted so switching tabs keeps their state */}
      <div className={tab === 'sim' ? '' : 'hidden'}>
        <Simulator socket={socket} />
      </div>
      <div className={tab === 'perf' ? '' : 'hidden'}>
        <Benchmark socket={socket} />
      </div>
    </div>
  );
}
