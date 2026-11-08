# Unique puzzle generation benchmark

Measured on 2026-11-08, Windows x64, Node v24.19.0, Intel Core i7-8665U
@ 1.90 GHz. Three seeds (130, 2026, 8675309), all seven supported sizes,
10 seconds per trial. Each trial runs in its own worker, sequentially.
Times exclude worker startup, rendering, and independent result validation.

| Grid | Old median | New median | Median speedup | Old/new completions |
| --- | ---: | ---: | ---: | ---: |
| 7×7 | 512 ms | 5.6 ms | 91× | 3/3; 3/3 |
| 8×8 | >10,000 ms | 10.1 ms | >990× | 0/3; 3/3 |
| 9×9 | >10,000 ms | 22.8 ms | >437× | 0/3; 3/3 |
| 10×10 | >10,000 ms | 106 ms | >94× | 0/3; 3/3 |
| 11×11 | >10,000 ms | 172 ms | >58× | 0/3; 3/3 |
| 12×12 | >10,000 ms | 290 ms | >34× | 0/3; 3/3 |
| 13×13 | >10,000 ms | 623 ms | >16× | 0/3; 3/3 |

The old generator timed out on every 8×8–13×13 trial. Those ratios are lower
bounds, not measured completion-time ratios. The new generator completed all
21 trials; 13×13 ranged from 50 ms to 1.96 seconds. Three trials per size are a
small sample, not a latency guarantee or a reliable tail-latency estimate.

Raw runs, search counts, timings, and environment details are in
[`results/generation.json`](results/generation.json). After tightening frontier
bookkeeping, optimized trials were rerun; unchanged baseline measurements from
the same session were reused (`reusedBaseline: true`). The optimized generation
consumes randomness differently, so equal seeds do not imply identical boards.

## Why it is faster

- A bitmask checker searches for an alternative to the valid planted stars.
  It selects the most constrained row, column, or region and incrementally
  removes conflicting candidates. No alternative after exhaustive search means
  unique; a node or time limit means unknown and never certifies uniqueness.
- Alternative stars guide single-cell boundary edits. Donor connectivity is
  checked by flood fill, recipient connectivity follows from adjacency, and
  planted stars never move. Prior alternatives cannot become valid again.
  After at most size² edits, a stalled candidate restarts.
- Region growth tracks eligible boundary cells and free-neighbor counts. Region
  selection is weighted by boundary-cell count / region size, preserving the
  original successful-transition probabilities while skipping failed attempts.
- Everything still runs in one cancellable background worker. No extra worker
  pool or weakening of the uniqueness requirement is needed for these results.

The same-input checker microbenchmark (100 boards per size) measured 13×13 at
1,172 ms with the reference solver versus 39.6 ms with the new checker, about
30× faster. Region-growth timings were mixed and much smaller: for 13×13,
8.46 ms versus 7.85 ms per 100 grids. Most overall improvement comes from guided
repairs and faster uniqueness checking, rather than region growth alone.

## Reproduce

With Node 24+:

```sh
npm run build
npm test
npm run benchmark:generation
```

The default benchmark takes several minutes because old-generation trials reach
their time limits. Set `BENCHMARK_MS` to change the per-trial budget. For a local
optimized-only rerun, `REUSE_BASELINE=1` reuses the saved baseline after checking
the CPU, Node version, and budget; omit it for a fresh comparison.

Every completed benchmark puzzle is independently checked by the original
solver outside the timed interval. The 15 automated tests additionally cover
700 generated grids, cross-check 175 grids against the original solver, exercise
unique/non-unique symmetric fixtures, validate connected boundary edits and
retained stars, distinguish budget exhaustion, and check worker results,
errors, and termination.

The production browser flow was checked at 7×7 and 13×13. A size change cancelled
generation and restored the Generate button; the completed 13×13 board rendered
without browser console errors. Build and tests passed.
