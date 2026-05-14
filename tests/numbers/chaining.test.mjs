import assert from 'node:assert/strict';
import { NumbersGame } from '../../packages/server/src/games/numbers.js';

// F1 regression: tile-combine result must remain in the player's pool so a
// second chained operation can pick it up. Bug was that the result tile
// disappeared from the rendered pool after the first combine.

// --- Minimal harness ---------------------------------------------------------

function makeHarness() {
  const players = new Map();
  players.set('p1', { name: 'Alice', socketId: 's1', connected: true, score: 0 });

  // Capture ack payloads sent to each socket
  const acks = { p1: [] };
  const sockets = new Map();
  sockets.set('s1', {
    emit: (event, payload) => {
      if (event === 'numbers:operation:ack') acks.p1.push(payload);
    }
  });

  const ioEmits = [];
  const io = {
    emit: (event, payload) => { ioEmits.push({ event, payload }); },
    sockets: { sockets }
  };

  const gameState = { players };
  const gameEngine = {
    broadcastPlayerList: () => {},
    endGame: () => {}
  };

  return { gameState, io, gameEngine, acks, ioEmits };
}

const { gameState, io, gameEngine, acks } = makeHarness();
const game = new NumbersGame(gameState, io, gameEngine);

// Skip the intro timer: directly seed a playing round with a known tile set.
// We bypass _startRound (which generates a random puzzle) and set state manually
// so the test is deterministic.
// Use a 'seed-' prefix to avoid colliding with the game's internal
// _nextTileId() counter (which produces ids like 'seed-0', 'seed-1', ...).
const tiles = [
  { id: 'seed-0', value: 10 },
  { id: 'seed-1', value: 5 },
  { id: 'seed-2', value: 3 },
  { id: 'seed-3', value: 2 },
  { id: 'seed-4', value: 25 },
  { id: 'seed-5', value: 50 }
];
gameState.numbers.phase = 'playing';
gameState.numbers.tiles = tiles;
gameState.numbers.target = 999; // arbitrary; we don't want to trigger solved
gameState.numbers.endsAt = Date.now() + 60000;
gameState.numbers.playerStates = {
  p1: {
    pool: tiles.map((t) => ({ id: t.id, value: t.value })),
    history: [],
    solved: false,
    solvedAtMs: null,
    bestValue: null
  }
};

// --- Op 1: combine 10 + 5 = 15 ----------------------------------------------

game.handleOperation('p1', { aId: 'seed-0', op: '+', bId: 'seed-1' });

assert.equal(acks.p1.length, 1, 'first op should produce one ack');
const ack1 = acks.p1[0];
assert.equal(ack1.accepted, true, 'first op should be accepted');

// The result tile must be present in the ack payload's pool
const resultTile1 = ack1.pool.find((t) => t.value === 15);
assert.ok(resultTile1, 'combined value 15 must be in the ack pool');
assert.ok(resultTile1.id, 'result tile must have an id');
assert.equal(typeof resultTile1.id, 'string');

// The pool must also reflect this in the server state — bug was that the
// rendered pool dropped the result; server-side ps.pool is the source of truth
const ps = gameState.numbers.playerStates.p1;
assert.ok(ps.pool.find((t) => t.value === 15), 'server pool must contain 15');
assert.equal(ps.pool.length, 5, '6 tiles minus 2 consumed plus 1 result = 5');
assert.ok(!ps.pool.find((t) => t.id === 'seed-0'), 'consumed tile t0 must be gone');
assert.ok(!ps.pool.find((t) => t.id === 'seed-1'), 'consumed tile t1 must be gone');

// --- Op 2: chain — combine the new tile (15) with t2 (3) → 15 * 3 = 45 ------

const newId = resultTile1.id;
game.handleOperation('p1', { aId: newId, op: '*', bId: 'seed-2' });

assert.equal(acks.p1.length, 2, 'chained op should produce a second ack');
const ack2 = acks.p1[1];
assert.equal(ack2.accepted, true, 'chained op must be accepted — F1 regression');

const resultTile2 = ack2.pool.find((t) => t.value === 45);
assert.ok(resultTile2, 'chained result 45 must be in pool');
assert.ok(!ack2.pool.find((t) => t.id === newId), 'first-result tile consumed');
assert.ok(!ack2.pool.find((t) => t.id === 'seed-2'), 't2 consumed');
assert.equal(ack2.pool.length, 4, '5 tiles minus 2 consumed plus 1 result = 4');

// History captures the chain
assert.equal(ps.history.length, 2);
assert.equal(ps.history[0].result, 15);
assert.equal(ps.history[1].result, 45);

console.log('chaining.test.mjs PASS');
