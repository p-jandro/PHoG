import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSolvedFor } from '../../packages/server/src/games/numbers.js';

describe('Numbers difficulty multiplier', () => {
  it('medium scores 1.5x easy at same time & first', () => {
    const easy = scoreSolvedFor('easy', 60000, 60000, true);
    const medium = scoreSolvedFor('medium', 60000, 60000, true);
    assert.equal(medium, Math.floor(easy * 1.5));
  });

  it('difficult scores 2.0x easy', () => {
    const easy = scoreSolvedFor('easy', 60000, 60000, true);
    const hard = scoreSolvedFor('difficult', 60000, 60000, true);
    assert.equal(hard, easy * 2);
  });

  it('easy preserves prior totals (100 base + 50 speed + 20 first = 170)', () => {
    assert.equal(scoreSolvedFor('easy', 60000, 60000, true), 170);
  });
});
