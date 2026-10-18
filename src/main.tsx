import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Check, Clipboard, Download, RotateCcw } from "lucide-react";
import { gridString, matrixString, solveStarBattleOne, solveWithLogicalTechniques, type StarBattleSolution } from "./lib/starBattle";
import "./styles.css";

// Kept in the same order as Star Battle Studio's published REGION_PALETTE.
const PALETTE = ["#7b7ac6", "#887360", "#8ba065", "#b48664", "#ceb46a", "#b1727a", "#8094cf", "#909b9f", "#b4735a", "#8860b6"];
const makeGrid = (size: number) => Array.from({ length: size }, () => Array<number>(size).fill(0));
const DEFAULT_REGIONS = [
  [1, 2, 2, 2, 2, 2, 3],
  [1, 4, 4, 4, 4, 2, 3],
  [1, 4, 5, 4, 4, 2, 3],
  [1, 4, 4, 6, 6, 2, 2],
  [1, 4, 4, 6, 6, 2, 2],
  [1, 1, 1, 1, 1, 7, 7],
  [1, 1, 1, 1, 1, 7, 7],
];
const cloneDefaultRegions = () => DEFAULT_REGIONS.map((row) => [...row]);
type Technique = { name: string; tally: number; meaning: string };
type Coordinate = [number, number];
type WalkthroughHighlights = { rows?: number[]; columns?: number[]; regions?: number[]; cells?: Coordinate[]; reframedCells?: Coordinate[]; reframedGroups?: Coordinate[][] };
type WalkthroughStep = { technique: string; detail: string; highlights?: WalkthroughHighlights };
type WalkthroughSnapshot = { stars: StarBattleSolution; deductions: StarBattleSolution };
type Page = "backtracking" | "techniques" | "technique-list";
const routeToPage = (path: string): Page => path === "/solve_via_backtracking" ? "backtracking" : path === "/technique_list" ? "technique-list" : "techniques";
const pageToRoute: Record<Page, string> = { backtracking: "/solve_via_backtracking", techniques: "/solve_with_given_techniques", "technique-list": "/technique_list" };

