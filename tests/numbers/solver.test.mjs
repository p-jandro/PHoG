import assert from 'node:assert/strict';
import { canHitTarget, findOptimal } from '../../packages/server/src/games/numbers/solver.js';

// Trivial: target equals a tile
assert.equal(canHitTarget([7, 3, 1, 1, 50, 25], 50), true);

// Classic: 75, 25, 7, 4 → 696 = (75+25)*7 - 4
assert.equal(canHitTarget([75, 25, 7, 4, 50, 100], 696), true);

// Find optimal returns distance 0 for an exact case
const opt = findOptimal([75, 25, 7, 4, 50, 100], 696);
assert.equal(opt.distance, 0);
assert.equal(opt.value, 696);
assert.ok(typeof opt.expression === 'string');

// Find optimal returns small distance for an unreachable target
const opt2 = findOptimal([1, 2, 3, 4, 5, 6], 999);
assert.ok(opt2.distance > 0);

// Solver runs in reasonable time
const start = Date.now();
findOptimal([25, 50, 75, 100, 3, 9], 851);
const elapsed = Date.now() - start;
assert.ok(elapsed < 500, `solver too slow: ${elapsed}ms`);

console.log('solver.test.mjs PASS');
