/**
 * Numbers Round game module — Countdown numbers, multiplayer.
 *
 * Session shape:
 *   1 game = 5 rounds.
 *   Each round: 8s intro splash → 45s playing → 8s reveal.
 *   Score accumulates across rounds.
 *
 * Per-round scoring (server-authoritative):
 *   exact target hit:     50 pts
 *   within 5 of target:   30 pts
 *   within 10 of target:  15 pts
 *   else:                  0 pts
 *   first-correct bonus: +10 pts (first player to submit an exact solve)
 */

import { Timer } from '../utils/timer.js';
import { drawTiles, drawTarget } from './numbers/tiles.js';
import { evaluate, literalsFitTiles } from './numbers/expression.js';
import { canHitTarget, findOptimal } from './numbers/solver.js';

const TOTAL_ROUNDS = 5;
const INTRO_DURATION = 8000;
const PLAY_DURATION = 45000;
const RESULTS_DURATION = 8000;
const MAX_PUZZLE_GEN_ATTEMPTS = 100;

function generateRound() {
  // Try to produce an exact-solvable puzzle; if we can't, fall back to the last
  // generated one (closest-achievable scoring still works).
  for (let i = 0; i < MAX_PUZZLE_GEN_ATTEMPTS; i++) {
    const tiles = drawTiles();
    const target = drawTarget();
    if (canHitTarget(tiles, target)) return { tiles, target };
  }
  // Fallback — unsolvable target, but the round still scores by closeness.
  return { tiles: drawTiles(), target: drawTarget() };
}

function scoreSubmission(claimedValue, target) {
  const dist = Math.abs(claimedValue - target);
  if (dist === 0) return 50;
  if (dist <= 5) return 30;
  if (dist <= 10) return 15;
  return 0;
}

