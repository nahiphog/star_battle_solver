import type { StarBattleSolution } from "./starBattle";

export const GENERATION_SIZES = [7, 8, 9, 10, 11, 12, 13];
export type GeneratedPuzzle = { regions: number[][]; stars: StarBattleSolution };
const neighborCache = new Map<number, number[][]>();

export function generatePuzzle(size: number, random = Math.random): GeneratedPuzzle {
  if (!GENERATION_SIZES.includes(size)) throw new RangeError("Choose a grid size from 7 through 13.");
  const regions = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const stars: StarBattleSolution = [];
  const usedColumns = new Set<number>();
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];

  // Randomized backtracking avoids getting stuck with an unusable last column.
  const placeStars = (row: number): boolean => {
    if (row === size) return true;
    const columns = Array.from({ length: size }, (_, column) => column);
    for (let index = columns.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [columns[index], columns[other]] = [columns[other], columns[index]];
    }
    for (const column of columns) {
      if (usedColumns.has(column) || (row > 0 && Math.abs(stars[row - 1][1] - column) <= 1)) continue;
      stars.push([row, column]);
      usedColumns.add(column);
      if (placeStars(row + 1)) return true;
      stars.pop();
      usedColumns.delete(column);
    }
    return false;
  };
  if (!placeStars(0)) throw new Error("Could not place non-touching stars.");

  const grid = new Uint8Array(size * size);
  const regionSizes = new Uint16Array(size).fill(1);
  stars.forEach(([row, column], index) => { grid[row * size + column] = index + 1; });
  let neighbors = neighborCache.get(size);
  if (!neighbors) {
    neighbors = Array.from({ length: size * size }, (_, cell) => {
      const row = Math.floor(cell / size), column = cell % size;
      return [row > 0 ? cell - size : -1, row < size - 1 ? cell + size : -1,
        column > 0 ? cell - 1 : -1, column < size - 1 ? cell + 1 : -1].filter(next => next >= 0);
    });
    neighborCache.set(size, neighbors);
  }
  const freeNeighbors = Uint8Array.from(neighbors.map(cells => cells.filter(cell => grid[cell] === 0).length));
  let remaining = size * size - size;
  const frontiers = stars.map(([r, c]) => new Set([r * size + c]));
  const weights = new Float64Array(size);
  while (remaining > 0) {
    // Condition the original region/cell sampling on a successful growth step.
    let totalWeight = 0;
    for (let i = 0; i < size; i += 1) { weights[i] = frontiers[i].size / regionSizes[i]; totalWeight += weights[i]; }
    let draw = random() * totalWeight;
    let index = 0;
    while (index < size - 1 && draw >= weights[index]) { draw -= weights[index]; index += 1; }
    const cell = pick([...frontiers[index]]);
    const claimed = pick(neighbors[cell].filter(next => grid[next] === 0));
    grid[claimed] = index + 1;
    regionSizes[index] += 1;
    if (freeNeighbors[claimed]) frontiers[index].add(claimed);
    for (const next of neighbors[claimed]) {
      freeNeighbors[next] -= 1;
      if (grid[next] && freeNeighbors[next] === 0) frontiers[grid[next] - 1].delete(next);
    }
    remaining -= 1;
  }
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) regions[r][c] = grid[r * size + c];
  return { regions, stars };
}
