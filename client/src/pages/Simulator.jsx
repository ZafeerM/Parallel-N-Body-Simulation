import { useEffect, useState } from 'react';
import ControlPanel from '../components/ControlPanel.jsx';
import SimulationCanvas from '../components/SimulationCanvas.jsx';
import ThreadPanel from '../components/ThreadPanel.jsx';

export default function Simulator({ socket }) {
  const { send, frame, setFrame, connected } = socket;
  const [settings, setSettings] = useState({ n: 5000, mode: 'seq', threads: 4, schedule: 'static' });
  const [status, setStatus] = useState('idle'); // idle | running | paused

  // the server stops the live simulation while a benchmark runs
  useEffect(() => {
    if (socket.benchRunning) setStatus('idle');
  }, [socket.benchRunning]);

  const start = (s = settings) => {
    setFrame(null);
    send({ type: 'start', ...s });
    setStatus('running');
  };

  const update = (changes) => {
    const next = { ...settings, ...changes };
    setSettings(next);
    if (status === 'idle') return;
    if ('n' in changes) start(next); // new particle count needs a fresh simulation
    else send({ type: 'set', mode: next.mode, threads: next.threads, schedule: next.schedule }); // switch while running
  };

  const actions = {
    start: () => start(),
    pause: () => {
      send({ type: 'pause' });
      setStatus('paused');
    },
    resume: () => {
      send({ type: 'resume' });
      setStatus('running');
    },
    stop: () => {
      send({ type: 'stop' });
      setStatus('idle');
    },
  };

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr_240px]">
      <ControlPanel settings={settings} update={update} status={status} actions={actions} connected={connected} />
      <SimulationCanvas frame={frame} status={status} />
      <ThreadPanel frame={frame} />
    </div>
  );
}
