import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ThemedDleGame } from '../../packages/server/src/games/themedDle.js';

// Every cell of every registered 3×3 grid must be feasible — i.e. have at
// least one matching entry in the production roster. New grids (added 2026-05-16)
// are held to a stricter ≥2 bar so players have a choice; the original
// "friend-night-v1" grids predate that rule and are allowed tight cells
// (e.g. Pink × Gym-Leader = only Mr. Mime).

const STRICT_MIN = 2;       // for new grids — keeps cells interesting
const LEGACY_MIN = 1;       // for friend-night-v1 grids — feasibility only
const LEGACY_GRID_IDS = new Set(['friend-night-v1']);

const pokemonRoster = JSON.parse(
  readFileSync(new URL('../../packages/server/src/data/pokedle/pokemon.json', import.meta.url), 'utf8')
);
const hpRoster = JSON.parse(
  readFileSync(new URL('../../packages/server/src/data/hpdle/characters.json', import.meta.url), 'utf8')
);

function makeGame(theme) {
  const players = new Map([['p0', { name: 'A', socketId: 's0', connected: true, score: 0 }]]);
  const io = { emit: () => {}, sockets: { sockets: new Map() } };
  const gameState = { players };
  const gameEngine = { broadcastPlayerList: () => {}, endGame: () => {} };
  // modes: ['grid'] keeps the game tiny but the constructor still needs a valid theme.
  return new ThemedDleGame(gameState, io, gameEngine, { theme, modes: ['grid'] });
}

function gridsFor(theme) {
  // The grid pool lives module-private inside themedDle.js. We can't reach it
  // directly, so we call _setupGrid in a loop and collect distinct grids by id.
  const game = makeGame(theme);
  const seen = new Map();
  // 60 attempts is enough to hit a 3-entry pool with very high probability
  // (1 - (2/3)^60 ≈ 1 - 1e-10).
  for (let i = 0; i < 60; i++) {
    game._setupGrid();
    const id = game.grid.id || `unnamed-${i}`;
    if (!seen.has(id)) seen.set(id, game.grid);
  }
  return Array.from(seen.values());
}

function checkGrid(roster, grid, themeLabel) {
  const minCellSize = LEGACY_GRID_IDS.has(grid.id) ? LEGACY_MIN : STRICT_MIN;
  for (let r = 0; r < grid.rows.length; r++) {
    for (let c = 0; c < grid.cols.length; c++) {
      const matching = roster.filter((e) => grid.rows[r].test(e) && grid.cols[c].test(e));
      assert.ok(
        matching.length >= minCellSize,
        `[${themeLabel}/${grid.id || 'unnamed'}] cell row="${grid.rows[r].label}" × col="${grid.cols[c].label}" has only ${matching.length} answers (need ≥${minCellSize}). Matches: ${matching.map((m) => m.name).join(', ') || '(none)'}`
      );
    }
  }
}

describe('themed-dle 3×3 grid cell feasibility', () => {
  it('every pokémon grid has ≥2 valid answers per cell', () => {
    const grids = gridsFor('pokemon');
    assert.ok(grids.length >= 1, 'expected at least one pokémon grid to be registered');
    for (const g of grids) checkGrid(pokemonRoster, g, 'pokemon');
  });

  it('every HP grid has ≥2 valid answers per cell', () => {
    const grids = gridsFor('hp');
    assert.ok(grids.length >= 1, 'expected at least one HP grid to be registered');
    for (const g of grids) checkGrid(hpRoster, g, 'hp');
  });
});
