import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PointlessGame } from '../../packages/server/src/games/pointless.js';

function makeHarness(playerNames) {
  const players = new Map(playerNames.map((n, i) => [
    `p${i}`, { id: `p${i}`, name: n, socketId: `s${i}`, score: 0, connected: true }
  ]));
  const gameState = { players, meta: {} };
  const emitted = [];
  const io = {
    emit: (ev, payload) => emitted.push({ ev, payload }),
    sockets: { sockets: { get: () => ({ emit: () => {} }) } },
    to: () => ({ emit: () => {} })
  };
  const engine = { broadcastPlayerList: () => {} };
  const g = new PointlessGame(gameState, io, engine);
  return { g, emitted };
}

describe('Pointless early-end', () => {
  it('ends round when every connected player has submitted', (t) => {
    const { g } = makeHarness(['Alice', 'Bob']);
    g.gameState.pointless.phase = 'playing';
    g.gameState.pointless.roundIndex = 0;
    g.gameState.pointless.currentRound = { id: 'r0', category: 'Test', question: 'Q?' };
    g.gameState.pointless.startTime = Date.now();
    try {
      g.submitAnswer('p0', 'anything');
      assert.equal(g.gameState.pointless.phase, 'playing', 'should still be playing after first submit');
      g.submitAnswer('p1', 'anything');
      assert.notEqual(g.gameState.pointless.phase, 'playing', 'should leave playing once all submitted');
    } finally {
      g.cleanup();
    }
  });
});
