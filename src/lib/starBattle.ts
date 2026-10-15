/**
 * Star Battle backtracking solver adapted from Solver Sanctuary's public
 * `starBattleSolve` implementation. This version intentionally stops after
 * two solutions: that is sufficient to distinguish unique from non-unique
 * Star Battle 1 inputs without doing unnecessary work.
 */
export type Coordinate = readonly [row: number, column: number];
export type StarBattleSolution = Coordinate[];
export type LogicalStep = { technique: string; detail: string; stars: StarBattleSolution; xs: StarBattleSolution; rows?: number[]; columns?: number[]; regions?: number[]; cells?: Coordinate[]; reframedCells?: Coordinate[]; reframedGroups?: Coordinate[][] };

export function solveStarBattleOne(regions: number[][], maxSolutions = 2): StarBattleSolution[] {
  const size = regions.length;
  if (size < 1 || regions.some((row) => row.length !== size)) return [];

  const regionCells = new Map<number, Coordinate[]>();
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const region = regions[row][column];
      if (!Number.isInteger(region) || region < 1) return [];
      const cells = regionCells.get(region) ?? [];
      cells.push([row, column]);
      regionCells.set(region, cells);
    }
  }
  if (regionCells.size !== size) return [];

  const rowCount = Array<number>(size).fill(0);
  const columnCount = Array<number>(size).fill(0);
  const regionCount = new Map([...regionCells.keys()].map((region) => [region, 0]));
  const stars = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const solutions: StarBattleSolution[] = [];

  const canPlace = (row: number, column: number): boolean => {
    const region = regions[row][column];
    if (stars[row][column] || rowCount[row] || columnCount[column] || regionCount.get(region)) return false;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const nearbyRow = row + rowOffset;
        const nearbyColumn = column + columnOffset;
        if (nearbyRow >= 0 && nearbyRow < size && nearbyColumn >= 0 && nearbyColumn < size && stars[nearbyRow][nearbyColumn]) return false;
      }
    }
    return true;
  };

  const candidatesForRow = (row: number): Coordinate[] =>
    Array.from({ length: size }, (_, column) => [row, column] as Coordinate).filter(([r, c]) => canPlace(r, c));

  const isFeasible = (): boolean => {
    for (let row = 0; row < size; row += 1) if (!rowCount[row] && candidatesForRow(row).length === 0) return false;
    for (const [region, cells] of regionCells) {
      if (!regionCount.get(region) && !cells.some(([row, column]) => canPlace(row, column))) return false;
    }
    return true;
  };

  const visit = (): void => {
    if (solutions.length >= maxSolutions || !isFeasible()) return;
    let nextRow = -1;
    let nextCandidates: Coordinate[] = [];
    for (let row = 0; row < size; row += 1) {
      if (rowCount[row]) continue;
      const candidates = candidatesForRow(row);
      if (nextRow === -1 || candidates.length < nextCandidates.length) {
        nextRow = row;
        nextCandidates = candidates;
      }
    }
    if (nextRow === -1) {
      if (columnCount.every(Boolean) && [...regionCount.values()].every(Boolean)) {
        solutions.push(stars.flatMap((row, r) => row.flatMap((star, c) => (star ? [[r, c] as Coordinate] : []))));
      }
      return;
    }
    for (const [row, column] of nextCandidates) {
      if (!canPlace(row, column)) continue;
      const region = regions[row][column];
      stars[row][column] = true; rowCount[row] = 1; columnCount[column] = 1; regionCount.set(region, 1);
      visit();
      stars[row][column] = false; rowCount[row] = 0; columnCount[column] = 0; regionCount.set(region, 0);
      if (solutions.length >= maxSolutions) return;
    }
  };

  visit();
  return solutions;
}

/**
 * A deliberately conservative human-style solver. It records only deductions
 * that are justified by the current candidate set; unlike the backtracker, it
 * never presents a guessed solution cell as a logical placement.
 */
