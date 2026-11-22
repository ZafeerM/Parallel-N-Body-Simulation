#ifndef NBODY_H
#define NBODY_H

#define MAX_THREADS 64

/* PDC: 2.2 memory locality - Structure of Arrays keeps each field contiguous (cache friendly) */
typedef struct {
    int n;
    double *x, *y;     /* position     */
    double *vx, *vy;   /* velocity     */
    double *ax, *ay;   /* acceleration */
    double *m;         /* mass         */
} Bodies;

/* PDC: 5.9 false sharing - each thread writes its own slot, padded to a full 64-byte cache line,
 * so two threads never write to the same cache line */
#define CACHE_LINE 64
typedef struct {
    double ms;                   /* time this thread spent (ms)   */
    int count;                   /* particles this thread handled */
    char pad[CACHE_LINE - sizeof(double) - sizeof(int)];
} ThreadSlot;

/* Per-thread info from the last parallel force calculation. */
typedef struct {
    int used;                    /* number of threads that ran */
    ThreadSlot t[MAX_THREADS];
} ThreadStats;

void bodies_alloc(Bodies *b, int n);
void bodies_free(Bodies *b);
void bodies_init_galaxy(Bodies *b, unsigned int seed);

/* Sequential baseline */
void compute_forces_seq(Bodies *b);
void integrate_seq(Bodies *b, double dt);
double checksum_seq(const Bodies *b);

/* OpenMP versions */
void set_schedule(const char *name);   /* "static" | "dynamic" | "guided" */
void compute_forces_omp(Bodies *b, int threads, ThreadStats *stats);
void integrate_omp(Bodies *b, double dt, int threads);
double checksum_omp(const Bodies *b, int threads);

#endif