export class NumbersGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;

    this.gameState.numbers = {
      phase: 'intro',
      roundNumber: 0,
      totalRounds: TOTAL_ROUNDS,
      tiles: [],
      target: null,
      submissions: {}, // playerId -> { expression, value, valid, distance, score, submittedAt }
      cumulativeScores: {} // playerId -> total across rounds
    };

    for (const [pid] of this.gameState.players) {
      this.gameState.numbers.cumulativeScores[pid] = 0;
    }
  }

  start() {
    console.log('[NUMBERS] Starting game');
    this._showIntro();
  }

  _showIntro() {
    this.gameState.numbers.phase = 'intro';
    const endsAt = Date.now() + INTRO_DURATION;

    this.io.emit('numbers:intro', {
      title: 'Numbers Round',
      description: 'Six tiles. One target. 45 seconds. Combine the tiles with + − × ÷ to hit the target.',
      scoringRules: [
        'Exact hit: 50 points',
        'Within 5: 30 points',
        'Within 10: 15 points',
        'First exact solver: +10 bonus'
      ],
      totalRounds: TOTAL_ROUNDS,
      duration: INTRO_DURATION,
      endsAt
    });

    this.timer = new Timer(INTRO_DURATION, null, () => this._startRound(1));
    this.timer.start();
  }

  _startRound(n) {
    this.gameState.numbers.roundNumber = n;
    this.gameState.numbers.phase = 'playing';
    this.gameState.numbers.submissions = {};

    const { tiles, target } = generateRound();
    this.gameState.numbers.tiles = tiles;
    this.gameState.numbers.target = target;
    this._firstExactPlayerId = null;

    const endsAt = Date.now() + PLAY_DURATION;
    this.gameState.numbers.endsAt = endsAt;

    this.io.emit('numbers:round:start', {
      roundNumber: n,
      totalRounds: TOTAL_ROUNDS,
      tiles,
      target,
      duration: PLAY_DURATION,
      endsAt
    });

    console.log(`[NUMBERS] Round ${n}/${TOTAL_ROUNDS} — tiles ${tiles.join(',')} target ${target}`);

    this.timer = new Timer(PLAY_DURATION, null, () => this._endRound());
    this.timer.start();
  }

  handleSubmit(playerId, { expression, claimedValue }) {
    if (this.gameState.numbers.phase !== 'playing') return;
    const tiles = this.gameState.numbers.tiles;
    const target = this.gameState.numbers.target;

    // If they already submitted this round, allow overwrite — last submission wins.
    const prev = this.gameState.numbers.submissions[playerId];

    const evalResult = evaluate(String(expression || ''));
    let entry;
    if (!evalResult.ok) {
      entry = {
        expression,
        value: null,
        valid: false,
        error: evalResult.error,
        distance: null,
        score: 0,
        submittedAt: Date.now()
      };
    } else if (!literalsFitTiles(evalResult.literals, tiles)) {
      entry = {
        expression,
        value: evalResult.value,
        valid: false,
        error: 'tile multiset mismatch',
        distance: null,
        score: 0,
        submittedAt: Date.now()
      };
    } else if (typeof claimedValue === 'number' && claimedValue !== evalResult.value) {
      entry = {
        expression,
        value: evalResult.value,
        claimedValue,
        valid: false,
        error: 'claimed value does not match evaluation',
        distance: null,
        score: 0,
        submittedAt: Date.now()
      };
    } else {
      const distance = Math.abs(evalResult.value - target);
      const baseScore = scoreSubmission(evalResult.value, target);
      let bonus = 0;
      if (distance === 0 && this._firstExactPlayerId === null) {
        this._firstExactPlayerId = playerId;
        bonus = 10;
      }
      entry = {
        expression,
        value: evalResult.value,
        valid: true,
        distance,
        score: baseScore + bonus,
        firstExactBonus: bonus > 0,
        submittedAt: Date.now()
      };
    }

    this.gameState.numbers.submissions[playerId] = entry;

    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit('numbers:submit:ack', {
        accepted: entry.valid,
        expression,
        value: entry.value,
        distance: entry.distance,
        error: entry.error || null
      });
    }

    // Broadcast progress (no expressions, just who-has-submitted)
    this._broadcastProgress();

    // Early-end if every connected player has submitted at least one valid solution
    const connectedIds = Array.from(this.gameState.players.entries())
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    const allValid = connectedIds.length > 0 && connectedIds.every((id) => this.gameState.numbers.submissions[id]?.valid);
    if (allValid && this._firstExactPlayerId !== null) {
      // Everyone's got a valid answer and someone has solved exactly — short-circuit.
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _broadcastProgress() {
    const submitted = Object.fromEntries(
      Object.entries(this.gameState.numbers.submissions).map(([pid, s]) => [pid, { hasSubmitted: true, valid: s.valid }])
    );
    this.io.emit('numbers:progress', { submitted });
  }

  _endRound() {
    this.gameState.numbers.phase = 'results';
    const { tiles, target, roundNumber, submissions } = this.gameState.numbers;
    const optimal = findOptimal(tiles, target);

    // Update cumulative scores
    const roundResults = [];
    for (const [pid, p] of this.gameState.players) {
      const s = submissions[pid];
      const score = s?.score || 0;
      this.gameState.numbers.cumulativeScores[pid] = (this.gameState.numbers.cumulativeScores[pid] || 0) + score;
      p.score = this.gameState.numbers.cumulativeScores[pid]; // engine uses player.score for placement
      roundResults.push({
        playerId: pid,
        playerName: p.name,
        expression: s?.expression ?? null,
        value: s?.value ?? null,
        distance: s?.distance ?? null,
        roundScore: score,
        cumulativeScore: this.gameState.numbers.cumulativeScores[pid],
        valid: s?.valid ?? false,
        firstExactBonus: !!s?.firstExactBonus
      });
    }

    const isLastRound = roundNumber >= TOTAL_ROUNDS;
    const endsAt = Date.now() + RESULTS_DURATION;

    this.io.emit('numbers:round:results', {
      roundNumber,
      totalRounds: TOTAL_ROUNDS,
      tiles,
      target,
      optimal,
      results: roundResults,
      cumulativeScores: this.gameState.numbers.cumulativeScores,
      isLastRound,
      duration: RESULTS_DURATION,
      endsAt
    });

    this.gameEngine.broadcastPlayerList();

    console.log(`[NUMBERS] Round ${roundNumber} ended. Optimal: ${optimal.value} via ${optimal.expression} (dist ${optimal.distance})`);

    this.timer = new Timer(RESULTS_DURATION, null, () => {
      if (isLastRound) {
        console.log('[NUMBERS] All rounds complete. Ending game.');
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
  skip()   {
    if (this.timer) {
      this.timer.stop();
      if (this.timer.onComplete) this.timer.onComplete();
    }
  }

  cleanup() {
    console.log('[NUMBERS] Cleaning up');
    if (this.timer) { this.timer.stop(); this.timer = null; }
  }

  getState() {
    return {
      phase: this.gameState.numbers?.phase || 'intro',
      roundNumber: this.gameState.numbers?.roundNumber || 0,
      totalRounds: TOTAL_ROUNDS,
      target: this.gameState.numbers?.target || null,
      tiles: this.gameState.numbers?.tiles || []
    };
  }
}
