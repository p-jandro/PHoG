import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ThemedDleGame } from '../../packages/server/src/games/themedDle.js';

// E4 regression:
//   - MAX_GUESSES was raised from 6 to 10
//   - Scoring caps at guess 6: guesses 7..10 score 0 even when solved
//   - Guesses 1..6 score positive when solved
//
// Neither MAX_GUESSES nor scoreClassic/scoreSilhouette are exported from
// themedDle.js, so we exercise the behavior two ways:
//   1. A textual assertion that the source defines MAX_GUESSES = 10
//      (sentinel constant — a regression to 6 would flip this immediately)
//   2. A behavioral assertion via ThemedDleGame._computeScore over guess counts
//      1..10, mirroring the live scoring path in _endRound().

// --- (1) Source-level sentinel ----------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourcePath = join(__dirname, '..', '..', 'packages', 'server', 'src', 'games', 'themedDle.js');
const source = readFileSync(sourcePath, 'utf8');
assert.match(source, /const\s+MAX_GUESSES\s*=\s*10\b/, 'MAX_GUESSES must be 10');
assert.match(source, /const\s+SCORING_GUESS_CAP\s*=\s*6\b/, 'SCORING_GUESS_CAP must be 6');

// --- (2) Behavioral test via _computeScore ----------------------------------

// Minimal mock environment for the constructor. We use the 'pokemon' theme
// because it can play 'classic' and 'silhouette' modes — both governed by the
// same guess-cap rule.
function makeGame(mode) {
  const players = new Map();
  players.set('p1', { name: 'A', socketId: 's1', connected: true, score: 0 });
  const io = { emit: () => {}, sockets: { sockets: new Map() } };
  const gameState = { players };
  const gameEngine = { broadcastPlayerList: () => {}, endGame: () => {} };
  const game = new ThemedDleGame(gameState, io, gameEngine, { theme: 'pokemon', modes: [mode] });
  // Fake the round state that _computeScore reads
  game.mode = mode;
  game.phaseEndsAt = Date.now() + 60000;
  return game;
}

function makePs(guessCount, solved) {
  // _computeScore reads ps.guesses.length, ps.solved, ps.solvedAt
  const guesses = [];
  for (let i = 0; i < guessCount; i++) guesses.push({ name: `g${i}` });
  return {
    guesses,
    solved,
    solvedAt: Date.now(),
    emojiRevealCount: 1,
    hintsUsed: 0
  };
}

for (const mode of ['classic', 'silhouette']) {
  const game = makeGame(mode);

  // Solving on guesses 1..6 → positive score
  for (let n = 1; n <= 6; n++) {
    const score = game._computeScore(makePs(n, true));
    assert.ok(score > 0, `${mode}: solving on guess ${n} should score >0 (got ${score})`);
  }

  // Solving on guesses 7..10 → zero score (still solved, but past the cap)
  for (let n = 7; n <= 10; n++) {
    const score = game._computeScore(makePs(n, true));
    assert.equal(score, 0, `${mode}: solving on guess ${n} should score 0 (got ${score})`);
  }

  // Sanity: unsolved scores 0 regardless of guess count
  assert.equal(game._computeScore(makePs(3, false)), 0, `${mode}: unsolved → 0`);
  assert.equal(game._computeScore(makePs(10, false)), 0, `${mode}: unsolved → 0`);
}

// Scoring is monotonically non-increasing across guesses 1..6 (efficiency drops)
{
  const game = makeGame('classic');
  let prev = Infinity;
  for (let n = 1; n <= 6; n++) {
    const s = game._computeScore(makePs(n, true));
    assert.ok(s <= prev, `classic: guess ${n} score (${s}) should be ≤ guess ${n - 1} (${prev})`);
    prev = s;
  }
}

console.log('scoring.test.mjs PASS');
