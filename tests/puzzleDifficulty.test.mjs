import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeDifficulty, DIFFICULTY_TECHNIQUE_ORDER } from '../src/lib/puzzleDifficulty.ts';
import { solveWithLogicalTechniques } from '../src/lib/starBattle.ts';

const stars = [[0, 1], [1, 3], [2, 0], [3, 2]];
const step = technique => ({ technique, detail: '', stars, xs: [] });
test('rates the hardest technique used, including combined steps', () => {
  for (const [technique, expected] of [
    ['Forced star', 'Easy'], ['Full-unit visibility', 'Medium'],
    ['Line–region accounting', 'Medium'], ['Forced-chain propagation', 'Hard'],
    ['Reframed regions + Full-unit visibility', 'Hard'],
    ['Reframed regions + Line–region accounting', 'Hard'],
    ['Contradiction', 'Expert'], ['X-wing / four-corner contradiction', 'Expert'],
  ]) assert.equal(summarizeDifficulty(4, [step(technique), step('Forced star')]).label, expected);
});
test('counts techniques separately but counts a combined deduction as one step', () => {
  const result = summarizeDifficulty(4, [step('Reframed regions + Full-unit visibility'), step('Full-unit visibility')]);
  assert.equal(result.steps, 2);
  assert.deepEqual(result.techniques, [{ name: 'Reframed regions', count: 1 }, { name: 'Full-unit visibility', count: 2 }]);
});
test('incomplete and unclassified solves are unrated', () => {
  assert.equal(summarizeDifficulty(4, []).label, 'Unrated');
  assert.equal(summarizeDifficulty(4, [{ ...step('Forced star'), stars: stars.slice(0, 2) }]).label, 'Unrated');
  assert.equal(summarizeDifficulty(4, [step('Unknown technique')]).label, 'Unrated');
});
test('actual solver output produces an easy rating for a forced-star fixture', () => {
  const regions = Array.from({ length: 4 }, () => Array(4).fill(4));
  stars.slice(0, 3).forEach(([r,c], i) => { regions[r][c] = i + 1; });
  const result = summarizeDifficulty(4, solveWithLogicalTechniques(regions, DIFFICULTY_TECHNIQUE_ORDER));
  assert.equal(result.label, 'Easy');
  assert.equal(result.steps, 4);
});
