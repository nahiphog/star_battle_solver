import { solveWithLogicalTechniques } from "./starBattle.ts";
import { DIFFICULTY_TECHNIQUE_ORDER, summarizeDifficulty } from "./puzzleDifficulty.ts";

self.onmessage = (event: MessageEvent<number[][]>) => {
  try {
    const steps = solveWithLogicalTechniques(event.data, DIFFICULTY_TECHNIQUE_ORDER);
    self.postMessage(summarizeDifficulty(event.data.length, steps));
  } catch {
    self.postMessage({ label: "Unrated", explanation: "Difficulty analysis could not be completed.", steps: 0, techniques: [] });
  }
};
