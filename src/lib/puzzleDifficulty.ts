import type { LogicalStep } from "./starBattle";

// Fixed simplest-first order makes ratings independent of the user's walkthrough order.
export const DIFFICULTY_TECHNIQUE_ORDER = [
  "Forced star", "Full-unit visibility", "Line–region accounting",
  "Forced-chain propagation", "Reframed regions", "Contradiction",
  "X-wing / four-corner contradiction",
];
const LEVELS = ["Easy", "Medium", "Hard", "Expert"] as const;
const TECHNIQUE_LEVEL: Record<string, number> = {
  "Forced star": 0,
  "Full-unit visibility": 1,
  "Line–region accounting": 1,
  "Forced-chain propagation": 2,
  "Reframed regions": 2,
  "Contradiction": 3,
  "X-wing / four-corner contradiction": 3,
};
export type DifficultyRating = {
  label: typeof LEVELS[number] | "Unrated";
  explanation: string;
  steps: number;
  techniques: { name: string; count: number }[];
};
export function summarizeDifficulty(size: number, steps: LogicalStep[]): DifficultyRating {
  const counts = new Map<string, number>();
  for (const step of steps) for (const name of step.technique.split(" + ")) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const techniques = [...counts].map(([name, count]) => ({ name, count }));
  const complete = size > 0 && steps.at(-1)?.stars.length === size;
  if (!complete || techniques.some(({ name }) => TECHNIQUE_LEVEL[name] === undefined)) {
    return { label: "Unrated", explanation: complete ? "The solve used a technique without a difficulty classification." : "The available techniques did not complete the puzzle; its difficulty is not established.", steps: steps.length, techniques };
  }
  const hardest = Math.max(...techniques.map(({ name }) => TECHNIQUE_LEVEL[name]));
  const hardestNames = techniques.filter(({ name }) => TECHNIQUE_LEVEL[name] === hardest).map(({ name }) => name);
  return { label: LEVELS[hardest], explanation: `Hardest technique${hardestNames.length === 1 ? "" : "s"} used: ${hardestNames.join(", ")}.`, steps: steps.length, techniques };
}