// GitHub Pages is a static host. Its 404 page saves a direct-link route here
// before returning visitors to the Vite entry point, so refreshes still work.
const githubPagesRedirect = sessionStorage.getItem("star-battle-pages-redirect");
if (githubPagesRedirect) {
  sessionStorage.removeItem("star-battle-pages-redirect");
  window.history.replaceState({}, "", githubPagesRedirect);
}
const DEFAULT_TECHNIQUES: Technique[] = [
  { name: "Forced star", tally: 21, meaning: "A row, column, region, or intersection has only one viable place left for its required star." },
  { name: "Full-unit visibility", tally: 56, meaning: "A known star placement or allocation covers every remaining candidate in a region, row, or column, so those cells become Xs." },
  { name: "Line–region accounting", tally: 34, meaning: "Count stars across several rows/columns, subtract the stars reserved for identified regions, and constrain or eliminate the remainder." },
  { name: "Forced-chain propagation", tally: 17, meaning: "One forced star triggers a cascade of later forced placements and eliminations." },
  { name: "Reframed regions", tally: 9, meaning: "Combine or partition portions of ordinary regions into a derived shape with a known star count." },
  { name: "Contradiction", tally: 7, meaning: "Assume a candidate is a star, follow the consequences, and reject it because another region/line becomes impossible or stars would touch." },
  { name: "X-wing / four-corner contradiction", tally: 1, meaning: "The special four-corner pattern used in Rated G: any candidate in the pattern causes a contradictory chain." },
];
const DEFAULT_WALKTHROUGH: WalkthroughStep[] = [
  { technique: "Initial grid", detail: "This is the starting position. No stars or Xs have been placed yet." },
  { technique: "Forced star", detail: "R3C3 is the only possible star cell in region [[region:5]]. Place the star; 16 Xs are added.", highlights: { regions: [5], cells: [[2, 2]] } },
  { technique: "Full-unit visibility", detail: "Column 1 needs one star, and its remaining candidate belongs to region [[region:1]]. 6 Xs are added.", highlights: { columns: [0], regions: [1] } },
  { technique: "Full-unit visibility", detail: "Column 7 needs one star in region [[region:3]]. 4 Xs are added.", highlights: { columns: [6], regions: [3] } },
  { technique: "Full-unit visibility", detail: "Column 6 needs one star in region [[region:7]]. 4 Xs are added.", highlights: { columns: [5], regions: [7] } },
  { technique: "Full-unit visibility", detail: "The star in region [[region:2]] must be in row 1. 2 Xs are added.", highlights: { rows: [0], regions: [2] } },
  { technique: "Forced star", detail: "R2C7 is now the only remaining cell in region [[region:3]]. Place the star; 2 Xs are added.", highlights: { regions: [3], cells: [[1, 6]] } },
  { technique: "Forced star", detail: "R5C2 is now the only remaining cell in region [[region:4]]. Place the star; 6 Xs are added.", highlights: { regions: [4], cells: [[4, 1]] } },
  { technique: "Forced star", detail: "R4C5 is now the only remaining cell in region [[region:6]]. Place the star; 1 X is added.", highlights: { regions: [6], cells: [[3, 4]] } },
  { technique: "Forced star", detail: "R1C4 is now the only remaining cell in region [[region:2]], so place the star.", highlights: { regions: [2], cells: [[0, 3]] } },
  { technique: "Forced star", detail: "R7C1 is now the only remaining cell in region [[region:1]]. Place the star; 1 X is added.", highlights: { regions: [1], cells: [[6, 0]] } },
  { technique: "Forced star", detail: "R6C6 is the final remaining cell in region [[region:7]]. Place the star: the puzzle is solved.", highlights: { regions: [7], cells: [[5, 5]] } },
];
const DEFAULT_SNAPSHOTS: WalkthroughSnapshot[] = [
  { stars: [], deductions: [] },
  { stars: [[2, 2]], deductions: [] },
  { stars: [[2, 2]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4]] },
  { stars: [[2, 2]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6]] },
  { stars: [[2, 2]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5]] },
  { stars: [[2, 2]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
  { stars: [[2, 2], [1, 6]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
  { stars: [[2, 2], [1, 6], [4, 1]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
  { stars: [[2, 2], [1, 6], [4, 1], [3, 4]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
  { stars: [[2, 2], [1, 6], [4, 1], [3, 4], [0, 3]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
  { stars: [[2, 2], [1, 6], [4, 1], [3, 4], [0, 3], [6, 0]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
  { stars: [[2, 2], [1, 6], [4, 1], [3, 4], [0, 3], [6, 0], [5, 5]], deductions: [[5, 1], [5, 3], [5, 4], [6, 1], [6, 3], [6, 4], [3, 6], [4, 6], [5, 6], [6, 6], [0, 5], [1, 5], [3, 5], [4, 5], [0, 0], [0, 6]] },
];

function download(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

function SolutionGrid({ regions, solution, label }: { regions: number[][]; solution: StarBattleSolution; label: string }) {
  const starSet = new Set(solution.map(([row, column]) => `${row}:${column}`));
  return <section className="solution-card">
    <h3>{label}</h3>
    <div className="solution-grid" style={{ gridTemplateColumns: `repeat(${regions.length}, 1fr)` }} aria-label={label}>
      {regions.flatMap((row, r) => row.map((region, c) => <div key={`${r}-${c}`} className="cell result-cell" style={{ background: PALETTE[(region - 1) % PALETTE.length] }}>{starSet.has(`${r}:${c}`) ? "★" : ""}</div>))}
    </div>
  </section>;
}

function eliminatedCells(regions: number[][], snapshot: WalkthroughSnapshot) {
  const placed = snapshot.stars;
  const eliminated = new Set<string>();
  placed.forEach(([row, column]) => {
    for (let index = 0; index < regions.length; index += 1) {
      eliminated.add(`${row}:${index}`); eliminated.add(`${index}:${column}`);
      for (let otherColumn = 0; otherColumn < regions.length; otherColumn += 1) if (regions[index][otherColumn] === regions[row][column]) eliminated.add(`${index}:${otherColumn}`);
    }
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const nearRow = row + rowOffset; const nearColumn = column + columnOffset;
      if (nearRow >= 0 && nearRow < regions.length && nearColumn >= 0 && nearColumn < regions.length) eliminated.add(`${nearRow}:${nearColumn}`);
    }
  });
  snapshot.deductions.forEach(([row, column]) => eliminated.add(`${row}:${column}`));
  return eliminated;
}

function WalkthroughDetail({ detail }: { detail: string }): ReactNode {
  const pieces: ReactNode[] = [];
  const token = /\[\[region:(\d+)\]\]/g;
  let start = 0;
  for (const match of detail.matchAll(token)) {
    pieces.push(detail.slice(start, match.index));
    const region = Number(match[1]);
    pieces.push(<span key={`${match.index}-${region}`} className="region-swatch" style={{ background: PALETTE[(region - 1) % PALETTE.length] }} aria-label="highlighted region" title="Highlighted region" />);
    start = (match.index ?? 0) + match[0].length;
  }
  pieces.push(detail.slice(start));
  return pieces;
}

function WalkthroughGrid({ regions, snapshot, previousSnapshot, highlights, technique }: { regions: number[][]; snapshot: WalkthroughSnapshot; previousSnapshot?: WalkthroughSnapshot; highlights?: WalkthroughHighlights; technique?: string }) {
  const stars = new Set(snapshot.stars.map(([row, column]) => `${row}:${column}`));
  const priorStars = new Set((previousSnapshot?.stars ?? []).map(([row, column]) => `${row}:${column}`));
  const eliminated = eliminatedCells(regions, snapshot);
  const priorEliminated = previousSnapshot ? eliminatedCells(regions, previousSnapshot) : new Set<string>();
  const highlightedRows = new Set(highlights?.rows ?? []);
  const highlightedColumns = new Set(highlights?.columns ?? []);
  const highlightedRegions = new Set(highlights?.regions ?? []);
  const highlightedCells = new Set((highlights?.cells ?? []).map(([row, column]) => `${row}:${column}`));
  const reframedGroupByCell = new Map<string, number>();
  const reframedGroups = highlights?.reframedGroups ?? (highlights?.reframedCells ? [highlights.reframedCells] : []);
  reframedGroups.forEach((group, groupIndex) => group.forEach(([row, column]) => reframedGroupByCell.set(`${row}:${column}`, groupIndex)));
  return <div className="walkthrough-board">
    <div className="column-arrows" style={{ gridTemplateColumns: `repeat(${regions.length}, 1fr)` }} aria-hidden="true">{[...highlightedColumns].map((column) => <span key={column} style={{ gridColumn: column + 1 }}>↓</span>)}</div>
    <div className="column-labels" style={{ gridTemplateColumns: `repeat(${regions.length}, 1fr)` }} aria-label="Column numbers">{regions[0].map((_, column) => <span key={column}>{column + 1}</span>)}</div>
    <div className="row-arrows" style={{ gridTemplateRows: `repeat(${regions.length}, 1fr)` }} aria-hidden="true">{[...highlightedRows].map((row) => <span key={row} style={{ gridRow: row + 1 }}>→</span>)}</div>
    <div className="row-labels" style={{ gridTemplateRows: `repeat(${regions.length}, 1fr)` }} aria-label="Row numbers">{regions.map((_, row) => <span key={row}>{row + 1}</span>)}</div>
    <div className="walkthrough-grid" style={{ gridTemplateColumns: `repeat(${regions.length}, 1fr)` }} aria-label="Walkthrough board state">
      {regions.flatMap((row, r) => row.map((region, c) => {
      const key = `${r}:${c}`;
      const isStar = stars.has(key);
      const isNew = isStar ? !priorStars.has(key) : eliminated.has(key) && !priorEliminated.has(key);
      const isHighlighted = highlightedRows.has(r) || highlightedColumns.has(c) || highlightedRegions.has(region) || highlightedCells.has(key);
      const reframedGroup = reframedGroupByCell.get(key);
      const isReframedCell = reframedGroup !== undefined;
      return <div key={key} className={`cell snapshot-cell ${isHighlighted ? "highlighted-unit" : ""} ${isReframedCell ? `reframed-cell reframed-group-${reframedGroup % 4}` : ""} ${isStar || eliminated.has(key) ? isNew ? "new-mark" : "past-mark" : ""}`} style={{ background: PALETTE[(region - 1) % PALETTE.length] }}>{isReframedCell && <svg className="squiggle-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Squiggly reframed-region outline ${reframedGroup + 1}`}><path d="M4 8 Q12 2 20 8 T36 8 T52 8 T68 8 T84 8 T96 8 L96 92 Q88 98 80 92 T64 92 T48 92 T32 92 T16 92 T4 92 L4 8" /></svg>}{isStar ? "★" : eliminated.has(key) ? "×" : ""}</div>;
      }))}
    </div>
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>(() => routeToPage(window.location.pathname));
  const [size, setSize] = useState(7);
  const [regions, setRegions] = useState(cloneDefaultRegions);
  const [solutions, setSolutions] = useState<StarBattleSolution[] | null>(null);
  const [message, setMessage] = useState("Paint each cell with a region number, then solve.");
  const [copied, setCopied] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState(1);
  const [techniques, setTechniques] = useState(DEFAULT_TECHNIQUES);
  const [walkthrough, setWalkthrough] = useState<WalkthroughStep[]>([]);
  const [walkthroughSnapshots, setWalkthroughSnapshots] = useState<WalkthroughSnapshot[]>([]);
  const [walkthroughProgress, setWalkthroughProgress] = useState(0);
  const regionCount = useMemo(() => new Set(regions.flat().filter(Boolean)).size, [regions]);
  const walkthroughTally = useMemo(() => [...walkthrough.reduce((counts, step) => {
    if (step.technique !== "Initial grid") for (const technique of step.technique.split(" + ")) counts.set(technique, (counts.get(technique) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries()], [walkthrough]);
  const navigate = (nextPage: Page) => { window.history.pushState({}, "", pageToRoute[nextPage]); setPage(nextPage); };
  useEffect(() => { const onPopState = () => setPage(routeToPage(window.location.pathname)); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);

  const clearWalkthrough = () => { setWalkthrough([]); setWalkthroughSnapshots([]); setWalkthroughProgress(0); };
  const changeSize = (nextSize: number) => { setSize(nextSize); setRegions(makeGrid(nextSize)); setActiveRegion(1); setSolutions(null); clearWalkthrough(); setMessage("New blank board ready. Pick a region number, then paint its cells."); };
  const paint = (row: number, column: number) => {
    setRegions((current) => current.map((cells, r) => cells.map((value, c) => r === row && c === column ? activeRegion : value)));
    setSolutions(null);
    clearWalkthrough();
  };
  const loadRegions = (candidate: unknown) => {
    if (!Array.isArray(candidate) || candidate.length < 4 || candidate.length > 10 || !candidate.every(Array.isArray)) {
      setMessage("Import a square grid between 4×4 and 10×10."); return;
    }
    const imported = candidate.map((row) => (row as unknown[]).map(Number));
    const importedSize = imported.length;
    if (imported.some((row) => row.length !== importedSize || row.some((value) => !Number.isInteger(value) || value < 0 || value > importedSize))) {
      setMessage("Each imported row must have the same length and contain whole region IDs from 0 to the grid size."); return;
    }
    setSize(importedSize); setRegions(imported); setActiveRegion(1); setSolutions(null); clearWalkthrough(); setMessage("Grid imported. Select a region number to continue editing, or solve it.");
  };
  const importString = (value: string) => {
    const matrixRows = [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1].trim().split(/[\s,]+/).filter(Boolean).map(Number));
    const rows = matrixRows.length ? matrixRows : value.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/[\s,]+/).filter(Boolean).map(Number));
    loadRegions(rows);
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      loadRegions(Array.isArray(parsed) ? parsed : (parsed as { regions?: unknown }).regions);
    } catch { setMessage("That JSON file could not be read. Choose a grid JSON file with a regions array."); }
    event.target.value = "";
  };
  const moveTechnique = (index: number, direction: -1 | 1) => setTechniques((current) => {
    const destination = index + direction;
    if (destination < 0 || destination >= current.length) return current;
    const next = [...current];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });
  const solveWithTechniques = () => {
    if (regionCount !== size) { setMessage(`A ${size}×${size} Star Battle 1 board needs exactly ${size} regions; this grid has ${regionCount}.`); return; }
    const found = solveStarBattleOne(regions);
    setSolutions(found);
    if (!found.length) { setWalkthrough([]); setWalkthroughSnapshots([]); setMessage("No valid solution found."); return; }
    if (JSON.stringify(regions) === JSON.stringify(DEFAULT_REGIONS)) {
      setWalkthrough(DEFAULT_WALKTHROUGH);
      setWalkthroughSnapshots(DEFAULT_SNAPSHOTS);
      setWalkthroughProgress(0);
      setMessage("Unique solution found with the authored 11-step walkthrough.");
      return;
    }
    const logicalSteps = solveWithLogicalTechniques(regions, techniques.map((technique) => technique.name));
    const steps: WalkthroughStep[] = [{ technique: "Initial grid", detail: "This is the starting position. No stars or Xs have been placed yet." }, ...logicalSteps.map((step) => ({ technique: step.technique, detail: step.detail, highlights: { rows: step.rows, columns: step.columns, regions: step.regions, cells: step.cells?.map(([row, column]) => [row, column]) as Coordinate[] | undefined, reframedCells: step.reframedCells?.map(([row, column]) => [row, column]) as Coordinate[] | undefined, reframedGroups: step.reframedGroups?.map((group) => group.map(([row, column]) => [row, column]) as Coordinate[]) } }))];
    setWalkthrough(steps);
    setWalkthroughSnapshots([{ stars: [], deductions: [] }, ...logicalSteps.map((step) => ({ stars: step.stars, deductions: step.xs }))]);
    setWalkthroughProgress(0);
    const solvedLogically = logicalSteps.at(-1)?.stars.length === size;
    setMessage(solvedLogically ? (found.length === 1 ? "Unique solution found with a deduction-only walkthrough." : "Two solutions exist; this walkthrough follows valid deductions only.") : "The backtracker found a solution, but the selected logical techniques reached no further justified deduction.");
  };
  const solve = () => {
    if (regionCount !== size) { setMessage(`A ${size}×${size} Star Battle 1 board needs exactly ${size} regions; this grid has ${regionCount}.`); return; }
    const found = solveStarBattleOne(regions);
    setSolutions(found);
    setMessage(found.length === 0 ? "No valid solution found." : found.length === 1 ? "Unique solution found." : "This puzzle is not unique. Showing exactly two solutions.");
  };
  const copy = async (name: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.appendChild(fallback);
        fallback.focus(); fallback.select();
        const copied = document.execCommand("copy");
        fallback.remove();
        if (!copied) throw new Error("Clipboard copy was blocked by this browser.");
      }
      setCopied(name); setMessage(`${name === "input" ? "Input" : "Completed grid"} copied to the clipboard.`);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setMessage("Copy was blocked by this browser. Select the import/export text manually and copy it.");
    }
  };
  const inputPayload = { format: "star-battle-1/v1", size, regions };
  const solutionPayload = { ...inputPayload, status: solutions?.length === 1 ? "unique" : solutions?.length === 2 ? "multiple" : "unsolved", solutions: solutions ?? [] };

  return <main>
    <header>
      <h1>Star Battle 1 solver</h1>
      <p>Find a valid placement with one star in every row, column, and region—with no touching stars. The solver stops after two results: enough to prove whether a puzzle is unique.</p>
    </header>
    <nav className="page-nav" aria-label="Solver pages">
      <button className={page === "backtracking" ? "active-page" : ""} onClick={() => navigate("backtracking")}>Solve via backtracking</button>
      <button className={page === "techniques" ? "active-page" : ""} onClick={() => navigate("techniques")}>Solve with given techniques</button>
      <button className={page === "technique-list" ? "active-page" : ""} onClick={() => navigate("technique-list")}>Technique list</button>
    </nav>

    {page === "technique-list" && <section className="technique-page">
      <h2>Technique list</h2>
      <p>This priority list is consulted from top to bottom whenever a technique-based solve is attempted. Use the arrows to set the order you want.</p>
      <div className="technique-table-wrap"><table><thead><tr><th>Priority</th><th>Technique</th><th>What it means</th><th>Order</th></tr></thead><tbody>
        {techniques.map((technique, index) => <tr key={technique.name}><td>{index + 1}</td><td><strong>{technique.name}</strong></td><td>{technique.meaning}</td><td className="order-buttons"><button disabled={index === 0} onClick={() => moveTechnique(index, -1)} aria-label={`Move ${technique.name} up`}>↑</button><button disabled={index === techniques.length - 1} onClick={() => moveTechnique(index, 1)} aria-label={`Move ${technique.name} down`}>↓</button></td></tr>)}
      </tbody></table></div>
    </section>}

    <section className="workspace" aria-label="Puzzle input">
      <div className="toolbar">
        <label>Grid size <select value={size} onChange={(event) => changeSize(Number(event.target.value))}>{[4, 5, 6, 7, 8, 9, 10].map((value) => <option key={value} value={value}>{value} × {value}</option>)}</select></label>
        <span className="region-status">{regionCount}/{size} regions</span>
        <button className="secondary" onClick={() => { setSize(7); setRegions(cloneDefaultRegions()); setActiveRegion(1); setSolutions(null); clearWalkthrough(); setMessage("Default 7×7 puzzle restored."); }}> <RotateCcw size={16} /> Restore default grid</button>
      </div>
      <p className="hint">Pick a region number from the palette, then click its cells. Choose <strong>0</strong> to erase a cell; adjacent cells with the same colour are one region.</p>
      <div className="editor-layout">
        <div className="editor-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
          {regions.flatMap((row, r) => row.map((region, c) => <button key={`${r}-${c}`} className="cell editor-cell" onClick={() => paint(r, c)} style={{ background: region ? PALETTE[(region - 1) % PALETTE.length] : "#fff" }} aria-label={`Row ${r + 1}, column ${c + 1}, ${region ? `region ${region}` : "regionless (0)"}`}>{region}</button>))}
        </div>
        <aside className="region-picker" aria-label="Region palette">
          <h2>Fill region</h2>
          <p>Selected: <strong>{activeRegion}</strong></p>
          <div className="region-options">
            {Array.from({ length: size + 1 }, (_, region) => <button key={region} className={`region-option ${activeRegion === region ? "selected" : ""}`} onClick={() => setActiveRegion(region)} style={{ background: region ? PALETTE[(region - 1) % PALETTE.length] : "#fff" }} aria-pressed={activeRegion === region}>{region}</button>)}
          </div>
        </aside>
      </div>
      <div className="puzzle-actions">
        <button className="secondary" onClick={() => { setRegions(makeGrid(size)); setActiveRegion(1); setSolutions(null); clearWalkthrough(); setMessage("Grid reset. Every cell is now region 0."); }}>Reset grid</button>
        <button className="solve" onClick={solve}>Solve puzzle</button>
        {page === "techniques" && <button className="solve" onClick={solveWithTechniques}>Solve with this technique order</button>}
      </div>
      <p className={`status ${solutions?.length === 0 ? "error" : ""}`}>{message}</p>
    </section>

    {page === "techniques" && walkthrough.length > 0 && <section className="walkthrough technique-page">
      <h3>Interactive solution walkthrough</h3>
      <div className="technique-tally" aria-label="Techniques used"><strong>Techniques used</strong>{walkthroughTally.map(([technique, count]) => <span key={technique}>{technique}: <b>{count}</b></span>)}</div>
      <div className="walkthrough-player">
        <WalkthroughGrid regions={regions} snapshot={walkthroughSnapshots[walkthroughProgress] ?? { stars: [], deductions: [] }} previousSnapshot={walkthroughProgress > 0 ? walkthroughSnapshots[walkthroughProgress - 1] : undefined} highlights={walkthrough[walkthroughProgress].highlights} technique={walkthrough[walkthroughProgress].technique} />
        <div className="walkthrough-controls">
          <p className="step-count">Step {walkthroughProgress} of {walkthrough.length - 1}</p>
          <div className="step-buttons" aria-label="Walkthrough navigation"><button onClick={() => setWalkthroughProgress(0)} disabled={walkthroughProgress === 0} aria-label="Go to step 0">&lt;&lt;</button><button onClick={() => setWalkthroughProgress((current) => Math.max(0, current - 1))} disabled={walkthroughProgress === 0} aria-label="Go to previous step">&lt;</button><button onClick={() => setWalkthroughProgress((current) => Math.min(walkthrough.length - 1, current + 1))} disabled={walkthroughProgress === walkthrough.length - 1} aria-label="Go to next step">&gt;</button><button onClick={() => setWalkthroughProgress(walkthrough.length - 1)} disabled={walkthroughProgress === walkthrough.length - 1} aria-label="Go to last step">&gt;&gt;</button></div>
          <article><strong>“{walkthrough[walkthroughProgress].technique}”</strong><p><WalkthroughDetail detail={walkthrough[walkthroughProgress].detail} /></p></article>
          <p className="legend"><span className="new-mark-sample">★ ×</span> added this step &nbsp; <span className="past-mark-sample">★ ×</span> from an earlier step &nbsp; <span className="highlight-sample">highlighted</span> unit</p>
        </div>
      </div>
    </section>}

    <section className="exports" aria-label="Exports">
      <h2>Export</h2>
      <p>The copied input is a brace-delimited numeric matrix. The importer accepts that format as well as whitespace-delimited rows. Solved strings append <code>*</code> to star cells and <code>.</code> to empty cells.</p>
      <div className="export-actions">
        <button onClick={() => copy("input", matrixString(regions))}>{copied === "input" ? <Check size={16} /> : <Clipboard size={16} />} Copy input matrix</button>
        <button onClick={() => download("star-battle-1-input.json", inputPayload)}><Download size={16} /> Download input JSON</button>
        <button disabled={!solutions?.length} onClick={() => copy("solution", gridString(regions, solutions?.[0]))}>{copied === "solution" ? <Check size={16} /> : <Clipboard size={16} />} Copy completed string</button>
        <button disabled={!solutions?.length} onClick={() => download("star-battle-1-solutions.json", solutionPayload)}><Download size={16} /> Download completed JSON</button>
      </div>
      <div className="import-panel">
        <label htmlFor="grid-string">Import grid string or matrix</label>
        <textarea id="grid-string" placeholder={"{{1,1,2,2},\n{1,1,2,2},\n{3,3,4,4},\n{3,3,4,4}}"} rows={4} />
        <button onClick={() => importString((document.getElementById("grid-string") as HTMLTextAreaElement).value)}>Load grid</button>
        <label className="json-import">Import grid JSON <input type="file" accept="application/json,.json" onChange={importJson} /></label>
      </div>
    </section>

    {solutions && solutions.length > 0 && <section className="results"><h2>{solutions.length === 1 ? "Completed grid" : "Two possible completed grids"}</h2><div className="solutions">{solutions.map((solution, index) => <SolutionGrid key={index} regions={regions} solution={solution} label={`Solution ${index + 1}`} />)}</div></section>}
    <footer>Backtracking logic adapted from the public Solver Sanctuary implementation. Star Battle 1 only.</footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
