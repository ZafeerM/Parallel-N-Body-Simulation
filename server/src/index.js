import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { LiveSimulation, runBenchmark, engineExists, ENGINE_PATH } from './engineRunner.js';

const PORT = process.env.PORT || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(here, '..', '..', 'client', 'dist');

if (!engineExists()) {
  console.error(`Engine not found at ${ENGINE_PATH}\nRun "npm run build:engine" first.`);
  process.exit(1);
}

const app = express();
if (fs.existsSync(clientDist)) app.use(express.static(clientDist)); // built React app

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let sim = null;
  let bench = null;
  const send = (obj) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj));

  const stopAll = () => {
    sim?.stop();
    sim = null;
    bench?.kill();
    bench = null;
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'start':
        stopAll();
        sim = new LiveSimulation(msg, (frame) => send(frame));
        break;
      case 'set':
        sim?.setMode(msg.mode, msg.threads, msg.schedule);
        break;
      case 'pause':
        sim?.pause();
        break;
      case 'resume':
        sim?.resume();
        break;
      case 'stop':
        stopAll();
        break;
      case 'bench':
        stopAll(); // don't let the live view steal CPU from the benchmark
        bench = runBenchmark(
          msg,
          (result) => send({ type: 'bench-result', result }),
          () => {
            send({ type: 'bench-done' });
            bench = null;
          },
        );
        break;
    }
  });

  ws.on('close', stopAll);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
