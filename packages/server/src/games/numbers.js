/**
 * Numbers Round game module — 3-round tile-pool builder.
 *
 * Session shape:
 *   1 game = 3 rounds at escalating difficulty: easy → medium → difficult.
 *   Each round: 8s intro → 60s playing → 8s results.
 *
 * Per-round scoring (server-authoritative):
 *   solved: 100 base + speed bonus (up to +50) + first-solver bonus (+20)
 *   not solved: 0
 *
 * Each player maintains their own tile pool. Operations replace two tiles with
 * the result. Player is solved when any tile in their pool equals the target.
 */

import { Timer } from '../utils/timer.js';
import { drawTiles, drawTarget } from './numbers/tiles.js';
import { canHitTarget, findOptimal, classifyDifficulty } from './numbers/solver.js';

const TOTAL_ROUNDS = 3;
const DIFFICULTIES = ['easy', 'medium', 'difficult'];
const INTRO_DURATION = 8000;
const PLAY_DURATION = 90000;          // step-by-step is slower than free-text
const RESULTS_DURATION = 12000;
const MAX_PUZZLE_GEN_ATTEMPTS = 500;  // higher: we filter by exact difficulty

function generateRound(targetDifficulty) {
  for (let i = 0; i < MAX_PUZZLE_GEN_ATTEMPTS; i++) {
    const tiles = drawTiles();
    const target = drawTarget();
    if (!canHitTarget(tiles, target)) continue;
    if (classifyDifficulty(tiles, target) === targetDifficulty) {
      return { tiles, target };
    }
  }
  // Fallback: any solvable puzzle, even if difficulty is off
  for (let i = 0; i < 100; i++) {
    const tiles = drawTiles();
    const target = drawTarget();
    if (canHitTarget(tiles, target)) return { tiles, target };
  }
  // Last resort
  return { tiles: drawTiles(), target: drawTarget() };
}

export function scoreSolvedFor(difficulty, remainingMs, totalMs, isFirstSolver) {
  const base = 100;
  const speed = Math.floor(50 * Math.max(0, Math.min(1, remainingMs / totalMs)));
  const firstBonus = isFirstSolver ? 20 : 0;
  const raw = base + speed + firstBonus;
  const multiplier = difficulty === 'difficult' ? 2.0 : difficulty === 'medium' ? 1.5 : 1.0;
  return Math.floor(raw * multiplier);
}

