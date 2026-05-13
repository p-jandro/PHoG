import assert from 'node:assert/strict';
import { drawTiles, drawTarget } from '../../packages/server/src/games/numbers/tiles.js';

// 100 draws should always produce exactly 6 tiles, all in the legal pool.
const POOL = new Set([25, 50, 75, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
for (let i = 0; i < 100; i++) {
  const t = drawTiles();
  assert.equal(t.length, 6, `draw produced ${t.length} tiles`);
  for (const v of t) assert.ok(POOL.has(v), `unexpected tile ${v}`);
  // No more than one of each large
  for (const L of [25, 50, 75, 100]) {
    assert.ok(t.filter((x) => x === L).length <= 1, `>1 of large tile ${L}`);
  }
  // No more than two of each small
  for (let s = 1; s <= 10; s++) {
    assert.ok(t.filter((x) => x === s).length <= 2, `>2 of small tile ${s}`);
  }
}

// Targets are in range
for (let i = 0; i < 100; i++) {
  const t = drawTarget();
  assert.ok(t >= 100 && t <= 999, `target ${t} out of range`);
  assert.equal(Number.isInteger(t), true);
}

console.log('tiles.test.mjs PASS');
