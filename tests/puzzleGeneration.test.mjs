import assert from "node:assert/strict";
import test from "node:test";
import { GENERATION_SIZES, generatePuzzle } from "../src/lib/puzzleGeneration.ts";

for (const size of GENERATION_SIZES) {
  test(`${size}×${size}: filled, connected regions and valid stars across 100 puzzles`, () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const { regions, stars } = generatePuzzle(size);
      assert.equal(regions.length, size);
      assert.ok(regions.every(row => row.length === size && row.every(region => region >= 1 && region <= size)));
      assert.equal(stars.length, size);
      assert.equal(new Set(stars.map(([row]) => row)).size, size);
      assert.equal(new Set(stars.map(([, column]) => column)).size, size);
      assert.equal(new Set(stars.map(([row, column]) => regions[row][column])).size, size);
      for (let i = 0; i < stars.length; i += 1) {
        for (const other of stars.slice(i + 1)) {
          assert.ok(Math.abs(stars[i][0] - other[0]) > 1 || Math.abs(stars[i][1] - other[1]) > 1);
        }
        const region = i + 1;
        const pending = [stars[i]];
        const visited = new Set();
        while (pending.length) {
          const [r, c] = pending.pop();
          const key = `${r}:${c}`;
          if (visited.has(key)) continue;
          visited.add(key);
          for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
            if (regions[nr]?.[nc] === region) pending.push([nr, nc]);
          }
        }
        assert.equal(visited.size, regions.flat().filter(value => value === region).length);
      }
    }
  });
}

test("rejects unsupported grid sizes", () => {
  for (const size of [0, 6, 14, 7.5, NaN]) assert.throws(() => generatePuzzle(size), RangeError);
});
