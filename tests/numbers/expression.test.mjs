import assert from 'node:assert/strict';
import { evaluate, literalsFitTiles } from '../../packages/server/src/games/numbers/expression.js';

// Basic arithmetic
assert.deepEqual(evaluate('1+2'), { ok: true, value: 3, literals: [1, 2] });
assert.deepEqual(evaluate('100 - 1'), { ok: true, value: 99, literals: [100, 1] });
assert.deepEqual(evaluate('(75 + 25) * 7'), { ok: true, value: 700, literals: [75, 25, 7] });

// Precedence
assert.equal(evaluate('2 + 3 * 4').value, 14);

// Reject fractional intermediate
const fracResult = evaluate('10 / 3');
assert.equal(fracResult.ok, false);
assert.ok(/non-integer division/i.test(fracResult.error));

// Reject negative intermediate
const negResult = evaluate('3 - 5');
assert.equal(negResult.ok, false);
assert.ok(/negative/i.test(negResult.error));

// Reject negative even inside a paren
assert.equal(evaluate('10 * (3 - 5)').ok, false);

// Multiplied negative trick still rejected
assert.equal(evaluate('5 * (2 - 3)').ok, false);

// literals tracking
const r = evaluate('(75 + 25) * 7 - 4');
assert.equal(r.ok, true);
assert.equal(r.value, 696);
assert.deepEqual(r.literals.slice().sort((a, b) => a - b), [4, 7, 25, 75]);

// Tile-fit check
assert.equal(literalsFitTiles([7, 25, 75, 4], [75, 25, 7, 4, 50, 100]), true);
// Reusing a tile not in the pool
assert.equal(literalsFitTiles([7, 7], [75, 25, 7, 4, 50, 100]), false);
// Reusing a small twice when it appears twice in the pool — ok
assert.equal(literalsFitTiles([3, 3], [3, 3, 5, 5, 50, 75]), true);
// Tile not drawn at all
assert.equal(literalsFitTiles([9], [3, 3, 5, 5, 50, 75]), false);

console.log('expression.test.mjs PASS');
