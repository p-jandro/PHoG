import assert from 'node:assert/strict';
import { ThemedDleGame } from '../../packages/server/src/games/themedDle.js';

// E7 regression: the Grid 3×3 round must short-circuit (call _endRound) the
// moment every connected player has 9 valid green placements.
//
// _checkGridAllSolved is a method on ThemedDleGame and is reachable directly.
// We instantiate the game, stub _endRound to observe invocation, and seed
// playerState by hand.

function makeGame({ playerIds = ['p1'], connected = playerIds } = {}) {
  const players = new Map();
  for (const id of playerIds) {
    players.set(id, {
      name: id.toUpperCase(),
      socketId: `sock-${id}`,
      connected: connected.includes(id),
      score: 0
    });
  }
  const io = { emit: () => {}, sockets: { sockets: new Map() } };
  const gameState = { players };
  const gameEngine = { broadcastPlayerList: () => {}, endGame: () => {} };
  const game = new ThemedDleGame(gameState, io, gameEngine, { theme: 'pokemon', modes: ['grid'] });
  game.mode = 'grid';
  game.timer = null;
  // Stub _endRound to record invocation without firing the broadcast chain
  let endCalls = 0;
  game._endRound = () => { endCalls++; };
  return { game, endCalls: () => endCalls };
}

function makeGridPs(filledCount) {
  // filledCount valid cells (1..9). Anything below 9 must NOT trigger autoend.
  const cellAnswers = {};
  let placed = 0;
  for (let r = 0; r < 3 && placed < filledCount; r++) {
    for (let c = 0; c < 3 && placed < filledCount; c++) {
      cellAnswers[`${r},${c}`] = `name-${r}-${c}`;
      placed++;
    }
  }
  // Pad up to 9 keys with nulls so the shape mirrors live state
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const k = `${r},${c}`;
      if (!(k in cellAnswers)) cellAnswers[k] = null;
    }
  }
  return { cellAnswers, usedNames: new Set(Object.values(cellAnswers).filter(Boolean)) };
}

// --- Case 1: single player, 8 valid cells → no autoend ----------------------
{
  const { game, endCalls } = makeGame({ playerIds: ['p1'] });
  game.playerState.set('p1', makeGridPs(8));
  game._checkGridAllSolved();
  assert.equal(endCalls(), 0, '8 valid cells must NOT trigger autoend');
}

// --- Case 2: single player, 9 valid cells → autoend -------------------------
{
  const { game, endCalls } = makeGame({ playerIds: ['p1'] });
  game.playerState.set('p1', makeGridPs(9));
  game._checkGridAllSolved();
  assert.equal(endCalls(), 1, '9 valid cells must trigger autoend');
}

// --- Case 3: two players, both at 9 → autoend -------------------------------
{
  const { game, endCalls } = makeGame({ playerIds: ['p1', 'p2'] });
  game.playerState.set('p1', makeGridPs(9));
  game.playerState.set('p2', makeGridPs(9));
  game._checkGridAllSolved();
  assert.equal(endCalls(), 1, 'all players at 9 must trigger autoend');
}

// --- Case 4: two players, one at 9 and one at 5 → no autoend ----------------
{
  const { game, endCalls } = makeGame({ playerIds: ['p1', 'p2'] });
  game.playerState.set('p1', makeGridPs(9));
  game.playerState.set('p2', makeGridPs(5));
  game._checkGridAllSolved();
  assert.equal(endCalls(), 0, 'one player still working must NOT trigger autoend');
}

// --- Case 5: not in grid mode → never triggers ------------------------------
{
  const { game, endCalls } = makeGame({ playerIds: ['p1'] });
  game.mode = 'classic';
  game.playerState.set('p1', makeGridPs(9));
  game._checkGridAllSolved();
  assert.equal(endCalls(), 0, 'non-grid mode must not autoend even if "9 cells"');
}

// --- Case 6: empty players → never triggers (guards against false positive) -
{
  const { game, endCalls } = makeGame({ playerIds: [] });
  game._checkGridAllSolved();
  assert.equal(endCalls(), 0, 'empty player list must not autoend');
}

console.log('grid-autoend.test.mjs PASS');
