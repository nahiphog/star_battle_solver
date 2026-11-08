import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';
import { solveStarBattleOne } from '../src/lib/starBattle.ts';

test('production worker returns a verified unique puzzle and reports invalid sizes', async () => {
  for (const size of [7, 6]) {
    const worker = new Worker(new URL('./workerHarness.mjs', import.meta.url));
    try {
      const message = await new Promise((resolve, reject) => {
        worker.on('message', data => { if (data.puzzle || data.error) resolve(data); });
        worker.on('error', reject);
        worker.postMessage(size);
      });
      if (size === 7) {
        assert.equal(solveStarBattleOne(message.puzzle.regions).length, 1);
        assert.ok(message.repairs > 0);
      } else assert.match(message.error, /grid size/);
    } finally { await worker.terminate(); }
  }
});

test('terminating a generation worker prevents further results', async () => {
  const worker = new Worker(new URL('./workerHarness.mjs', import.meta.url));
  let afterTermination = 0, terminated = false;
  worker.on('message', () => { if (terminated) afterTermination++; });
  worker.postMessage(13);
  await worker.terminate();
  terminated = true;
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(afterTermination, 0);
});
