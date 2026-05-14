/**
 * QA 2026-05-14 scoring audit: Silhouette and Spell should reward strong play
 * more than Classic does (harder modes), and Grid per-cell value is capped so
 * a low-player Grid run can't dwarf the cumulative Pokédle/HP-dle total.
 *
 * Tests behavioral max scores via _computeScore (private but stable).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ThemedDleGame } from '../../packages/server/src/games/themedDle.js';

function makeGame(theme, mode) {
  const players = new Map();
  players.set('p1', { name: 'A', socketId: 's1', connected: true, score: 0 });
  const io = { emit: () => {}, sockets: { sockets: new Map() } };
  const gameState = { players };
  const gameEngine = { broadcastPlayerList: () => {}, endGame: () => {} };
  const g = new ThemedDleGame(gameState, io, gameEngine, { theme, modes: [mode] });
  g.mode = mode;
  // Set phaseEndsAt so timeRemainingMs == totalMs (full speed bonus).
  const dur = mode === 'spell' ? 100000 : 100000;
  g.phaseStartAt = Date.now();
  g.phaseEndsAt = g.phaseStartAt + dur;
  return g;
}

function ps(guessCount, hintsUsed = 0) {
  const guesses = [];
  for (let i = 0; i < guessCount; i++) guesses.push({ name: `g${i}` });
  return {
    guesses,
    solved: true,
    solvedAt: Date.now(), // == phaseStart → ~full speed bonus
    emojiRevealCount: 1,
    hintsUsed
  };
}

describe('Pokédle mode weighting (Classic vs Silhouette)', () => {
  it('a perfect Silhouette outscores a perfect Classic', () => {
    const classicGame = makeGame('pokemon', 'classic');
    const silGame = makeGame('pokemon', 'silhouette');
    const classicMax = classicGame._computeScore(ps(1));
    const silMax = silGame._computeScore(ps(1));
    assert.ok(silMax > classicMax,
      `Silhouette max (${silMax}) must outscore Classic max (${classicMax})`);
  });

  it('Silhouette ceiling is roughly 285 (130 + 125 + 30)', () => {
    const g = makeGame('pokemon', 'silhouette');
    const score = g._computeScore(ps(1));
    assert.ok(score >= 280 && score <= 290, `expected ~285, got ${score}`);
  });
});

describe('HP-dle mode weighting (Classic vs Spell)', () => {
  it('a perfect Spell outscores a perfect Classic', () => {
    const classicGame = makeGame('hp', 'classic');
    const spellGame = makeGame('hp', 'spell');
    // Spell needs the round target set up. We can't actually run _setupSpell
    // without data, but _computeScore doesn't need the spell target — it just
    // reads ps.hintsUsed.
    const classicMax = classicGame._computeScore(ps(1));
    const spellMax = spellGame._computeScore(ps(1, 0));
    assert.ok(spellMax > classicMax,
      `Spell max (${spellMax}) must outscore Classic max (${classicMax})`);
  });
});

describe('Grid per-cell cap', () => {
  it('solo player gets at most 50 per fully-matched cell (was 100)', async () => {
    // Pull the named scoring helper indirectly: load the module and look for
    // the per-cell value via a single-player grid. Easiest path: spin up a
    // grid round and call _scoreGrid with a 9-cell pool.
    const g = makeGame('pokemon', 'grid');
    g.grid = { rows: [{}, {}, {}], cols: [{}, {}, {}] };
    g.playerState.set('p1', {
      cellAnswers: {
        '0,0': 'A','0,1': 'B','0,2': 'C',
        '1,0': 'D','1,1': 'E','1,2': 'F',
        '2,0': 'G','2,1': 'H','2,2': 'I'
      },
      usedNames: new Set()
    });
    const score = g._scoreGrid(g.playerState.get('p1'));
    // 9 cells × 50 each = 450 max
    assert.equal(score, 450, `solo grid max should be 450 (got ${score})`);
  });
});
