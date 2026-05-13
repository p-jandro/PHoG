/**
 * Exhaustive solver for Numbers Round.
 *
 * Approach: subset DP. For each non-empty subset of the 6 tiles, store a map
 * { value → expressionString } of reachable values using exactly those tiles.
 * Build up size 1, then size 2 by combining size-1 + size-1, etc.
 *
 * For 6 tiles there are 2^6 - 1 = 63 non-empty subsets; the partition count is
 * small enough that the whole computation finishes in low milliseconds.
 *
 * Constraint: every intermediate value must be a non-negative integer
 * (same as the player's evaluator).
 */

function disjointPairs(subset) {
  // yield (a, b) such that a | b == subset, a & b == 0, both nonzero, a < b
  // (ordering avoids double-counting symmetric pairs)
  const pairs = [];
  for (let a = (subset - 1) & subset; a > 0; a = (a - 1) & subset) {
    const b = subset & ~a;
    if (b > a) pairs.push([a, b]);
  }
  return pairs;
}

function combine(va, vb) {
  // returns array of [resultValue, opChar] tuples for legal binary ops between va and vb
  const out = [];
  // commutative ops: emit one direction only (a + b, a * b)
  out.push([va + vb, '+']);
  out.push([va * vb, '*']);
  // a - b (must be > 0; we allow non-negative but result 0 is allowed)
  if (va > vb) out.push([va - vb, '-']);
  else if (vb > va) out.push([vb - va, '-rev']);
  // (allow va === vb but va - vb = 0 — okay, but the result 0 isn't useful and breaks future divs)
  // division: a/b or b/a if divides evenly and result > 1 (result of 1 wastes a tile)
  if (vb !== 0 && va % vb === 0 && va / vb > 1) out.push([va / vb, '/']);
  if (va !== 0 && vb % va === 0 && vb / va > 1) out.push([vb / va, '/rev']);
  return out;
}

function expr(opCh, ea, eb) {
  if (opCh === '+') return `(${ea}+${eb})`;
  if (opCh === '*') return `(${ea}*${eb})`;
  if (opCh === '-') return `(${ea}-${eb})`;
  if (opCh === '-rev') return `(${eb}-${ea})`;
  if (opCh === '/') return `(${ea}/${eb})`;
  if (opCh === '/rev') return `(${eb}/${ea})`;
  throw new Error('bad op');
}

function build(tiles) {
  // table[subset] = Map<value, expressionString>
  const n = tiles.length;
  const total = 1 << n;
  const table = new Array(total);
  for (let s = 0; s < total; s++) table[s] = new Map();

  // size 1
  for (let i = 0; i < n; i++) {
    const subset = 1 << i;
    table[subset].set(tiles[i], String(tiles[i]));
  }
  // sizes 2..n
  for (let subset = 1; subset < total; subset++) {
    if (table[subset].size > 0) continue; // already filled (size 1)
    for (const [a, b] of disjointPairs(subset)) {
      const ma = table[a];
      const mb = table[b];
      if (!ma || !mb || ma.size === 0 || mb.size === 0) continue;
      for (const [va, ea] of ma) {
        for (const [vb, eb] of mb) {
          for (const [vr, opCh] of combine(va, vb)) {
            if (!table[subset].has(vr)) {
              table[subset].set(vr, expr(opCh, ea, eb));
            }
          }
        }
      }
    }
  }
  return table;
}

export function canHitTarget(tiles, target) {
  const table = build(tiles);
  for (let s = 1; s < table.length; s++) {
    if (table[s].has(target)) return true;
  }
  return false;
}

/**
 * Build a "no-division" DP table — same algorithm as build() but the combine
 * step never emits division results. Used by classifyDifficulty.
 */
function buildNoDiv(tiles) {
  const n = tiles.length;
  const total = 1 << n;
  const table = new Array(total);
  for (let s = 0; s < total; s++) table[s] = new Set();

  // size 1
  for (let i = 0; i < n; i++) {
    table[1 << i].add(tiles[i]);
  }
  // sizes 2..n
  for (let subset = 1; subset < total; subset++) {
    if (table[subset].size > 0) continue;
    for (const [a, b] of disjointPairs(subset)) {
      const sa = table[a];
      const sb = table[b];
      if (!sa || !sb || sa.size === 0 || sb.size === 0) continue;
      for (const va of sa) {
        for (const vb of sb) {
          table[subset].add(va + vb);
          table[subset].add(va * vb);
          if (va > vb) table[subset].add(va - vb);
          else if (vb > va) table[subset].add(vb - va);
        }
      }
    }
  }
  return table;
}

