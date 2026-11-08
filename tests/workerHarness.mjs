import { parentPort } from 'node:worker_threads';
import { seededRandom } from '../src/lib/uniqueGeneration.ts';
Math.random = seededRandom(130);
globalThis.self = { postMessage: message => parentPort.postMessage(message) };
await import('../src/lib/puzzleGeneration.worker.ts');
parentPort.on('message', data => self.onmessage({ data }));
