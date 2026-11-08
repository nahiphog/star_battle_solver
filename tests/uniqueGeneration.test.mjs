import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePuzzle } from '../src/lib/puzzleGeneration.ts';
import { findAlternative, generateUniquePuzzle, repairBoundary, seededRandom } from '../src/lib/uniqueGeneration.ts';
import { solveStarBattleOne } from '../src/lib/starBattle.ts';

function assertValid(puzzle) {
  const { regions, stars } = puzzle, n = regions.length;
  assert.equal(new Set(stars.map(([r, c]) => regions[r][c])).size, n);
  assert.equal(new Set(stars.map(([r]) => r)).size, n);
  assert.equal(new Set(stars.map(([, c]) => c)).size, n);
  for (let i = 0; i < n; i++) {
    for (const [r, c] of stars.slice(i + 1)) assert.ok(Math.abs(r - stars[i][0]) > 1 || Math.abs(c - stars[i][1]) > 1);
  }
  for (const [r, c] of stars) {
    const region = regions[r][c], stack = [[r, c]], seen = new Set();
    while (stack.length) {
      const [sr, sc] = stack.pop(), key = sr * n + sc;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [nr, nc] of [[sr - 1, sc], [sr + 1, sc], [sr, sc - 1], [sr, sc + 1]]) {
        if (regions[nr]?.[nc] === region) stack.push([nr, nc]);
      }
    }
    assert.equal(seen.size, regions.flat().filter(value => value === region).length);
  }
}

test('checker agrees with reference solver on 175 seeded grids', () => {
  for (let n = 7; n <= 13; n++) for (let seed = 1; seed <= 25; seed++) {
    const puzzle = generatePuzzle(n, seededRandom(seed));
    const check = findAlternative(puzzle);
    assert.equal(check.status, solveStarBattleOne(puzzle.regions).length === 1 ? 'unique' : 'multiple');
    if (check.alternative) {
      assert.notDeepEqual(check.alternative, puzzle.stars);
      assertValid({ ...puzzle, stars: check.alternative });
    }
  }
});

test('budget exhaustion is unknown, never unique; expired generation returns no puzzle', () => {
  const puzzle = generatePuzzle(7, seededRandom(1));
  assert.equal(findAlternative(puzzle, 0).status, 'unknown');
  assert.equal(findAlternative(puzzle, Infinity, 0).status, 'unknown');
  assert.equal(generateUniquePuzzle(7, { deadline: 0 }).puzzle, null);
  assert.throws(() => findAlternative({ ...puzzle, stars: [] }), /valid known solution/);
});

test('unique and non-unique fixtures remain correct under board symmetries', () => {
  const stars = [[0, 1], [1, 3], [2, 0], [3, 2]];
  const unique = Array.from({ length: 4 }, () => Array(4).fill(4));
  stars.slice(0, 3).forEach(([r, c], i) => { unique[r][c] = i + 1; });
  const multiple = Array.from({ length: 4 }, (_, r) => Array(4).fill(r + 1));
  for (const [regions, expected] of [[unique, 'unique'], [multiple, 'multiple']]) {
    for (let rotation = 0; rotation < 4; rotation++) for (const reflect of [false, true]) {
      const transform = ([row, col]) => {
        let r = row, c = reflect ? 3 - col : col;
        for (let i = 0; i < rotation; i++) [r, c] = [c, 3 - r];
        return [r, c];
      };
      const transformed = Array.from({ length: 4 }, () => Array(4));
      regions.forEach((row, r) => row.forEach((id, c) => { const [nr, nc] = transform([r,c]); transformed[nr][nc] = id; }));
      const puzzle = { regions: transformed, stars: stars.map(transform) };
      assert.equal(findAlternative(puzzle).status, expected);
      assert.equal(solveStarBattleOne(transformed).length, expected === 'unique' ? 1 : 2);
    }
  }
});

test('boundary repairs preserve invariants and reject all remembered alternatives', () => {
  const random = seededRandom(42), puzzle = generatePuzzle(13, random), witnesses = [];
  let repairs = 0;
  for (let i = 0; i < 100; i++) {
    const check = findAlternative(puzzle);
    if (check.status === 'unique') break;
    witnesses.push(check.alternative);
    const before = structuredClone(puzzle);
    if (!repairBoundary(puzzle, witnesses, random)) { assert.deepEqual(puzzle, before); break; }
    repairs++;
    assert.deepEqual(puzzle.stars, before.stars);
    assertValid(puzzle);
    for (const alternative of witnesses) assert.ok(new Set(alternative.map(([r,c]) => puzzle.regions[r][c])).size < 13);
  }
  assert.ok(repairs > 0);
});

test('seeded generation is repeatable and its result is independently unique', () => {
  const first = generateUniquePuzzle(7, { random: seededRandom(130) });
  const second = generateUniquePuzzle(7, { random: seededRandom(130) });
  assert.deepEqual(first, second);
  assertValid(first.puzzle);
  assert.equal(solveStarBattleOne(first.puzzle.regions).length, 1);
});
