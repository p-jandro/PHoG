import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PointlessGame } from '../../packages/server/src/games/pointless.js';

describe('Pointless host privacy', () => {
  it('does not broadcast pointless:reveal:players globally — host never sees it', () => {
    const broadcastEmits = [];
    const players = new Map([
      ['p0', { id: 'p0', name: 'A', socketId: 's0', connected: true, score: 0 }]
    ]);
    const gameState = { players, meta: { hostSocketId: 'host' } };
    const io = {
      emit: (ev, _payload) => {
        if (ev === 'pointless:reveal:players') broadcastEmits.push(ev);
      },
      to: () => ({ emit: () => {} }),
      sockets: { sockets: { get: () => ({ emit: () => {} }) } }
    };
    const engine = { broadcastPlayerList: () => {} };
    const g = new PointlessGame(gameState, io, engine);

    g.gameState.pointless.phase = 'reveal';
    g.gameState.pointless.answers.set('p0', {
      text: 'cat',
      displayText: 'Cat',
      originalInput: 'cat',
      score: 50,
      isCorrect: true
    });

    try {
      g.revealResults();
      assert.equal(broadcastEmits.length, 0, 'reveal:players must NOT be broadcast globally');
    } finally {
      g.cleanup();
    }
  });
});
