import assert from 'node:assert/strict';
import { colorGuess, isAllowedGuess, pickRandomAnswer, cumulativeKeyboardState }
  from '../../packages/server/src/games/wordle/coloring.js';

// Exact match → all green
assert.deepEqual(colorGuess('glass', 'glass'), ['green', 'green', 'green', 'green', 'green']);

// Spec's worked example: ALLOY vs GLASS → yellow, green, grey, grey, grey
assert.deepEqual(colorGuess('alloy', 'glass'), ['yellow', 'green', 'grey', 'grey', 'grey']);

// LEVEL vs HOTEL → trailing E green, trailing L green, earlier E/L grey (both consumed by greens)
assert.deepEqual(colorGuess('level', 'hotel'), ['grey', 'grey', 'grey', 'green', 'green']);

// CLEAN vs CHILL → one L yellow (pos 1), answer's 2 Ls don't cause extra yellow
assert.deepEqual(colorGuess('clean', 'chill'), ['green', 'yellow', 'grey', 'grey', 'grey']);

// All-grey miss
assert.deepEqual(colorGuess('aaaaa', 'bcdef'), ['grey', 'grey', 'grey', 'grey', 'grey']);

// Allowed-guesses set is loaded and contains a known answer + a known extra
assert.equal(isAllowedGuess('crane'), true);
assert.equal(isAllowedGuess('aalii'), true);  // valid guess, not an answer
assert.equal(isAllowedGuess('zzzzz'), false);
assert.equal(isAllowedGuess('CRANE'), true);  // case-insensitive

// pickRandomAnswer returns a 5-letter lowercase string from the answer pool
const ans = pickRandomAnswer();
assert.equal(typeof ans, 'string');
assert.equal(ans.length, 5);
assert.equal(ans, ans.toLowerCase());

// cumulativeKeyboardState — green wins over yellow, yellow over grey
const state = cumulativeKeyboardState([
  { guess: 'abcde', colors: ['grey', 'grey', 'grey', 'grey', 'grey'] },
  { guess: 'apple', colors: ['green', 'grey', 'yellow', 'grey', 'green'] }
]);
assert.equal(state['a'], 'green');
assert.equal(state['p'], 'yellow');
assert.equal(state['l'], 'grey');
assert.equal(state['e'], 'green');

console.log('coloring.test.mjs PASS');
