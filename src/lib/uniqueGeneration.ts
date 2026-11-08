import { generatePuzzle, type GeneratedPuzzle } from "./puzzleGeneration.ts";
import type { StarBattleSolution } from "./starBattle";

export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

type CheckResult = { status: "unique" | "multiple" | "unknown"; alternative?: StarBattleSolution; nodes: number };
const popcount = (value: number) => {
  let count = 0;
  while (value) { value &= value - 1; count += 1; }
  return count;
};

/** Requires a valid known solution. Unknown is never a uniqueness certificate. */
export function findAlternative(puzzle: GeneratedPuzzle, nodeLimit = Infinity, deadline = Infinity): CheckResult {
  const { regions, stars } = puzzle;
  const n = regions.length, full = (1 << n) - 1;
  const known = Array<number>(n).fill(-1);
  for (const [r, c] of stars) known[r] = c;
  if (n < 1 || n > 13 || regions.some(row => row.length !== n || row.some(id => id < 1 || id > n || !Number.isInteger(id))) ||
    stars.length !== n || known.some(c => c < 0 || c >= n) || new Set(known).size !== n ||
    new Set(known.map((c, r) => regions[r][c])).size !== n || known.some((c, r) => r > 0 && Math.abs(c - known[r - 1]) <= 1)) {
    throw new Error("Uniqueness checking requires a valid known solution and region grid.");
  }
  const regionMasks = Array.from({ length: n }, () => Array<number>(n).fill(0));
  regions.forEach((row, r) => row.forEach((id, c) => { regionMasks[id - 1][r] |= 1 << c; }));
  const conflicts = regions.flatMap((row, r) => row.map((id, c) =>
    Array.from({ length: n }, (_, otherRow) => otherRow === r ? full :
      regionMasks[id - 1][otherRow] | (1 << c) | (Math.abs(otherRow - r) === 1 ? (1 << c) >> 1 | (1 << c) << 1 : 0))));
  const placement = Array<number>(n).fill(-1);
  let nodes = 0, exhausted = false;
  let alternative: StarBattleSolution | undefined;
  const visit = (domains: number[], rows: number, columns: number, usedRegions: number, differs: boolean): boolean => {
    nodes += 1;
    if (nodes > nodeLimit || ((nodes & 255) === 1 && performance.now() >= deadline)) { exhausted = true; return true; }
    if (rows === full) {
      if (!differs) return false;
      alternative = placement.map((c, r) => [r, c]);
      return true;
    }
    let options: number[] = [], best = n + 1;
    // Choose the most constrained unfilled row, column, or region.
    for (let r = 0; r < n; r += 1) if (!(rows & (1 << r))) {
      const count = popcount(domains[r]);
      if (!count) return false;
      if (count < best) {
        best = count; options = [];
        for (let mask = domains[r]; mask; mask &= mask - 1) options.push(r * n + 31 - Math.clz32(mask & -mask));
      }
    }
    for (let unit = 0; unit < n; unit += 1) {
      for (const isRegion of [false, true]) {
        if ((isRegion ? usedRegions : columns) & (1 << unit)) continue;
        const candidates: number[] = [];
        for (let r = 0; r < n; r += 1) {
          let mask = domains[r] & (isRegion ? regionMasks[unit][r] : 1 << unit);
          for (; mask; mask &= mask - 1) candidates.push(r * n + 31 - Math.clz32(mask & -mask));
        }
        if (!candidates.length) return false;
        if (candidates.length < best) { best = candidates.length; options = candidates; }
      }
    }
    // Try deviations first: rejecting non-unique candidates usually needs one witness.
    options.sort((a, b) => Number(a % n === known[Math.floor(a / n)]) - Number(b % n === known[Math.floor(b / n)]));
    for (const cell of options) {
      const r = Math.floor(cell / n), c = cell % n;
      placement[r] = c;
      const next = domains.map((mask, row) => mask & ~conflicts[cell][row]);
      if (visit(next, rows | 1 << r, columns | 1 << c, usedRegions | 1 << (regions[r][c] - 1), differs || c !== known[r])) return true;
      placement[r] = -1;
    }
    return false;
  };
  visit(Array<number>(n).fill(full), 0, 0, 0, false);
  return { status: exhausted ? "unknown" : alternative ? "multiple" : "unique", alternative, nodes };
}

/** Move an alternative star across a boundary, without reviving previous witnesses. */
export function repairBoundary(puzzle: GeneratedPuzzle, witnesses: StarBattleSolution[], random = Math.random): boolean {
  const { regions, stars } = puzzle, n = regions.length;
  const fixed = new Set(stars.map(([r, c]) => r * n + c));
  const neighbors = (r: number, c: number) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([nr, nc]) => nr >= 0 && nr < n && nc >= 0 && nc < n);
  const moves: [number, number, number][] = [];
  for (const [r, c] of witnesses[witnesses.length - 1]) {
    if (fixed.has(r * n + c)) continue;
    for (const target of new Set(neighbors(r, c).map(([nr, nc]) => regions[nr][nc]))) {
      if (target !== regions[r][c]) moves.push([r, c, target]);
    }
  }
  for (let i = moves.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  for (const [r, c, target] of moves) {
    const source = regions[r][c];
    regions[r][c] = target;
    // Target connectivity follows from adjacency. Check the donor with a flood fill.
    const seed = stars.find(([sr, sc]) => regions[sr][sc] === source)!;
    const pending = [seed], seen = new Set<number>();
    while (pending.length) {
      const [sr, sc] = pending.pop()!;
      const key = sr * n + sc;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [nr, nc] of neighbors(sr, sc)) if (regions[nr][nc] === source) pending.push([nr, nc]);
    }
    const connected = regions.flat().filter(id => id === source).length === seen.size;
    const revivesWitness = witnesses.some(solution => new Set(solution.map(([sr, sc]) => regions[sr][sc])).size === n);
    if (connected && !revivesWitness) return true;
    regions[r][c] = source;
  }
  return false;
}

export type GenerationProgress = { attempts: number; checks: number; repairs: number; nodes: number };
export function generateUniquePuzzle(size: number, options: {
  random?: () => number; deadline?: number; onProgress?: (progress: GenerationProgress) => void;
} = {}): { puzzle: GeneratedPuzzle | null; stats: GenerationProgress } {
  const random = options.random ?? Math.random, deadline = options.deadline ?? Infinity;
  const stats = { attempts: 0, checks: 0, repairs: 0, nodes: 0 };
  let lastUpdate = performance.now();
  while (performance.now() < deadline) {
    const puzzle = generatePuzzle(size, random);
    stats.attempts += 1;
    const witnesses: StarBattleSolution[] = [];
    for (let step = 0; step <= size * size; step += 1) {
      const check = findAlternative(puzzle, 100_000, deadline);
      stats.checks += 1; stats.nodes += check.nodes;
      if (performance.now() - lastUpdate >= 200) { options.onProgress?.({ ...stats }); lastUpdate = performance.now(); }
      if (check.status === "unique") return { puzzle, stats };
      if (check.status === "unknown" || step === size * size) break;
      witnesses.push(check.alternative!);
      if (!repairBoundary(puzzle, witnesses, random)) break;
      stats.repairs += 1;
    }
  }
  return { puzzle: null, stats };
}
