# Star Battle 1 solver

A browser-only TypeScript solver for **Star Battle 1**: one non-adjacent star
in each row, column, and region.

## Behaviour

- Region editor: click a cell to cycle its region ID; use exactly one region per
  grid dimension (for example, five regions on a 5×5 grid).
- Backtracking stops at **two** solutions. One displayed grid means the input
  is unique; two displayed grids means it is non-unique.
- Copy the input or first completed grid as a compact, readable string.
- Download the input and the full result set as JSON.
- Puzzle generation (`/puzzle_generation`): choose 7×7 through 13×13 and press
  Generate to place non-touching stars and grow connected regions randomly.
  A bitmask solver searches for a solution different from the planted stars.
  Alternative solutions guide connected region-boundary edits; stalled searches
  restart with a fresh grid. A puzzle is displayed only after exhaustive checking
  proves it unique. This runs in a background worker to keep
  the page responsive. Changing size or leaving the page cancels the search.
  Stars are hidden by default. Use Show solution to reveal them or Hide solution
  to hide them again. Generating a new puzzle resets the solution to hidden.
  Solve with techniques loads and solves a copy of the generated regions using
  your technique order, then opens the walkthrough at step 0. All
  generated sizes through 13×13 are supported by the solver editor and importer.
  Each generated puzzle is rated in a separate background worker using a fixed
  technique order: Easy (forced stars), Medium (visibility/accounting), Hard
  (chains/reframed regions), or Expert (contradiction). The hardest technique
  used determines the estimate; it is not proof of the minimum required technique.
  The page lists technique counts and step count. Incomplete, failed, or timed-out
  analyses (30 seconds) are Unrated, without affecting the puzzle's uniqueness.

The backtracking approach is adapted from Solver Sanctuary's public
`starBattleSolve` implementation, restricted to one star per unit.

## Local development

```bash
npm install
npm run dev
```

Run `npm run build` to type-check and produce the production bundle.
Run `npm test` with Node 24+ to check generation, uniqueness, repairs, and workers.
Run `npm run benchmark:generation` for three seeded trials per size and algorithm,
with a 10-second budget per trial. Set `BENCHMARK_MS` to change that budget.
Results and machine details are written to `benchmarks/results/generation.json`.
See [generation benchmarks](benchmarks/README.md) for measured results and methodology.
