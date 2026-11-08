import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, arch } from 'node:os';
import { generatePuzzle as baselineGenerate } from './baselineGeneration.ts';
import { generatePuzzle } from '../src/lib/puzzleGeneration.ts';
import { findAlternative, generateUniquePuzzle, seededRandom } from '../src/lib/uniqueGeneration.ts';
import { solveStarBattleOne } from '../src/lib/starBattle.ts';

const budgetMs = Number(process.env.BENCHMARK_MS ?? 10000);
const seeds = [130, 2026, 8675309];
if (!isMainThread) {
  const { size, seed, mode } = workerData, random = seededRandom(seed);
  // Warm up each implementation before the timed trial, with a separate seed.
  const warm = generatePuzzle(7, seededRandom(1));
  findAlternative(warm); solveStarBattleOne(warm.regions);
  Math.random = random;
  const start = performance.now(), deadline = start + budgetMs;
  let result;
  if (mode === 'optimized') {
    result = generateUniquePuzzle(size, { random, deadline });
  } else {
    let attempts = 0, puzzle = null;
    while (performance.now() < deadline) {
      const candidate = baselineGenerate(size); attempts++;
      if (solveStarBattleOne(candidate.regions, 2).length === 1) { puzzle = candidate; break; }
    }
    result = { puzzle, stats: { attempts } };
  }
  const elapsedMs = performance.now() - start;
  // Validation is outside the measured generation interval.
  if (result.puzzle && solveStarBattleOne(result.puzzle.regions, 2).length !== 1) throw new Error('Non-unique benchmark result');
  parentPort.postMessage({ mode, size, seed, elapsedMs, completed: Boolean(result.puzzle), ...result.stats });
} else {
  const results = [];
  const previous = process.env.REUSE_BASELINE === '1' ? JSON.parse(readFileSync('benchmarks/results/generation.json', 'utf8')) : null;
  if (previous && (previous.budgetMs !== budgetMs || previous.node !== process.version || previous.cpu !== cpus()[0].model)) throw new Error('Baseline machine/runtime/budget mismatch');
  const run = (job) => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: job });
    const timer = setTimeout(() => { worker.terminate(); resolve({ ...job, completed: false, elapsedMs: budgetMs, hardTimeout: true }); }, budgetMs + 5000);
    worker.once('message', result => { clearTimeout(timer); worker.terminate(); resolve(result); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
  });
  for (let size = 7; size <= 13; size++) for (const seed of seeds) {
    // Alternate execution order to reduce systematic warm-up/order bias.
    for (const mode of seed % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']) {
      const cached = mode === 'baseline' ? previous?.results.find(r => r.mode === mode && r.size === size && r.seed === seed) : null;
      const result = cached ?? await run({ mode, size, seed });
      results.push(result);
      console.log(`${mode} ${size}×${size} seed ${seed}: ${result.completed ? `${result.elapsedMs.toFixed(1)} ms` : 'timeout'} (${result.attempts ?? '?'} starts)`);
    }
  }
  const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
  const summary = Array.from({ length: 7 }, (_, i) => {
    const size = i + 7;
    const baseline = results.filter(r => r.size === size && r.mode === 'baseline');
    const optimized = results.filter(r => r.size === size && r.mode === 'optimized');
    return { size, baselineCompleted: baseline.filter(r => r.completed).length, optimizedCompleted: optimized.filter(r => r.completed).length,
      baselineCappedMedianMs: median(baseline.map(r => Math.min(r.elapsedMs, budgetMs))),
      optimizedCappedMedianMs: median(optimized.map(r => Math.min(r.elapsedMs, budgetMs))) };
  });
  // Same-input microbenchmark isolates checker speed from candidate quality.
  const phases = [];
  for (let size = 7; size <= 13; size++) {
    const sample = Array.from({ length: 100 }, (_, i) => generatePuzzle(size, seededRandom(i + 1)));
    const time = fn => { const start = performance.now(); fn(); return performance.now() - start; };
    phases.push({ size, samples: sample.length,
      baselineCheckMs: time(() => sample.forEach(p => solveStarBattleOne(p.regions, 2))),
      optimizedCheckMs: time(() => sample.forEach(p => findAlternative(p))),
      baselineGrowthMs: time(() => { Math.random = seededRandom(42); for (let i=0;i<100;i++) baselineGenerate(size); }),
      optimizedGrowthMs: time(() => { const random = seededRandom(42); for (let i=0;i<100;i++) generatePuzzle(size, random); }),
    });
  }
  const report = { date: '2026-11-08', node: process.version, platform: `${platform()} ${arch()}`, cpu: cpus()[0].model, reusedBaseline: Boolean(previous), budgetMs, seeds, summary, phases, results };
  mkdirSync('benchmarks/results', { recursive: true });
  writeFileSync('benchmarks/results/generation.json', JSON.stringify(report, null, 2) + '\n');
  console.table(summary);
  console.table(phases);
}
