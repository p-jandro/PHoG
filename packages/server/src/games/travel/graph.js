/**
 * Travel graph utilities — load countries, resolve names, BFS shortest path,
 * random valid-pair picker.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const data = JSON.parse(readFileSync(
  join(__dirname, '..', '..', 'data', 'travel', 'countries.json'),
  'utf-8'
));

// canonical name → entry
const COUNTRIES = new Map();
// lookup-key (lowercase canonical name + aliases) → canonical name
const LOOKUP = new Map();

for (const c of data) {
  COUNTRIES.set(c.name, c);
  LOOKUP.set(c.name.toLowerCase(), c.name);
  for (const a of (c.aliases || [])) {
    LOOKUP.set(a.toLowerCase(), c.name);
  }
}

export function resolveCountry(query) {
  if (typeof query !== 'string') return null;
  const key = query.trim().toLowerCase();
  if (!key) return null;
  return LOOKUP.get(key) || null;
}

export function neighbors(canonicalName) {
  const entry = COUNTRIES.get(canonicalName);
  return entry ? entry.borders : [];
}

export function isAdjacent(a, b) {
  const entry = COUNTRIES.get(a);
  return !!entry && entry.borders.includes(b);
}

/**
 * BFS shortest path between two canonical country names. Returns:
 *   { distance, nextOnShortestPath: Set<string> }
 * where nextOnShortestPath is the set of neighbors of `start` that lie on
 * SOME shortest path to `end`. Returns null if unreachable.
 *
 * The "next on shortest path" set is recomputed each guess in the game,
 * so a single function handles both the distance lookup AND green-vs-orange
 * coloring.
 */
export function shortestPathInfo(start, end) {
  if (start === end) return { distance: 0, nextOnShortestPath: new Set() };
  if (!COUNTRIES.has(start) || !COUNTRIES.has(end)) return null;

  // BFS forward from start
  const distFromStart = new Map();
  distFromStart.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    const d = distFromStart.get(node);
    for (const nb of neighbors(node)) {
      if (!distFromStart.has(nb)) {
        distFromStart.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }
  if (!distFromStart.has(end)) return null;
  const totalDistance = distFromStart.get(end);

  // BFS backward from end (treat the graph as undirected — borders are symmetric)
  const distFromEnd = new Map();
  distFromEnd.set(end, 0);
  const q2 = [end];
  while (q2.length) {
    const node = q2.shift();
    const d = distFromEnd.get(node);
    for (const nb of neighbors(node)) {
      if (!distFromEnd.has(nb)) {
        distFromEnd.set(nb, d + 1);
        q2.push(nb);
      }
    }
  }

  // A neighbor of `start` is "on a shortest path" iff distFromStart(nb)+distFromEnd(nb)+1 == totalDistance
  // Actually the simpler invariant: nb is the first step on SOME shortest path iff distFromEnd(nb) == totalDistance - 1.
  const nextOnShortestPath = new Set();
  for (const nb of neighbors(start)) {
    if ((distFromEnd.get(nb) ?? Infinity) === totalDistance - 1) {
      nextOnShortestPath.add(nb);
    }
  }
  return { distance: totalDistance, nextOnShortestPath };
}

/**
 * Verify that you can still reach `end` from the new chain head.
 * Returns true if a path exists (any path, not necessarily shortest).
 */
export function canReach(start, end) {
  if (start === end) return true;
  if (!COUNTRIES.has(start) || !COUNTRIES.has(end)) return false;
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    for (const nb of neighbors(node)) {
      if (nb === end) return true;
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

/**
 * Return one example shortest path from start to end (canonical names),
 * including both endpoints. Used at the round-results reveal.
 */
export function shortestPathChain(start, end) {
  if (start === end) return [start];
  const parent = new Map();
  parent.set(start, null);
  const queue = [start];
  while (queue.length) {
    const node = queue.shift();
    if (node === end) break;
    for (const nb of neighbors(node)) {
      if (!parent.has(nb)) {
        parent.set(nb, node);
        queue.push(nb);
      }
    }
  }
  if (!parent.has(end)) return null;
  const chain = [];
  let cur = end;
  while (cur !== null) {
    chain.unshift(cur);
    cur = parent.get(cur);
  }
  return chain;
}

/**
 * Pick a random valid (start, end) pair with shortest-path distance in [minHops, maxHops].
 * Tries up to `maxAttempts` random pairs; returns null on failure.
 */
export function pickRandomPair(minHops = 2, maxHops = 7, maxAttempts = 200) {
  const names = Array.from(COUNTRIES.keys()).filter((n) => COUNTRIES.get(n).borders.length > 0);
  for (let i = 0; i < maxAttempts; i++) {
    const a = names[Math.floor(Math.random() * names.length)];
    const b = names[Math.floor(Math.random() * names.length)];
    if (a === b) continue;
    const info = shortestPathInfo(a, b);
    if (info && info.distance >= minHops && info.distance <= maxHops) {
      return { start: a, end: b, distance: info.distance };
    }
  }
  return null;
}

export const ALL_COUNTRIES = Array.from(COUNTRIES.values());