export class NumbersGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this._firstSolverId = null;
    this._tileIdCounter = 0;

    this.gameState.numbers = {
      phase: 'intro',
      roundNumber: 0,
      totalRounds: TOTAL_ROUNDS,
      difficulty: null,
      tiles: [],           // canonical original draw, with ids
      target: null,
      playerStates: {},    // playerId → { pool: Tile[], history: Op[], solved, solvedAtMs }
      cumulativeScores: {} // playerId → number
    };

    for (const [pid] of this.gameState.players) {
      this.gameState.numbers.cumulativeScores[pid] = 0;
    }
  }

  _nextTileId() { return `t${this._tileIdCounter++}`; }

  start() {
    console.log('[NUMBERS] Starting 3-round game');
    this._showIntro();
  }

  _showIntro() {
    this.gameState.numbers.phase = 'intro';
    const endsAt = Date.now() + INTRO_DURATION;
    this.io.emit('numbers:intro', {
      title: 'Numbers Round',
      description: 'Combine the 6 tiles with + − × ÷ to hit the target. Tap a tile, an operator, then another tile. The two tiles merge into the result. No parentheses, no fractions, no negatives.',
      scoringRules: [
        'Solving = 100 base + speed (up to +50)',
        'First solver: +20 bonus',
        'Medium: 1.5× total. Difficult: 2× total.',
        '3 rounds: easy → medium → difficult'
      ],
      totalRounds: TOTAL_ROUNDS,
      duration: INTRO_DURATION,
      endsAt
    });
    this.timer = new Timer(INTRO_DURATION, null, () => this._startRound(1));
    this.timer.start();
  }

  _startRound(n) {
    const difficulty = DIFFICULTIES[n - 1];
    const { tiles: rawTiles, target } = generateRound(difficulty);
    const tilesWithIds = rawTiles.map((v) => ({ id: this._nextTileId(), value: v }));

    this.gameState.numbers.roundNumber = n;
    this.gameState.numbers.phase = 'playing';
    this.gameState.numbers.difficulty = difficulty;
    this.gameState.numbers.tiles = tilesWithIds;
    this.gameState.numbers.target = target;
    this._firstSolverId = null;

    // Seed every player's pool with the canonical tile ids so client clicks
    // resolve correctly from the moment :round:start arrives. New tile ids
    // generated for operation results are independent per player.
    this.gameState.numbers.playerStates = {};
    for (const [pid] of this.gameState.players) {
      this.gameState.numbers.playerStates[pid] = {
        pool: tilesWithIds.map((t) => ({ id: t.id, value: t.value })),
        history: [],
        solved: false,
        solvedAtMs: null,
        bestValue: null
      };
    }

    const endsAt = Date.now() + PLAY_DURATION;
    this.gameState.numbers.endsAt = endsAt;

    this.io.emit('numbers:round:start', {
      roundNumber: n,
      totalRounds: TOTAL_ROUNDS,
      difficulty,
      tiles: tilesWithIds,   // initial pool — clients use ids
      target,
      duration: PLAY_DURATION,
      endsAt
    });
    console.log(`[NUMBERS] Round ${n}/${TOTAL_ROUNDS} (${difficulty}) — tiles ${rawTiles.join(',')} target ${target}`);

    this.timer = new Timer(PLAY_DURATION, null, () => this._endRound());
    this.timer.start();
  }

  handleOperation(playerId, { aId, op, bId }) {
    if (this.gameState.numbers.phase !== 'playing') return;
    const ps = this.gameState.numbers.playerStates[playerId];
    if (!ps || ps.solved) return;

    const aIdx = ps.pool.findIndex((t) => t.id === aId);
    const bIdx = ps.pool.findIndex((t) => t.id === bId);
    if (aIdx < 0 || bIdx < 0 || aIdx === bIdx) {
      this._ack(playerId, { accepted: false, error: 'invalid tile selection' });
      return;
    }
    if (!['+', '-', '*', '/'].includes(op)) {
      this._ack(playerId, { accepted: false, error: 'invalid operator' });
      return;
    }
    const a = ps.pool[aIdx].value;
    const b = ps.pool[bIdx].value;
    let result;
    if (op === '+') result = a + b;
    else if (op === '*') result = a * b;
    else if (op === '-') {
      if (a < b) { this._ack(playerId, { accepted: false, error: 'negative result not allowed' }); return; }
      result = a - b;
    }
    else { // op === '/'
      if (b === 0 || a % b !== 0) { this._ack(playerId, { accepted: false, error: 'non-integer division not allowed' }); return; }
      result = a / b;
    }

    // Apply: remove the two tiles, insert the result
    const newTile = { id: this._nextTileId(), value: result };
    const newPool = ps.pool.filter((_, i) => i !== aIdx && i !== bIdx).concat(newTile);
    ps.pool = newPool;
    ps.history.push({ aId, bId, op, aValue: a, bValue: b, resultId: newTile.id, result });

    // Check solved — any tile in the pool equals target?
    const target = this.gameState.numbers.target;
    const solved = newPool.some((t) => t.value === target);
    if (solved) {
      ps.solved = true;
      ps.solvedAtMs = Date.now();
      if (this._firstSolverId === null) this._firstSolverId = playerId;
    }

    // Track best value: the tile in the current pool closest to target
    const closest = newPool.reduce((best, t) => {
      return Math.abs(target - t.value) < Math.abs(target - best) ? t.value : best;
    }, ps.bestValue ?? newPool[0].value);
    ps.bestValue = closest;

    this._ack(playerId, { accepted: true, pool: newPool, history: ps.history, solved });
    this._broadcastProgress();
    if (solved) this._checkEarlyEnd();
  }

  handleReset(playerId) {
    if (this.gameState.numbers.phase !== 'playing') return;
    const ps = this.gameState.numbers.playerStates[playerId];
    if (!ps || ps.solved) return;
    // Re-seed from the original draw, fresh ids
    ps.pool = this.gameState.numbers.tiles.map((t) => ({ id: this._nextTileId(), value: t.value }));
    ps.history = [];
    this._ack(playerId, { accepted: true, pool: ps.pool, history: ps.history, solved: false, reset: true });
    this._broadcastProgress();
  }

  _ack(playerId, payload) {
    const socket = this._socketFor(playerId);
    if (socket) socket.emit('numbers:operation:ack', payload);
  }

  _broadcastProgress() {
    const playerProgress = {};
    for (const [pid, ps] of Object.entries(this.gameState.numbers.playerStates)) {
      playerProgress[pid] = {
        solved: ps.solved,
        operations: ps.history.length,
        bestValue: ps.bestValue ?? null
      };
    }
    this.io.emit('numbers:progress', { playerProgress });
  }

  _checkEarlyEnd() {
    // End round early when EVERY connected player has solved
    const connectedIds = Array.from(this.gameState.players.entries())
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    if (connectedIds.length === 0) return;
    const allSolved = connectedIds.every((id) => this.gameState.numbers.playerStates[id]?.solved);
    if (allSolved) {
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _endRound() {
    this.gameState.numbers.phase = 'results';
    const { tiles, target, roundNumber, difficulty } = this.gameState.numbers;
    const tileValues = tiles.map((t) => t.value);
    const optimal = findOptimal(tileValues, target);

    const phaseStartMs = this.gameState.numbers.endsAt - PLAY_DURATION;
    const playerResults = [];
    for (const [pid, p] of this.gameState.players) {
      const ps = this.gameState.numbers.playerStates[pid];
      let roundScore = 0;
      if (ps?.solved) {
        const remainingMs = Math.max(0, (phaseStartMs + PLAY_DURATION) - ps.solvedAtMs);
        roundScore = scoreSolvedFor(difficulty, remainingMs, PLAY_DURATION, this._firstSolverId === pid);
      }
      this.gameState.numbers.cumulativeScores[pid] = (this.gameState.numbers.cumulativeScores[pid] || 0) + roundScore;
      p.score = this.gameState.numbers.cumulativeScores[pid];
      playerResults.push({
        playerId: pid,
        playerName: p.name,
        roundScore,
        cumulativeScore: this.gameState.numbers.cumulativeScores[pid],
        solved: !!ps?.solved,
        operations: ps?.history?.length ?? 0,
        firstSolver: this._firstSolverId === pid
      });
    }

    const isLastRound = roundNumber >= TOTAL_ROUNDS;
    const endsAt = Date.now() + RESULTS_DURATION;
    this.io.emit('numbers:round:results', {
      roundNumber,
      totalRounds: TOTAL_ROUNDS,
      difficulty,
      tiles: tileValues,
      target,
      optimal,
      results: playerResults,
      cumulativeScores: this.gameState.numbers.cumulativeScores,
      isLastRound,
      duration: RESULTS_DURATION,
      endsAt
    });
    this.gameEngine.broadcastPlayerList();

    console.log(`[NUMBERS] Round ${roundNumber} (${difficulty}) ended.`);

    this.timer = new Timer(RESULTS_DURATION, null, () => {
      if (isLastRound) {
        console.log('[NUMBERS] All rounds done. Ending game.');
        this.gameEngine.endGame();
      } else {
        this._startRound(roundNumber + 1);
      }
    });
    this.timer.start();
  }

  _socketFor(playerId) {
    const player = this.gameState.players.get(playerId);
    if (!player) return null;
    return this.io.sockets.sockets.get(player.socketId);
  }

  pause()  { if (this.timer) this.timer.pause(); }
  resume() { if (this.timer) this.timer.resume(); }
  skip()   { if (this.timer) { this.timer.stop(); if (this.timer.onComplete) this.timer.onComplete(); } }
  cleanup() { if (this.timer) { this.timer.stop(); this.timer = null; } }

  getState() {
    return {
      phase: this.gameState.numbers?.phase || 'intro',
      roundNumber: this.gameState.numbers?.roundNumber || 0,
      totalRounds: TOTAL_ROUNDS,
      difficulty: this.gameState.numbers?.difficulty || null,
      target: this.gameState.numbers?.target || null,
      tiles: (this.gameState.numbers?.tiles || []).map((t) => t.value)
    };
  }

  /**
   * Per bug-report 2026-05-14 §A5: replay the events the host display needs
   * to render the current phase. Target and tile draw are public to all
   * sockets at round start, so no host/player distinction is needed.
   *
   * For the requesting player specifically we ALSO re-emit their personal
   * pool snapshot so the per-player tracker shows their working state, not
   * the original draw.
   */
  getResyncEvents({ playerId } = {}) {
    const events = [];
    const n = this.gameState.numbers;
    if (!n) return events;

    if (n.phase === 'intro') {
      events.push({
        name: 'numbers:intro',
        payload: {
          title: 'Numbers Round',
          description: 'Combine the 6 tiles with + − × ÷ to hit the target. Tap a tile, an operator, then another tile. The two tiles merge into the result. No parentheses, no fractions, no negatives.',
          scoringRules: [
            'Solving = 100 base + speed (up to +50)',
            'First solver: +20 bonus',
            '3 rounds: easy → medium → difficult'
          ],
          totalRounds: TOTAL_ROUNDS,
          duration: Math.max(0, (n.endsAt || Date.now()) - Date.now()),
          endsAt: n.endsAt || null
        }
      });
    } else if (n.phase === 'playing' && n.target != null) {
      events.push({
        name: 'numbers:round:start',
        payload: {
          roundNumber: n.roundNumber,
          totalRounds: TOTAL_ROUNDS,
          difficulty: n.difficulty,
          tiles: n.tiles,
          target: n.target,
          duration: Math.max(0, (n.endsAt || Date.now()) - Date.now()),
          endsAt: n.endsAt
        }
      });

      // Per-player progress snapshot (best value + solved status for everyone).
      const playerProgress = {};
      for (const [pid, ps] of Object.entries(n.playerStates || {})) {
        playerProgress[pid] = {
          solved: ps.solved,
          operations: ps.history.length,
          bestValue: ps.bestValue ?? null
        };
      }
      events.push({ name: 'numbers:progress', payload: { playerProgress } });

      // For the requesting player, also resend their personal pool so the
      // tile UI doesn't snap back to the original draw on remount.
      if (playerId && n.playerStates[playerId]) {
        const ps = n.playerStates[playerId];
        events.push({
          name: 'numbers:operation:ack',
          payload: {
            accepted: true,
            pool: ps.pool,
            history: ps.history,
            solved: ps.solved,
            resync: true
          }
        });
      }
    }
    return events;
  }
}
