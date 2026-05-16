import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TravelGame } from '../../packages/server/src/games/travel.js';
import { EUROPE_POOL } from '../../packages/server/src/games/travel/graph.js';

function harness() {
  const players = new Map([
    ['p0', { id: 'p0', name: 'A', socketId: 's0', connected: true, score: 0 }]
  ]);
  const gameState = { players, meta: {} };
  const emitted = [];
  const io = {
    emit: (event, payload) => emitted.push({ event, payload }),
    sockets: { sockets: { get: () => null } },
    to: () => ({ emit: () => {} })
  };
  let endCalled = false;
  const engine = { broadcastPlayerList: () => {}, endGame: () => { endCalled = true; } };
  const g = new TravelGame(gameState, io, engine);
  return { g, emitted, endCalledRef: () => endCalled };
}

describe('Travel modes (Europe → World)', () => {
  it('starts with Europe mode and an in-pool pair', () => {
    const { g } = harness();
    try {
      g.start();        // emit intro, start intro timer
      g.skip();         // intro → mode intro for Europe
      assert.equal(g._currentMode(), 'europe');
      assert.equal(g.gameState.travel.phase, 'modeIntro');
      g.skip();         // mode intro → start round (picks Europe pair)
      assert.equal(g.gameState.travel.phase, 'playing');
      assert.ok(EUROPE_POOL.has(g.gameState.travel.start), `start ${g.gameState.travel.start} should be European`);
      assert.ok(EUROPE_POOL.has(g.gameState.travel.end), `end ${g.gameState.travel.end} should be European`);
    } finally { g.cleanup(); }
  });

  it('rejects non-Europe guesses during Europe round', () => {
    const { g } = harness();
    try {
      g.start(); g.skip(); g.skip();
      assert.equal(g.gameState.travel.phase, 'playing');
      const before = g.gameState.travel.players.p0.guessesUsed;
      g.handleSubmit('p0', { name: 'China' });
      assert.equal(g.gameState.travel.players.p0.guessesUsed, before,
        'a country outside the European pool must not consume a guess');
    } finally { g.cleanup(); }
  });

  it('transitions through both modes and accumulates scores', () => {
    const { g, emitted, endCalledRef } = harness();
    try {
      g.start();
      g.skip(); // intro
      g.skip(); // europe mode-intro
      assert.equal(g._currentMode(), 'europe');
      g.skip(); // europe play → europe results
      assert.equal(g.gameState.travel.phase, 'results');
      assert.equal(g.currentModeIndex, 0);
      g.skip(); // europe results → world mode-intro
      assert.equal(g._currentMode(), 'world');
      assert.equal(g.gameState.travel.phase, 'modeIntro');
      g.skip(); // world mode-intro → world play
      g.skip(); // world play → world results
      assert.equal(g.gameState.travel.phase, 'results');
      g.skip(); // world results → endGame
      assert.equal(endCalledRef(), true);

      const results = emitted.filter((e) => e.event === 'travel:round:results');
      assert.equal(results.length, 2);
      assert.equal(results[0].payload.mode, 'europe');
      assert.equal(results[0].payload.isLastMode, false);
      assert.equal(results[0].payload.multiplier, 0.5);
      assert.equal(results[1].payload.mode, 'world');
      assert.equal(results[1].payload.isLastMode, true);
      assert.equal(results[1].payload.multiplier, 1);
    } finally { g.cleanup(); }
  });

  it('Europe round scores at 0.5×, World at 1.0×', () => {
    const { g } = harness();
    try {
      // Pretend the player solved both rounds with raw=100 and we want to confirm
      // scaling is applied to modeScore + cumulative.
      g.start(); g.skip(); g.skip();
      const europeStart = g.gameState.travel.start;
      const europeEnd = g.gameState.travel.end;
      // Mark the player as solved with a fixed scoring profile by injecting state
      g.gameState.travel.players.p0.solved = true;
      g.gameState.travel.players.p0.solvedAtMs = g.phaseStartMs; // remainingMs = full
      // chain length == optimal (matching optimal => +30; solved at start => +20 speed; first => +10)
      const dist = g.gameState.travel.optimalDistance;
      g.gameState.travel.players.p0.frontChain = Array.from({ length: dist + 1 }, (_, i) => ({ name: i === 0 ? europeStart : i === dist ? europeEnd : `step${i}` }));
      g.gameState.travel.players.p0.backChain = [{ name: europeEnd }];
      g.firstSolverId = 'p0';

      g.skip(); // europe play → europe results: should compute and store modeScore
      const europeModeScore = g.cumulativeScores.get('p0');
      // raw = 50+30+20+10 = 110; ×0.5 = 55
      assert.equal(europeModeScore, 55, `Europe modeScore should be 55, got ${europeModeScore}`);
    } finally { g.cleanup(); }
  });
});