export function solveWithLogicalTechniques(regions: number[][], techniqueOrder: string[]): LogicalStep[] {
  const size = regions.length;
  if (!size || regions.some((row) => row.length !== size)) return [];
  const regionIds = [...new Set(regions.flat())];
  if (regionIds.length !== size || regionIds.some((id) => id < 1)) return [];
  const stars = new Set<string>();
  const xs = new Set<string>();
  const key = (row: number, column: number) => `${row}:${column}`;
  const fromKey = (value: string): Coordinate => value.split(":").map(Number) as unknown as Coordinate;
  const snapshot = () => ({ stars: [...stars].map(fromKey), xs: [...xs].map(fromKey) });
  const hasStar = (predicate: (row: number, column: number) => boolean) => [...stars].some((value) => { const [row, column] = fromKey(value); return predicate(row, column); });
  const canStar = (row: number, column: number) => {
    if (stars.has(key(row, column)) || xs.has(key(row, column))) return false;
    if (hasStar((r) => r === row) || hasStar((_, c) => c === column) || hasStar((r, c) => regions[r][c] === regions[row][column])) return false;
    return !hasStar((r, c) => Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1);
  };
  const candidates = (predicate: (row: number, column: number) => boolean) => regions.flatMap((row, r) => row.flatMap((_, c) => predicate(r, c) && canStar(r, c) ? [[r, c] as Coordinate] : []));
  const addX = (row: number, column: number) => { if (!stars.has(key(row, column))) xs.add(key(row, column)); };
  const place = (row: number, column: number) => {
    stars.add(key(row, column));
    for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) {
      if (r === row || c === column || regions[r][c] === regions[row][column] || (Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1)) addX(r, c);
    }
  };
  const unitCandidates = () => {
    const units: { name: string; kind: "row" | "column" | "region"; id: number; cells: Coordinate[] }[] = [];
    for (const region of regionIds) if (!hasStar((r, c) => regions[r][c] === region)) units.push({ name: `region [[region:${region}]]`, kind: "region", id: region, cells: candidates((r, c) => regions[r][c] === region) });
    for (let row = 0; row < size; row += 1) if (!hasStar((r) => r === row)) units.push({ name: `Row ${row + 1}`, kind: "row", id: row, cells: candidates((r) => r === row) });
    for (let column = 0; column < size; column += 1) if (!hasStar((_, c) => c === column)) units.push({ name: `Column ${column + 1}`, kind: "column", id: column, cells: candidates((_, c) => c === column) });
    return units;
  };
  const viableWith = (assumed: Coordinate) => {
    const forced = new Set(stars); const blocked = new Set(xs);
    const attempt = (row: number, column: number): boolean => {
      const current = [...forced].map(fromKey);
      if (blocked.has(key(row, column)) || current.some(([r, c]) => r === row || c === column || regions[r][c] === regions[row][column] || (Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1))) return false;
      forced.add(key(row, column));
      const remainingRows = Array.from({ length: size }, (_, r) => r).filter((r) => ![...forced].some((value) => fromKey(value)[0] === r));
      if (!remainingRows.length) return true;
      let best: Coordinate[] | undefined;
      for (const r of remainingRows) {
        const options = Array.from({ length: size }, (_, c) => [r, c] as Coordinate).filter(([rr, cc]) => !blocked.has(key(rr, cc)) && ![...forced].some((value) => { const [sr, sc] = fromKey(value); return sr === rr || sc === cc || regions[sr][sc] === regions[rr][cc] || (Math.abs(sr - rr) <= 1 && Math.abs(sc - cc) <= 1); }));
        if (!options.length) { forced.delete(key(row, column)); return false; }
        if (!best || options.length < best.length) best = options;
      }
      const result = best!.some(([rr, cc]) => attempt(rr, cc));
      forced.delete(key(row, column));
      return result;
    };
    return attempt(assumed[0], assumed[1]);
  };
  const priority = (name: string) => techniqueOrder.findIndex((entry) => entry === name);
  type UnitKind = "row" | "column" | "region";
  type ChainFailure = { forcedRegions: number[]; exhausted: { kind: UnitKind; id: number } };
  const forcedChainFailure = (assumed: Coordinate): ChainFailure | null => {
    const traceStars = new Set(stars);
    const traceXs = new Set(xs);
    const traceHasStar = (predicate: (row: number, column: number) => boolean) => [...traceStars].some((value) => { const [row, column] = fromKey(value); return predicate(row, column); });
    const traceCanStar = (row: number, column: number) => {
      if (traceStars.has(key(row, column)) || traceXs.has(key(row, column))) return false;
      if (traceHasStar((r) => r === row) || traceHasStar((_, c) => c === column) || traceHasStar((r, c) => regions[r][c] === regions[row][column])) return false;
      return !traceHasStar((r, c) => Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1);
    };
    const tracePlace = (row: number, column: number) => {
      traceStars.add(key(row, column));
      for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) {
        if (r === row || c === column || regions[r][c] === regions[row][column] || (Math.abs(r - row) <= 1 && Math.abs(c - column) <= 1)) if (!traceStars.has(key(r, c))) traceXs.add(key(r, c));
      }
    };
    if (!traceCanStar(assumed[0], assumed[1])) return null;
    tracePlace(assumed[0], assumed[1]);
    const forcedRegions: number[] = [];
    const buildTraceUnits = () => {
      const traceUnits: { kind: UnitKind; id: number; cells: Coordinate[] }[] = [];
      for (const region of regionIds) if (!traceHasStar((r, c) => regions[r][c] === region)) traceUnits.push({ kind: "region", id: region, cells: candidatesForTrace((r, c) => regions[r][c] === region) });
      for (let row = 0; row < size; row += 1) if (!traceHasStar((r) => r === row)) traceUnits.push({ kind: "row", id: row, cells: candidatesForTrace((r) => r === row) });
      for (let column = 0; column < size; column += 1) if (!traceHasStar((_, c) => c === column)) traceUnits.push({ kind: "column", id: column, cells: candidatesForTrace((_, c) => c === column) });
      return traceUnits;
    };
    const candidatesForTrace = (predicate: (row: number, column: number) => boolean) => regions.flatMap((row, r) => row.flatMap((_, c) => predicate(r, c) && traceCanStar(r, c) ? [[r, c] as Coordinate] : []));
    const chainOrder = { region: 0, row: 1, column: 2 } as const;
    for (let guard = 0; guard < size * size; guard += 1) {
      const traceUnits = buildTraceUnits();
      const exhausted = traceUnits.find((unit) => !unit.cells.length);
      if (exhausted) return { forcedRegions, exhausted: { kind: exhausted.kind, id: exhausted.id } };
      const forced = traceUnits.filter((unit) => unit.cells.length === 1).sort((left, right) => chainOrder[left.kind] - chainOrder[right.kind])[0];
      if (!forced) return null;
      if (forced.kind === "region") forcedRegions.push(forced.id);
      tracePlace(forced.cells[0][0], forced.cells[0][1]);
    }
    return null;
  };
  const sees = (from: Coordinate, target: Coordinate) => {
    const [row, column] = from; const [targetRow, targetColumn] = target;
    return row === targetRow || column === targetColumn || regions[row][column] === regions[targetRow][targetColumn] || (Math.abs(row - targetRow) <= 1 && Math.abs(column - targetColumn) <= 1);
  };
  const coordinateList = (cells: Coordinate[]) => cells.map(([row, column]) => `R${row + 1}C${column + 1}`).join(", ");
  const xAdded = (count: number) => `${count} ${count === 1 ? "X is" : "Xs are"} added.`;
  type ReframedUnit = { key: string; name: string; cells: Coordinate[]; rows: number[]; columns: number[]; relatedFrames?: Coordinate[][]; createdAt: number };
  const reframedUnits: ReframedUnit[] = [];
  const frameKey = (cells: Coordinate[]) => cells.map(([row, column]) => key(row, column)).sort().join("|");
  const adjacentComponents = (cells: Coordinate[]) => {
    const remaining = new Map(cells.map((cell) => [key(cell[0], cell[1]), cell]));
    const components: Coordinate[][] = [];
    while (remaining.size) {
      const first = remaining.values().next().value as Coordinate;
      const component: Coordinate[] = [first];
      remaining.delete(key(first[0], first[1]));
      for (let index = 0; index < component.length; index += 1) {
        const [row, column] = component[index];
        for (const [candidateKey, candidate] of remaining) {
          if (Math.abs(row - candidate[0]) + Math.abs(column - candidate[1]) !== 1) continue;
          component.push(candidate);
          remaining.delete(candidateKey);
        }
      }
      components.push(component);
    }
    return components;
  };
  const steps: LogicalStep[] = [];
  let hasReframedVisibilityDeduction = false;
  for (let guard = 0; guard < size * size * 3; guard += 1) {
    const units = unitCandidates();
    if (units.some((unit) => !unit.cells.length)) break;
    const moves: { rank: number; execute: () => LogicalStep }[] = [];
    const forcedUnitOrder = { region: 0, row: 1, column: 2 } as const;
    for (const unit of units.filter((item) => item.cells.length === 1).sort((left, right) => forcedUnitOrder[left.kind] - forcedUnitOrder[right.kind])) {
      const [row, column] = unit.cells[0];
      moves.push({ rank: priority("Forced star"), execute: () => { const before = xs.size; place(row, column); const state = snapshot(); return { technique: "Forced star", detail: `R${row + 1}C${column + 1} is the only remaining candidate in ${unit.name}, so it must contain a star. ${xAdded(xs.size - before)}`, ...state, rows: unit.kind === "row" ? [unit.id] : [], columns: unit.kind === "column" ? [unit.id] : [], regions: unit.kind === "region" ? [unit.id] : [], cells: [[row, column]] }; } });
    }
    for (const source of units) for (const target of units) {
      if (source === target || !source.cells.length || !target.cells.length) continue;
      const sourceKeys = new Set(source.cells.map(([r, c]) => key(r, c)));
      if (![...sourceKeys].every((value) => target.cells.some(([r, c]) => key(r, c) === value))) continue;
      const outside = target.cells.filter(([r, c]) => !sourceKeys.has(key(r, c)));
      if (!outside.length) continue;
      moves.push({ rank: priority("Full-unit visibility"), execute: () => {
        const seenByAll = regions.flatMap((row, r) => row.flatMap((_, c) => {
          const cell = [r, c] as Coordinate;
          return !stars.has(key(r, c)) && !xs.has(key(r, c)) && !sourceKeys.has(key(r, c)) && source.cells.every((candidate) => sees(cell, candidate)) ? [cell] : [];
        }));
        const eliminations = [...new Map([...outside, ...seenByAll].map((cell) => [key(cell[0], cell[1]), cell])).values()];
        eliminations.forEach(([row, column]) => addX(row, column));
        const state = snapshot();
        return { technique: "Full-unit visibility", detail: `${source.name} must place its star inside ${target.name}, in ${coordinateList(source.cells)}. ${xAdded(eliminations.length)}`, ...state, rows: [source, target].filter((u) => u.kind === "row").map((u) => u.id), columns: [source, target].filter((u) => u.kind === "column").map((u) => u.id), regions: [source, target].filter((u) => u.kind === "region").map((u) => u.id), cells: eliminations };
      } });
    }
    for (const source of units) {
      const sourceKeys = new Set(source.cells.map(([row, column]) => key(row, column)));
      const visibleCells = regions.flatMap((row, r) => row.flatMap((_, c) => {
        const cell = [r, c] as Coordinate;
        return !stars.has(key(r, c)) && !xs.has(key(r, c)) && !sourceKeys.has(key(r, c)) && source.cells.every((candidate) => sees(cell, candidate)) ? [cell] : [];
      }));
      if (!visibleCells.length) continue;
      moves.push({ rank: priority("Full-unit visibility"), execute: () => {
        visibleCells.forEach(([row, column]) => addX(row, column));
        const state = snapshot();
        const added = `${visibleCells.length} ${visibleCells.length === 1 ? "X is" : "Xs are"} added ${visibleCells.length === 1 ? "as it sees" : "as they each see"} all these cells.`;
        return { technique: "Full-unit visibility", detail: `${source.name} must contain its star in one of the cells (${coordinateList(source.cells)}). ${added}`, ...state, rows: source.kind === "row" ? [source.id] : [], columns: source.kind === "column" ? [source.id] : [], regions: source.kind === "region" ? [source.id] : [], cells: visibleCells };
      } });
    }
    for (const source of units.filter((unit) => unit.kind === "row" || unit.kind === "column")) {
      if (source.cells.length !== 2 || new Set(source.cells.map(([row, column]) => regions[row][column])).size < 2) continue;
      const derivedKey = frameKey(source.cells);
      if (reframedUnits.some((unit) => unit.key === derivedKey)) continue;
      reframedUnits.push({
        key: derivedKey,
        name: `the reframed region formed by ${coordinateList(source.cells)}`,
        cells: source.cells,
        rows: source.kind === "row" ? [source.id] : [],
        columns: source.kind === "column" ? [source.id] : [],
        createdAt: guard,
      });
    }
    const discoverComplementFrames = (kind: "row" | "column") => {
      const lines = units.filter((unit) => unit.kind === kind);
      const inspectSelection = (selected: typeof lines) => {
        const selectedIds = new Set(selected.map((line) => line.id));
        const containedRegions = units.filter((unit) => unit.kind === "region" && unit.cells.length > 0 && unit.cells.every(([row, column]) => selectedIds.has(kind === "row" ? row : column)));
        const containedRegionKeys = new Set(containedRegions.flatMap((region) => region.cells.map(([row, column]) => key(row, column))));
        const containedFrames = reframedUnits.filter((frame) => !frame.cells.some(([row, column]) => stars.has(key(row, column))) && frame.cells.some(([row, column]) => canStar(row, column)) && frame.cells.every(([row, column]) => selectedIds.has(kind === "row" ? row : column)) && !frame.cells.some(([row, column]) => containedRegionKeys.has(key(row, column))));
        const occupied = new Set<string>();
        for (const unit of [...containedRegions, ...containedFrames]) for (const [row, column] of unit.cells) {
          const cellKey = key(row, column);
          if (occupied.has(cellKey)) return;
          occupied.add(cellKey);
        }
        const neededStars = selected.length - containedRegions.length - containedFrames.length;
        const remainder = [...new Map(selected.flatMap((line) => line.cells).filter(([row, column]) => !occupied.has(key(row, column))).map((cell) => [key(cell[0], cell[1]), cell])).values()];
        const addFrame = (cells: Coordinate[], relatedFrames?: Coordinate[][], allowSingleRegion = false) => {
          if (!allowSingleRegion && new Set(cells.map(([row, column]) => regions[row][column])).size < 2) return;
          const derivedKey = frameKey(cells);
          const rows = kind === "row" ? selected.map((line) => line.id) : [];
          const columns = kind === "column" ? selected.map((line) => line.id) : [];
          const existing = reframedUnits.find((unit) => unit.key === derivedKey);
          if (existing) {
            // The same frame can be rediscovered after later eliminations.
            // Keep the smallest supporting line set for the walkthrough.
            if (rows.length + columns.length < existing.rows.length + existing.columns.length) {
              existing.rows = rows;
              existing.columns = columns;
              existing.relatedFrames = relatedFrames;
            }
            return;
          }
          reframedUnits.push({ key: derivedKey, name: `the reframed region formed by ${coordinateList(cells)}`, cells, rows, columns, relatedFrames, createdAt: guard });
        };
        const regionLockedKeys = new Set(containedRegions.flatMap((region) => region.cells.map(([row, column]) => key(row, column))));
        const regionRemainder = [...new Map(selected.flatMap((line) => line.cells).filter(([row, column]) => !regionLockedKeys.has(key(row, column))).map((cell) => [key(cell[0], cell[1]), cell])).values()];
        if (selected.length - containedRegions.length === 1 && regionRemainder.length >= 2) {
          // A line complement can be a meaningful one-star shape even when it
          // happens to sit within one original region.
          addFrame(regionRemainder, undefined, true);
        }
        const addCliquePartition = (cells: Coordinate[]) => {
          if (cells.length < 4 || cells.length > 12) return false;
          const partitions: Coordinate[][][] = [];
          const seenPartitions = new Set<string>();
          const isClique = (group: Coordinate[]) => group.every((cell, index) => group.slice(index + 1).every((other) => sees(cell, other)));
          const spansBothLines = (group: Coordinate[]) => new Set(group.map(([row, column]) => kind === "row" ? row : column)).size === 2;
          for (let mask = 1; mask < (1 << cells.length) - 1; mask += 1) {
            if (!(mask & 1)) continue;
            const firstGroup = cells.filter((_, index) => mask & (1 << index));
            const secondGroup = cells.filter((_, index) => !(mask & (1 << index)));
            if (firstGroup.length < 2 || secondGroup.length < 2 || !spansBothLines(firstGroup) || !spansBothLines(secondGroup) || !isClique(firstGroup) || !isClique(secondGroup)) continue;
            const partitionKey = [frameKey(firstGroup), frameKey(secondGroup)].sort().join("/");
            if (seenPartitions.has(partitionKey)) continue;
            seenPartitions.add(partitionKey);
            partitions.push([firstGroup, secondGroup]);
          }
          const visibilityScore = (frameCells: Coordinate[]) => regions.flatMap((row, r) => row.flatMap((_, c) => {
            const cell = [r, c] as Coordinate;
            return !stars.has(key(r, c)) && !xs.has(key(r, c)) && !frameCells.some(([row, column]) => row === r && column === c) && frameCells.every((candidate) => sees(cell, candidate)) ? [cell] : [];
          })).length;
          const bestPartition = partitions.sort((left, right) => right.reduce((score, frameCells) => score + visibilityScore(frameCells), 0) - left.reduce((score, frameCells) => score + visibilityScore(frameCells), 0))[0];
          bestPartition?.forEach((frameCells, index) => addFrame(frameCells, bestPartition.filter((_, otherIndex) => otherIndex !== index), true));
          return Boolean(bestPartition);
        };
        const allLineCandidates = [...new Map(selected.flatMap((line) => line.cells).map((cell) => [key(cell[0], cell[1]), cell])).values()];
        if (selected.length === 2 && addCliquePartition(allLineCandidates)) return;
        if (neededStars === 1 && remainder.length >= 2) {
          addFrame(remainder);
          return;
        }
        if (neededStars !== 2 || remainder.length < 4) return;
        addCliquePartition(remainder);
      };
      const choose = (start: number, count: number, selected: typeof lines) => {
        if (selected.length === count) { inspectSelection(selected); return; }
        for (let index = start; index <= lines.length - (count - selected.length); index += 1) choose(index + 1, count, [...selected, lines[index]]);
      };
      for (let count = 2; count <= lines.length; count += 1) choose(0, count, []);
    };
    discoverComplementFrames("row");
    discoverComplementFrames("column");
    for (const frame of reframedUnits) {
      const candidatesInFrame = frame.cells.filter(([row, column]) => canStar(row, column));
      if (candidatesInFrame.length < 2) continue;
      const relatedFrames = (frame.relatedFrames ?? []).map((cells) => cells.filter(([row, column]) => canStar(row, column))).filter((cells) => cells.length >= 2);
      const allFrames = [candidatesInFrame, ...relatedFrames];
      const protectedFrameCells = new Set(allFrames.flat().map(([row, column]) => key(row, column)));
        const focusedRows = frame.rows.length ? [...new Set(allFrames.flat().map(([row]) => row))] : [];
        const focusedColumns = frame.columns.length ? [...new Set(allFrames.flat().map(([, column]) => column))] : [];
      const visibleCells = regions.flatMap((row, r) => row.flatMap((_, c) => {
        const cell = [r, c] as Coordinate;
        return !stars.has(key(r, c)) && !xs.has(key(r, c)) && !protectedFrameCells.has(key(r, c)) && allFrames.some((frameCells) => frameCells.every((candidate) => sees(cell, candidate))) ? [cell] : [];
      }));
      if (!visibleCells.length) continue;
      moves.push({ rank: Math.max(priority("Full-unit visibility"), priority("Reframed regions")), execute: () => {
        visibleCells.forEach(([row, column]) => addX(row, column));
        hasReframedVisibilityDeduction = true;
        const state = snapshot();
        const sourceLines = [...frame.rows.map((row) => `Row ${row + 1}`), ...frame.columns.map((column) => `Column ${column + 1}`)].join(" and ");
        const frameExplanation = relatedFrames.length
          ? `${sourceLines} contain ${allFrames.length} stars in total. Their remaining candidates split into ${allFrames.map((cells) => `a reframed region (${coordinateList(cells)})`).join(" and ")}; each contains one star.`
          : `A reframed region is formed by ${coordinateList(candidatesInFrame)} and must contain one star.`;
        const added = `${visibleCells.length} ${visibleCells.length === 1 ? "X is" : "Xs are"} added ${visibleCells.length === 1 ? "as it sees" : "as they each see"} all cells in the corresponding reframed region${allFrames.length === 1 ? "" : "s"}.`;
        return { technique: "Reframed regions + Full-unit visibility", detail: `${frameExplanation} ${added}`, ...state, rows: focusedRows, columns: focusedColumns, cells: visibleCells, reframedCells: allFrames.flat(), reframedGroups: allFrames };
      } });
    }
    const addLineRegionAccounting = (kind: "row" | "column") => {
      const lines = units.filter((unit) => unit.kind === kind);
      const regionUnits = units.filter((unit) => unit.kind === "region");
      const inspectSelection = (selected: typeof lines) => {
        const selectedIds = new Set(selected.map((line) => line.id));
        const containedRegions = regionUnits.filter((region) => region.cells.length > 0 && region.cells.every(([row, column]) => selectedIds.has(kind === "row" ? row : column)));
        // Let a newly found frame settle through one visible deduction before
        // using it for a wider accounting argument.
        const candidateFrames = reframedUnits.filter((frame) => frame.createdAt < guard - 1).map((frame) => ({ ...frame, cells: frame.cells.filter(([row, column]) => canStar(row, column)) })).filter((frame) => frame.cells.length > 0 && frame.cells.every(([row, column]) => selectedIds.has(kind === "row" ? row : column)));
        // If ordinary regions already account for every star in these lines,
        // derived frames are irrelevant and must not block that simpler proof.
        const regionKeys = new Set(containedRegions.flatMap((region) => region.cells.map(([row, column]) => key(row, column))));
        const framesNeeded = selected.length - containedRegions.length;
        const selectFrames = (start: number, chosen: typeof candidateFrames, occupied: Set<string>): typeof candidateFrames | null => {
          if (chosen.length === framesNeeded) return chosen;
          for (let index = start; index < candidateFrames.length; index += 1) {
            const frame = candidateFrames[index];
            if (frame.cells.some(([row, column]) => occupied.has(key(row, column)))) continue;
            const nextOccupied = new Set(occupied);
            frame.cells.forEach(([row, column]) => nextOccupied.add(key(row, column)));
            const result = selectFrames(index + 1, [...chosen, frame], nextOccupied);
            if (result) return result;
          }
          return null;
        };
        const containedFrames = framesNeeded <= 0 ? [] : selectFrames(0, [], regionKeys) ?? [];
        if (containedRegions.length + containedFrames.length !== selected.length) return;
        const occupiedLockedCells = new Set<string>();
        const lockedUnits = [...containedRegions, ...containedFrames];
        for (const unit of lockedUnits) {
          for (const [row, column] of unit.cells) {
            const cellKey = key(row, column);
            if (occupiedLockedCells.has(cellKey)) return;
            occupiedLockedCells.add(cellKey);
          }
        }
        const lockedRegionIds = new Set(containedRegions.map((region) => region.id));
        const lockedFrameCells = new Set(containedFrames.flatMap((frame) => frame.cells.map(([row, column]) => key(row, column))));
        const eliminations = selected.flatMap((line) => line.cells).filter(([row, column]) => !lockedRegionIds.has(regions[row][column]) && !lockedFrameCells.has(key(row, column)));
        if (!eliminations.length) return;
        const usesReframedRegion = containedFrames.length > 0;
        // Show a smaller reframed-visibility deduction first when available.
        // It keeps a broad accounting sweep from concealing the shape that
        // justifies a useful earlier elimination.
        if (usesReframedRegion && !hasReframedVisibilityDeduction && selected.length >= Math.ceil(size / 2)) return;
        const techniqueRank = usesReframedRegion ? Math.max(priority("Line–region accounting"), priority("Reframed regions")) : priority("Line–region accounting");
        // Prefer a compact proof (no more than half the board) before a broad
        // sweep. Within each tier, prefer the deduction that adds more Xs,
        // then the one using fewer rows or columns.
        const broadSweepPenalty = selected.length > Math.ceil(size / 2) ? 0.5 : 0;
        const tieBreak = broadSweepPenalty + (size * size - eliminations.length * (size + 1) + selected.length) / (2 * size * size * (size + 1));
        moves.push({ rank: techniqueRank + tieBreak, execute: () => {
          eliminations.forEach(([row, column]) => addX(row, column));
          const state = snapshot();
          const lineNames = selected.map((line) => line.name).join(" and ");
          const lockedNames = [...containedRegions.map((region) => region.name), ...containedFrames.map((frame) => `the reframed region formed by ${coordinateList(frame.cells)}`)].join(" and ");
          const technique = usesReframedRegion ? "Reframed regions + Line–region accounting" : "Line–region accounting";
          const detail = usesReframedRegion
            ? `A reframed region is formed by ${containedFrames.map((frame) => coordinateList(frame.cells)).join(" and ")}. ${lineNames} contain ${selected.length} stars in total. ${lockedNames} are ${selected.length} non-overlapping one-star units within these lines. ${xAdded(eliminations.length)}`
            : `${lineNames} contain ${selected.length} stars in total. ${lockedNames} each require one star and can only place them in these lines. ${xAdded(eliminations.length)}`;
          return { technique, detail, ...state, rows: kind === "row" ? selected.map((line) => line.id) : [], columns: kind === "column" ? selected.map((line) => line.id) : [], regions: containedRegions.map((region) => region.id), cells: eliminations, reframedCells: containedFrames.flatMap((frame) => frame.cells), reframedGroups: containedFrames.map((frame) => frame.cells) };
        } });
      };
      const choose = (start: number, size: number, selected: typeof lines) => {
        if (selected.length === size) { inspectSelection(selected); return; }
        for (let index = start; index <= lines.length - (size - selected.length); index += 1) choose(index + 1, size, [...selected, lines[index]]);
      };
      for (let count = 2; count <= lines.length; count += 1) choose(0, count, []);
    };
    addLineRegionAccounting("column");
    addLineRegionAccounting("row");
    const chainGroups = new Map<string, { cells: Coordinate[]; failure: ChainFailure }>();
    const seenCandidates = new Set<string>();
    for (const unit of units) for (const cell of unit.cells) {
      const cellKey = key(cell[0], cell[1]);
      if (seenCandidates.has(cellKey)) continue;
      seenCandidates.add(cellKey);
      const failure = forcedChainFailure(cell);
      if (!failure?.forcedRegions.length || failure.exhausted.kind !== "region") continue;
      const groupKey = `${failure.forcedRegions.join(",")}:${failure.exhausted.kind}:${failure.exhausted.id}`;
      const group = chainGroups.get(groupKey) ?? { cells: [], failure };
      group.cells.push(cell);
      chainGroups.set(groupKey, group);
    }
    for (const { cells, failure } of chainGroups.values()) for (const component of adjacentComponents(cells)) {
      if (component.length < 2) continue;
      moves.push({ rank: priority("Forced-chain propagation"), execute: () => {
        component.forEach(([row, column]) => addX(row, column));
        const state = snapshot();
        const forcedRegion = failure.forcedRegions[0];
        const forcedText = failure.forcedRegions.length === 1 ? `forces a star in region [[region:${forcedRegion}]]` : `forces stars in regions ${failure.forcedRegions.map((region) => `[[region:${region}]]`).join(", ")}`;
        return { technique: "Forced-chain propagation", detail: `Any star in (${coordinateList(component)}) ${forcedText}, leaving region [[region:${failure.exhausted.id}]] with no possible star. ${xAdded(component.length)}`, ...state, regions: [...new Set([...failure.forcedRegions, failure.exhausted.id])], cells: component };
      } });
    }
    if (!moves.length) {
      const candidate = units.flatMap((unit) => unit.cells).find(([row, column]) => !viableWith([row, column]));
      if (candidate) {
        const [row, column] = candidate; addX(row, column); const state = snapshot();
        steps.push({ technique: "Contradiction", detail: `Assuming a star at R${row + 1}C${column + 1} leaves no valid completion, so R${row + 1}C${column + 1} is an X.`, ...state, rows: [row], columns: [column], regions: [regions[row][column]], cells: [[row, column]] });
        continue;
      }
      break;
    }
    moves.sort((a, b) => a.rank - b.rank);
    steps.push(moves[0].execute());
  }
  return steps;
}

export function gridString(regions: number[][], solution?: StarBattleSolution): string {
  if (!solution) return regions.map((row) => row.join(" ")).join("\n");
  const stars = new Set(solution.map(([row, column]) => `${row}:${column}`));
  return regions.map((row, r) => row.map((region, c) => `${region}${stars.has(`${r}:${c}`) ? "*" : "."}`).join(" ")).join("\n");
}

/** Brace-delimited matrix form, convenient for pasting into code or solvers. */
export function matrixString(regions: number[][]): string {
  return `{{${regions.map((row) => row.join(",")).join("},\n{")}}}`;
}
