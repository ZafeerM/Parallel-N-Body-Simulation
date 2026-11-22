/*
 * N-Body engine. Talks to the Node server through stdin/stdout (one JSON per line).
 *
 *   live mode:   nbody --mode live --n 5000 [--show 3000] [--seed 42]
 *       Runs the simulation and prints a "frame" line about 30 times a second.
 *       After every frame it waits for one command line on stdin:
 *           "seq"      -> next steps run sequentially
 *           "par <t> [static|dynamic|guided]"  -> OpenMP with t threads
 *           "quit"     -> exit
 *       (Pausing = the server simply doesn't send the next command.)
 *
 *   bench mode:  nbody --mode bench --n 5000 --steps 10 --threads 0,1,2,4,8,16
 *                      [--schedule static|dynamic|guided]
 *       0 means the pure sequential version. Prints one "bench" line per run.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>
#include "nbody.h"

#define DT 0.004

static void print_frame(const Bodies *b, long step, int parallel, int threads, const char *sched,
                        double step_ms, const ThreadStats *ts, int show) {
    int i, stride;

    printf("{\"type\":\"frame\",\"step\":%ld,\"n\":%d,\"mode\":\"%s\",\"threads\":%d,\"schedule\":\"%s\","
           "\"stepMs\":%.3f,", step, b->n, parallel ? "par" : "seq", threads, sched, step_ms);

    printf("\"threadMs\":[");
    for (i = 0; i < ts->used; i++) printf("%s%.3f", i ? "," : "", ts->t[i].ms);
    printf("],\"threadCount\":[");
    for (i = 0; i < ts->used; i++) printf("%s%d", i ? "," : "", ts->t[i].count);

    /* only send a sample of particles for drawing; physics uses all of them */
    if (show > b->n) show = b->n;
    stride = b->n / show;
    printf("],\"pos\":[");
    for (i = 0; i < show; i++) {
        int k = i * stride;
        printf("%s%.3f,%.3f", i ? "," : "", b->x[k], b->y[k]);
    }
    printf("]}\n");
    fflush(stdout);
}

/* Do one time step. Returns its time in ms. */
static double do_step(Bodies *b, int parallel, int threads, ThreadStats *ts) {
    /* PDC: profiling - omp_get_wtime() wall-clock timing */
    double t0 = omp_get_wtime();
    if (parallel) {
        integrate_omp(b, DT, threads);
        compute_forces_omp(b, threads, ts);
    } else {
        double f0;
        integrate_seq(b, DT);
        f0 = omp_get_wtime();
        compute_forces_seq(b);
        ts->used = 1;
        ts->t[0].ms = (omp_get_wtime() - f0) * 1000.0;
        ts->t[0].count = b->n;
    }
    return (omp_get_wtime() - t0) * 1000.0;
}

static int run_live(int n, int show, unsigned seed) {
    Bodies b;
    ThreadStats ts = {0};
    long step = 0;
    int parallel = 0, threads = 1;
    char line[128], sched[16] = "static";

    bodies_alloc(&b, n);
    bodies_init_galaxy(&b, seed);
    compute_forces_seq(&b);                       /* initial accelerations */
    print_frame(&b, 0, parallel, threads, sched, 0, &ts, show);

    for (;;) {
        double frame_start, sum_ms = 0;
        int steps = 0;

        /* wait for the server to tell us how to run the next batch */
        if (!fgets(line, sizeof line, stdin)) break;
        if (strncmp(line, "quit", 4) == 0) break;
        if (strncmp(line, "par", 3) == 0) {
            parallel = 1;
            threads = 1;
            strcpy(sched, "static");
            sscanf(line + 3, "%d %15s", &threads, sched);
            if (threads < 1) threads = 1;
            if (threads > MAX_THREADS) threads = MAX_THREADS;
            if (strcmp(sched, "dynamic") && strcmp(sched, "guided")) strcpy(sched, "static");
            set_schedule(sched);   /* PDC: 5.7 schedule picked in the web app */
        } else {
            parallel = 0;
            threads = 1;
        }

        /* PDC: 2.5 I/O - output is kept out of the timed steps (only sent once per frame) */
        frame_start = omp_get_wtime();
        do {
            sum_ms += do_step(&b, parallel, threads, &ts);
            steps++;
            step++;
        } while ((omp_get_wtime() - frame_start) < 0.033);

        print_frame(&b, step, parallel, threads, sched, sum_ms / steps, &ts, show);
    }

    bodies_free(&b);
    return 0;
}

static int run_bench(int n, int steps, const char *list, const char *sched, unsigned seed) {
    char buf[256];
    char *tok;
    Bodies b;
    bodies_alloc(&b, n);

    strncpy(buf, list, sizeof buf - 1);
    buf[sizeof buf - 1] = '\0';

    for (tok = strtok(buf, ","); tok; tok = strtok(NULL, ",")) {
        int t = atoi(tok), s;
        int parallel = t > 0;
        ThreadStats ts = {0};
        double start, total_ms, sum;

        bodies_init_galaxy(&b, seed);             /* same start state every run */
        compute_forces_seq(&b);
        do_step(&b, parallel, parallel ? t : 1, &ts);   /* untimed warm-up step */

        /* PDC: benchmarking - only computation is timed (no drawing, no output) */
        start = omp_get_wtime();
        for (s = 0; s < steps; s++) do_step(&b, parallel, parallel ? t : 1, &ts);
        total_ms = (omp_get_wtime() - start) * 1000.0;

        /* PDC: 5.11 thread safety - same checksum as sequential means no race conditions */
        sum = parallel ? checksum_omp(&b, t) : checksum_seq(&b);
        printf("{\"type\":\"bench\",\"mode\":\"%s\",\"schedule\":\"%s\",\"threads\":%d,\"n\":%d,\"steps\":%d,"
               "\"totalMs\":%.3f,\"msPerStep\":%.3f,\"checksum\":%.10f}\n",
               parallel ? "par" : "seq", parallel ? sched : "-", parallel ? t : 1, n, steps,
               total_ms, total_ms / steps, sum);
        fflush(stdout);
    }

    printf("{\"type\":\"done\"}\n");
    fflush(stdout);
    bodies_free(&b);
    return 0;
}

int main(int argc, char **argv) {
    const char *mode = "live", *list = "0,1,2,4,8,16", *sched = "static";
    int n = 5000, steps = 10, show = 3000, i;
    unsigned seed = 42;

    for (i = 1; i + 1 < argc; i += 2) {
        if      (!strcmp(argv[i], "--mode"))    mode  = argv[i + 1];
        else if (!strcmp(argv[i], "--n"))       n     = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "--steps"))   steps = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "--show"))    show  = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "--seed"))    seed  = (unsigned)atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "--threads")) list  = argv[i + 1];
        else if (!strcmp(argv[i], "--schedule")) sched = argv[i + 1];
    }
    if (n < 2) n = 2;
    if (show < 1) show = 1;
    if (steps < 1) steps = 1;

    /* PDC: 5.7 scheduling loops - pick the loop schedule from the command line */
    if (strcmp(sched, "dynamic") && strcmp(sched, "guided")) sched = "static";
    set_schedule(sched);

    if (!strcmp(mode, "bench")) return run_bench(n, steps, list, sched, seed);
    return run_live(n, show, seed);
}
