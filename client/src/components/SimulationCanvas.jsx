import { useEffect, useRef } from 'react';

const SIZE = 600;  // canvas size in pixels
const VIEW = 1.4;  // world units from center to edge

export default function SimulationCanvas({ frame, status }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (!frame) return;

    const scale = SIZE / 2 / VIEW;
    const p = frame.pos;
    ctx.fillStyle = frame.mode === 'par' ? '#4f8ef7' : '#e8a54b';
    for (let i = 2; i < p.length; i += 2) {
      ctx.fillRect(SIZE / 2 + p[i] * scale, SIZE / 2 - p[i + 1] * scale, 1.5, 1.5);
    }
    // central heavy body
    ctx.fillStyle = '#fff';
    ctx.fillRect(SIZE / 2 + p[0] * scale - 2, SIZE / 2 - p[1] * scale - 2, 4, 4);
  }, [frame]);

  return (
    <div className="box flex flex-col gap-2">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="aspect-square w-full bg-black" />
      <p className="text-sm text-muted">
        {frame ? (
          <>
            {frame.mode === 'par' ? `Parallel, ${frame.threads} threads (${frame.schedule})` : 'Sequential'}
            {' | '}Step {frame.step}
            {' | '}Step time: <span className="text-text">{frame.stepMs.toFixed(1)} ms</span>
            {status === 'paused' && ' | Paused'}
          </>
        ) : status === 'idle' ? (
          'Press Start to run the simulation.'
        ) : (
          'Starting...'
        )}
      </p>
    </div>
  );
}
