import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const exe = process.platform === 'win32' ? 'nbody.exe' : 'nbody';
export const ENGINE_PATH = path.join(here, '..', 'engine', exe);

export function engineExists() {
  return fs.existsSync(ENGINE_PATH);
}

// Starts the engine and calls onLine(obj) for every JSON line it prints.
function startEngine(args, onLine) {
  const proc = spawn(ENGINE_PATH, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  proc.stdin.on('error', () => {}); // engine already exited - nothing to do
  const rl = readline.createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    try {
      onLine(JSON.parse(line));
    } catch {
      /* ignore anything that isn't JSON */
    }
  });
  return proc;
}

/**
 * Live simulation. The engine sends a frame, then waits for a command
 * ("seq" or "par <threads>") before running the next batch of steps.
 * Pausing simply means we hold back the next command.
 */
export class LiveSimulation {
  constructor({ n, mode = 'seq', threads = 1, schedule = 'static' }, onFrame) {
    this.mode = mode;
    this.threads = threads;
    this.schedule = schedule;
    this.paused = false;
    this.stopped = false;
    this.waiting = false; // engine is waiting for a command
    this.proc = startEngine(['--mode', 'live', '--n', String(n), '--show', '3000'], (msg) => {
      if (msg.type !== 'frame' || this.stopped) return;
      onFrame(msg);
      this.waiting = true;
      if (!this.paused) this.next();
    });
  }

  next() {
    if (this.stopped || !this.waiting || !this.proc.stdin.writable) return;
    this.waiting = false;
    this.proc.stdin.write(this.mode === 'par' ? `par ${this.threads} ${this.schedule}\n` : 'seq\n');
  }

  setMode(mode, threads, schedule = 'static') {
    this.mode = mode;
    this.threads = threads;
    this.schedule = schedule;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.next();
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.proc.stdin.writable) this.proc.stdin.write('quit\n');
    setTimeout(() => this.proc.kill(), 300);
  }
}

/** Benchmark: sequential + 1, 2, 4, 8, 16 threads, one result at a time. */
export function runBenchmark({ n, steps, schedule = 'static' }, onResult, onDone) {
  return startEngine(
    ['--mode', 'bench', '--n', String(n), '--steps', String(steps), '--threads', '0,1,2,4,8,16',
      '--schedule', schedule],
    (msg) => {
      if (msg.type === 'bench') onResult(msg);
      else if (msg.type === 'done') onDone();
    },
  );
}
