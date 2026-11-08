// Frozen pre-optimization generator for reproducible comparisons.
import type { StarBattleSolution } from "../src/lib/starBattle";

export const GENERATION_SIZES = [7, 8, 9, 10, 11, 12, 13];
export type GeneratedPuzzle = { regions: number[][]; stars: StarBattleSolution };

export function generatePuzzle(size: number): GeneratedPuzzle {
  if (!GENERATION_SIZES.includes(size)) throw new RangeError("Choose a grid size from 7 through 13.");
  const regions = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const stars: StarBattleSolution = [];
  const usedColumns = new Set<number>();
  const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

  // Randomized backtracking avoids getting stuck with an unusable last column.
  const placeStars = (row: number): boolean => {
    if (row === size) return true;
    const columns = Array.from({ length: size }, (_, column) => column);
    for (let index = columns.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
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

  const cellsByRegion = stars.map(([row, column], index) => {
    regions[row][column] = index + 1;
    return [[row, column] as [number, number]];
  });
  let remaining = size * size - size;
  while (remaining > 0) {
    const cells = pick(cellsByRegion);
    const [row, column] = pick(cells);
    const neighbors: [number, number][] = [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]];
    const unclaimed = neighbors.filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size && regions[r][c] === 0);
    if (!unclaimed.length) continue;
    const [r, c] = pick(unclaimed);
    regions[r][c] = regions[row][column];
    cells.push([r, c]);
    remaining -= 1;
  }
  return { regions, stars };
}