/**
 * Build a full DP table that stores only values (Set), not expressions.
 * Faster than build() when we only need reachability.
 */
function buildFull(tiles) {
  const n = tiles.length;
  const total = 1 << n;
  const table = new Array(total);
  for (let s = 0; s < total; s++) table[s] = new Set();

  for (let i = 0; i < n; i++) {
    table[1 << i].add(tiles[i]);
  }
  for (let subset = 1; subset < total; subset++) {
    if (table[subset].size > 0) continue;
    for (const [a, b] of disjointPairs(subset)) {
      const sa = table[a];
      const sb = table[b];
      if (!sa || !sb || sa.size === 0 || sb.size === 0) continue;
      for (const va of sa) {
        for (const vb of sb) {
          table[subset].add(va + vb);
          table[subset].add(va * vb);
          if (va > vb) table[subset].add(va - vb);
          else if (vb > va) table[subset].add(vb - va);
          if (vb !== 0 && va % vb === 0 && va / vb > 1) table[subset].add(va / vb);
          if (va !== 0 && vb % va === 0 && vb / va > 1) table[subset].add(vb / va);
        }
      }
    }
  }
  return table;
}

/**
 * Popcount — number of set bits (= number of tiles in the subset).
 */
function popcount(n) {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

/**
 * classifyDifficulty(tiles, target) → 'easy' | 'medium' | 'difficult'
 *
 * Rules (applied in priority order):
 *   difficult: target >= 850
 *             OR target is reachable ONLY with all 6 tiles (never in a subset ≤5)
 *             OR target requires division (reachable in fullTable but NOT in noDivTable)
 *   easy:     target ≤ 500
 *             AND target is reachable in a subset of size ≤ 3 (i.e. one or two ops)
 *             AND target is reachable somewhere in noDivTable (any subset size)
 *   medium:   everything else that is reachable
 *
 * "Easy" is intentionally tight: a human should be able to solve it with one
 * or two mental operations on modest numbers. Anything that needs three or
 * more ops or a target above 500 falls to medium even if it's technically
 * solvable without division.
 *
 * Returns 'medium' if target is not reachable at all (caller should avoid this).
 */
export function classifyDifficulty(tiles, target) {
  const n = tiles.length;
  const total = 1 << n;

  const fullTable = buildFull(tiles);
  const noDivTable = buildNoDiv(tiles);

  // Check reachability in full table
  let reachable = false;
  let reachableInTinySubset = false; // subset of size ≤ 3 (≤ 2 ops)
  let reachableInSubsetLessThan6 = false; // subset of size ≤ 5
  for (let s = 1; s < total; s++) {
    if (fullTable[s].has(target)) {
      reachable = true;
      const sz = popcount(s);
      if (sz <= 3) reachableInTinySubset = true;
      if (sz < n) reachableInSubsetLessThan6 = true;
    }
  }

  if (!reachable) return 'medium'; // degenerate — shouldn't happen if canHitTarget pre-filtered

  // Check no-division reachability
  let reachableWithoutDiv = false;
  for (let s = 1; s < total; s++) {
    if (noDivTable[s].has(target)) {
      reachableWithoutDiv = true;
      break;
    }
  }

  // Difficult conditions
  if (target >= 850) return 'difficult';
  if (!reachableInSubsetLessThan6) return 'difficult'; // requires all 6 tiles
  if (!reachableWithoutDiv) return 'difficult';         // requires division

  // Easy: small target, small subset, no division needed
  if (target <= 500 && reachableInTinySubset && reachableWithoutDiv) return 'easy';

  return 'medium';
}

export function findOptimal(tiles, target) {
  // Return { found: boolean, distance: number, expression: string }
  // where 'optimal' means the smallest |reachable - target|.
  const table = build(tiles);
  let best = { distance: Infinity, value: null, expression: null };
  for (let s = 1; s < table.length; s++) {
    for (const [v, e] of table[s]) {
      const d = Math.abs(v - target);
      if (d < best.distance) best = { distance: d, value: v, expression: e };
      if (d === 0) return { found: true, distance: 0, value: v, expression: e };
    }
  }
  return { found: best.distance === 0, distance: best.distance, value: best.value, expression: best.expression };
}
