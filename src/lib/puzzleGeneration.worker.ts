import { generateUniquePuzzle } from "./uniqueGeneration.ts";

self.onmessage = (event: MessageEvent<number>) => {
  try {
    const { puzzle, stats } = generateUniquePuzzle(event.data, {
      onProgress: progress => self.postMessage(progress),
    });
    self.postMessage({ puzzle, ...stats });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Puzzle generation failed." });
  }
};
