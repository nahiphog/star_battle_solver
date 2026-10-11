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

The backtracking approach is adapted from Solver Sanctuary's public
`starBattleSolve` implementation, restricted to one star per unit.

## Local development

```bash
npm install
npm run dev
```

Run `npm run build` to type-check and produce the production bundle.
