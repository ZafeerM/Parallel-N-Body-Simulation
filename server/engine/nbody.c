#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <omp.h>
#include "nbody.h"

#define G     1.0
#define EPS2  0.0025   /* softening (eps = 0.05) so close particles don't explode */
#define PI    3.14159265358979323846

/* ---------- memory ---------- */

void bodies_alloc(Bodies *b, int n) {
    b->n  = n;
    b->x  = malloc(n * sizeof(double));
    b->y  = malloc(n * sizeof(double));
    b->vx = malloc(n * sizeof(double));
    b->vy = malloc(n * sizeof(double));
    b->ax = malloc(n * sizeof(double));
    b->ay = malloc(n * sizeof(double));
    b->m  = malloc(n * sizeof(double));
}

void bodies_free(Bodies *b) {
    free(b->x);  free(b->y);
    free(b->vx); free(b->vy);
    free(b->ax); free(b->ay);
    free(b->m);
}

/* ---------- initial state: a rotating disk galaxy ---------- */

static unsigned int rng_state;
static double rnd(void) {               /* simple xorshift, same on every OS */
    rng_state ^= rng_state << 13;
    rng_state ^= rng_state >> 17;
    rng_state ^= rng_state << 5;
    return (rng_state & 0xFFFFFF) / (double)0x1000000;
}

void bodies_init_galaxy(Bodies *b, unsigned int seed) {
    const double central_mass = 1.0, disk_mass = 0.5;
    const double rmin = 0.08, rmax = 1.0;
    int i;
    rng_state = seed ? seed : 1;

    /* particle 0 is a heavy "black hole" in the middle */
    b->x[0] = b->y[0] = b->vx[0] = b->vy[0] = 0.0;
    b->m[0] = central_mass;

    for (i = 1; i < b->n; i++) {
        double u = rnd();
        double r = rmin + (rmax - rmin) * sqrt(u);    /* uniform over disk area */
        double a = 2.0 * PI * rnd();
        double enclosed = central_mass + disk_mass * u;
        double r2 = r * r + EPS2;
        double v = sqrt(G * enclosed * r * r / (r2 * sqrt(r2)));  /* circular orbit speed */

        b->x[i]  = r * cos(a);
        b->y[i]  = r * sin(a);
        b->vx[i] = -v * sin(a);
        b->vy[i] =  v * cos(a);
        b->m[i]  = disk_mass / (b->n - 1);
    }
}

/* ---------- force calculation: the O(N^2) hot spot ---------- */

/* Acceleration on particle i from every other particle.
 * When j == i, dx = dy = 0 so it adds nothing (no branch needed). */
static void accel_on(const Bodies *b, int i, double *axo, double *ayo) {
    /* PDC: 5.3 scope - everything declared inside here is private to the calling thread */
    const double *x = b->x, *y = b->y, *m = b->m;
    const int n = b->n;
    double xi = x[i], yi = y[i];
    /* PDC: 5.9 false sharing - sum in private locals and write ax[i]/ay[i] only once at the end,
     * so threads don't keep writing to shared cache lines inside the inner loop */
    double axi = 0.0, ayi = 0.0;
    int j;
    for (j = 0; j < n; j++) {
        double dx = x[j] - xi;
        double dy = y[j] - yi;
        double r2 = dx * dx + dy * dy + EPS2;
        double inv = 1.0 / sqrt(r2);
        double s = G * m[j] * inv * inv * inv;
        axi += dx * s;
        ayi += dy * s;
    }
    *axo = axi;
    *ayo = ayi;
}

void compute_forces_seq(Bodies *b) {
    int i;
    for (i = 0; i < b->n; i++)
        accel_on(b, i, &b->ax[i], &b->ay[i]);
}

/* PDC: 5.7 scheduling loops - "static" (default), "dynamic" or "guided" for schedule(runtime) below */
void set_schedule(const char *name) {
    if (!strcmp(name, "dynamic"))     omp_set_schedule(omp_sched_dynamic, 0);
    else if (!strcmp(name, "guided")) omp_set_schedule(omp_sched_guided, 0);
    else                              omp_set_schedule(omp_sched_static, 0);
}

/* PDC: 2.3 data parallelism / shared memory - every thread works on a slice of the same arrays
 * PDC: 5.11 thread safety - each thread only WRITES ax[i], ay[i] for its own i, so no races and no locks */
void compute_forces_omp(Bodies *b, int threads, ThreadStats *stats) {
    if (stats) stats->used = threads;

    #pragma omp parallel num_threads(threads)
    {
        int tid = omp_get_thread_num();
        int count = 0, i;
        double t0 = omp_get_wtime();

        /* PDC: 5.5 parallel for directive, 5.7 schedule chosen by set_schedule() */
        #pragma omp for schedule(runtime)
        for (i = 0; i < b->n; i++) {
            accel_on(b, i, &b->ax[i], &b->ay[i]);
            count++;
        }

        /* PDC: load balancing - per-thread time and work, shown in the UI */
        if (stats && tid < MAX_THREADS) {
            stats->t[tid].ms = (omp_get_wtime() - t0) * 1000.0;
            stats->t[tid].count = count;
        }
    }
}

/* ---------- integration: update velocity, then position ---------- */

void integrate_seq(Bodies *b, double dt) {
    int i;
    for (i = 0; i < b->n; i++) {
        b->vx[i] += b->ax[i] * dt;
        b->vy[i] += b->ay[i] * dt;
        b->x[i]  += b->vx[i] * dt;
        b->y[i]  += b->vy[i] * dt;
    }
}

void integrate_omp(Bodies *b, double dt, int threads) {
    int i;
    /* PDC: 5.5 parallel for, 5.7 static schedule (equal work per particle) */
    #pragma omp parallel for num_threads(threads) schedule(static)
    for (i = 0; i < b->n; i++) {
        b->vx[i] += b->ax[i] * dt;
        b->vy[i] += b->ay[i] * dt;
        b->x[i]  += b->vx[i] * dt;
        b->y[i]  += b->vy[i] * dt;
    }
}

/* ---------- sums over all particles ---------- */

double checksum_seq(const Bodies *b) {
    double s = 0.0;
    int i;
    for (i = 0; i < b->n; i++) s += b->x[i] + b->y[i];
    return s;
}

double checksum_omp(const Bodies *b, int threads) {
    double s = 0.0;
    int i;
    /* PDC: 5.4 reduction clause - each thread sums privately, OpenMP adds the parts */
    #pragma omp parallel for num_threads(threads) reduction(+:s)
    for (i = 0; i < b->n; i++) s += b->x[i] + b->y[i];
    return s;
}
