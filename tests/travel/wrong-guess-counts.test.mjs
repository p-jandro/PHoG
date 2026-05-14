import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TravelGame } from '../../packages/server/src/games/travel.js';

function harness() {
  const players = new Map([
    ['p0', { id: 'p0', name: 'A', socketId: 's0', connected: true, score: 0 }]
  ]);
  const gameState = { players, meta: {} };
  const io = {
    emit: () => {},
    sockets: { sockets: { get: () => null } },
    to: () => ({ emit: () => {} })
  };
  const engine = { broadcastPlayerList: () => {}, endGame: () => {} };
  return new TravelGame(gameState, io, engine);
}

describe('Travle wrong-guess counts', () => {
  it('non-adjacent guesses consume a guess', () => {
    const g = harness();
    g.gameState.travel.phase = 'playing';
    g.gameState.travel.maxGuesses = 5;
    g.gameState.travel.players.p0 = {
      frontChain: [{ name: 'Spain', iso: 'ESP' }],
      backChain: [{ name: 'Greece', iso: 'GRC' }],
      history: [],
      solved: false,
      solvedAtMs: null,
      guessesUsed: 0
    };
    // Russia borders neither Spain nor Greece — recognized country, non-adjacent.
    g.handleSubmit('p0', { name: 'Russia' });
    assert.equal(g.gameState.travel.players.p0.guessesUsed, 1, 'non-adjacent should still count');
    assert.equal(g.gameState.travel.players.p0.history.length, 1, 'history records the wrong guess');
    assert.equal(g.gameState.travel.players.p0.history[0].color, 'red');
  });
});
