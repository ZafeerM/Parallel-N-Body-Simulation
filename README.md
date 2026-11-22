# Molecular Dynamics Simulation (Parallel N-Body)

PDC semester project. A 2D gravitational N-Body simulation written in **C + OpenMP**, with a
small web app to run it sequentially or in parallel and to compare the performance.

```
client/   React web app (Simulation tab + Performance tab)
server/   Node.js server + C engine
  engine/   nbody.c / nbody.h / main.c  ← the C + OpenMP physics engine
  src/      index.js (WebSocket server), engineRunner.js (starts the engine)
```

## How it works

1. The browser talks to the Node server over a WebSocket.
2. The server starts `nbody.exe` and reads the JSON lines it prints.
3. **Simulation tab:** shows the particles, the step time and how the particles are split
   between threads. You can switch between sequential and parallel while it runs.
4. **Performance tab:** runs the sequential version and then 1, 2, 4, 8 and 16 threads, and shows
   the time, speedup and efficiency as a table and graphs.

**Parallelization:** the outer `i` loop of the O(N²) force calculation uses
`#pragma omp parallel for schedule(static)`. Each thread only writes `ax[i]` and `ay[i]`
for its own particles and only reads the shared positions, so there are no race
conditions and no locks are needed.

## Course topics in the code

Each topic is marked with a short `PDC:` comment. Search the project for `PDC:` to find them.

| Topic | Where |
|---|---|
| 2.2 Memory locality (Structure of Arrays) | `engine/nbody.h` |
| 2.3 Shared memory / data parallelism | `engine/nbody.c` `compute_forces_omp` |
| 2.5 I/O kept out of timing | `engine/main.c` `run_live` |
| 2.6 Speedup and efficiency | `pages/Benchmark.jsx` |
| Profiling and benchmarking | `engine/main.c`, `pages/Benchmark.jsx` |
| Load balancing | `engine/nbody.c`, `components/ThreadPanel.jsx` |
| Compiler optimizations (`-O2`) | `engine/build.bat` |
| Large data (up to 20,000 particles) | `components/ControlPanel.jsx` |
| 5.3 Scope of variables | `engine/nbody.c` `accel_on` |
| 5.4 Reduction clause | `engine/nbody.c` `checksum_omp` |
| 5.5 Parallel for directive | `engine/nbody.c` |
| 5.7 Scheduling loops (static / dynamic / guided) | `engine/nbody.c` `set_schedule`, Schedule dropdown on both tabs |
| 5.9 False sharing (padded per-thread slots, private sums) | `engine/nbody.h` `ThreadSlot`, `engine/nbody.c` `accel_on` |
| 5.11 Thread safety | `engine/nbody.c`, checksum in `engine/main.c` |

## Requirements

- **gcc with OpenMP** (MinGW or MSYS2 on Windows, gcc on Linux)
- **Node.js 18+**

## Setup (once)

```powershell
cd server
npm install
npm run build:engine
cd ..\client
npm install
npm run build
```

On Linux/macOS, build the engine with:
`gcc -O2 -fopenmp server/engine/nbody.c server/engine/main.c -o server/engine/nbody -lm`

## Run

```powershell
cd server
npm start
```

Open http://localhost:3001

To work on the UI with hot reload, keep the server running and run `npm run dev` in `client`,
then open http://localhost:5173.

## Engine on its own (for the report)

```powershell
server\engine\nbody.exe --mode bench --n 20000 --steps 10 --threads 0,1,2,4,8,16
```

To compare loop schedules (5.7) from the terminal, add `--schedule static`, `--schedule dynamic` or
`--schedule guided` (default is `static`):

```powershell
server\engine\nbody.exe --mode bench --n 5000 --steps 10 --threads 0,1,2,4,8,16 --schedule dynamic
```

`0` = sequential version. Each line has `totalMs`, `msPerStep` and a `checksum`. The checksum is
the same for every run, which shows the parallel version gives the same result as the sequential one.

- Speedup = T(sequential) / T(p)
- Efficiency = Speedup / p
