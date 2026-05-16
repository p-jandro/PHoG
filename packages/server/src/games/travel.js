/**
 * Travel game module — country-chain puzzle, simultaneous-same-pair.
 *
 * Two modes per game, played sequentially:
 *   1. Europe  — pairs and paths restricted to the European pool, scores ×0.5
 *   2. World   — all countries, full scoring
 *
 * Each mode: 6s mode-intro → 120s play → 8s reveal.
 * Scores accumulate across modes; `player.score` always reflects the cumulative.
 *
 * Per-player state: a chain `[start, ..., currentHead]` plus a color per step,
 * plus a guess budget = optimalDistance + 2. The chain head must move toward
 * the destination; each step's color depends on whether it lies on a shortest
 * path FROM THE CURRENT HEAD at the time of submission.
 */

import { Timer } from '../utils/timer.js';
import {
  resolveCountry,
  isAdjacent,
  shortestPathInfo,
  canReach,
  shortestPathChain,
  pickRandomPair,
  ALL_COUNTRIES,
  neighbors,
  EUROPE_POOL
} from './travel/graph.js';

const INTRO_DURATION = 8000;
const MODE_INTRO_DURATION = 10000;
const PLAY_DURATION = 180000;
const RESULTS_DURATION = 12000;
const MIN_HOPS = 4;
const MAX_HOPS = 7;

const DEFAULT_MODES = ['europe', 'world'];
const MODE_LABELS = { europe: 'Europe', world: 'World' };
const MODE_MULTIPLIERS = { europe: 0.5, world: 1.0 };
// Europe is a smaller graph; cap shortest-path distance so we don't ask for
// a 7-hop chain across a 40-country subgraph.
const MODE_HOP_RANGES = {
  europe: { min: 3, max: 5 },
  world:  { min: MIN_HOPS, max: MAX_HOPS }
};

function poolForMode(mode) {
  return mode === 'europe' ? EUROPE_POOL : null;
}

function scoreSolved(yourLength, optimalDistance, remainingMs, totalMs, isFirst) {
  const base = 50;
  const optimality = Math.max(0, 30 - 10 * (yourLength - optimalDistance));
  const speed = Math.floor(20 * Math.max(0, Math.min(1, remainingMs / totalMs)));
  const firstBonus = isFirst ? 10 : 0;
  return base + optimality + speed + firstBonus;
}

function scorePartial(history) {
  const g = history.filter((h) => h.color === 'green').length;
  const o = history.filter((h) => h.color === 'orange').length;
  const r = history.filter((h) => h.color === 'red').length;
  return Math.max(0, 3 * g + 1 * o - 2 * r);
}

export class TravelGame {
  constructor(gameState, io, gameEngine, opts = {}) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.firstSolverId = null;
    this.phaseStartMs = null;
    // Cache iso lookup built once from countries data
    this.isoByName = new Map(ALL_COUNTRIES.map((c) => [c.name, c.iso]));

    this.modes = opts.modes || DEFAULT_MODES;
    this.currentModeIndex = 0;
    this.cumulativeScores = new Map();
    for (const [pid] of this.gameState.players) {
      this.cumulativeScores.set(pid, 0);
    }

    this.gameState.travel = {
      phase: 'intro',
      mode: this.modes[0],
      modeIndex: 0,
      totalModes: this.modes.length,
      start: null,
      end: null,
      optimalDistance: null,
      maxGuesses: null,
      duration: PLAY_DURATION,
      endsAt: null,
      cumulativeScores: {},
      players: {} // playerId → { frontChain, backChain, history, solved, solvedAtMs, guessesUsed }
    };
    for (const [pid] of this.gameState.players) {
      this.gameState.travel.players[pid] = {
        frontChain: [],
        backChain: [],
        history: [],
        solved: false,
        solvedAtMs: null,
        guessesUsed: 0
      };
    }
  }

  _currentMode() {
    return this.modes[this.currentModeIndex];
  }

  _currentPool() {
    return poolForMode(this._currentMode());
  }

  start() {
    console.log(`[TRAVEL] Starting game — modes: ${this.modes.join(' → ')}`);
    this._showIntro();
  }

  _showIntro() {
    this.gameState.travel.phase = 'intro';
    const endsAt = Date.now() + INTRO_DURATION;
    this.gameState.travel.endsAt = endsAt;
    this.io.emit('travel:intro', {
      title: 'Travel',
      description: 'Two rounds: Europe first (½ points), then the world. Connect two countries via shared land borders. Greens are optimal, oranges still reach the goal, reds are dead ends.',
      scoringRules: [
        'Solving = 50 base + optimality (matching optimal = +30) + speed bonus',
        'First to solve: +10 bonus',
        'Not solving: 3×greens + 1×oranges − 2×reds (floored at 0)',
        'Europe round: ½ points · World round: full points'
      ],
      modes: this.modes.map((m) => ({ id: m, label: MODE_LABELS[m] || m, multiplier: MODE_MULTIPLIERS[m] ?? 1 })),
      countries: ALL_COUNTRIES.map((c) => ({ name: c.name, aliases: c.aliases || [] })),
      duration: INTRO_DURATION,
      endsAt
    });
    this.timer = new Timer(INTRO_DURATION, null, () => this._playCurrentMode());
    this.timer.start();
  }

  _playCurrentMode() {
    const mode = this._currentMode();
    this.gameState.travel.mode = mode;
    this.gameState.travel.modeIndex = this.currentModeIndex;
    this.gameState.travel.totalModes = this.modes.length;
    this._showModeIntro(mode);
  }

  _showModeIntro(mode) {
    this.gameState.travel.phase = 'modeIntro';
    const endsAt = Date.now() + MODE_INTRO_DURATION;
    this.gameState.travel.endsAt = endsAt;
    this.io.emit('travel:mode:intro', {
      mode,
      modeLabel: MODE_LABELS[mode] || mode,
      modeIndex: this.currentModeIndex,
      totalModes: this.modes.length,
      multiplier: MODE_MULTIPLIERS[mode] ?? 1,
      duration: MODE_INTRO_DURATION,
      endsAt
    });
    this.timer = new Timer(MODE_INTRO_DURATION, null, () => this._startRound());
    this.timer.start();
  }

  _startRound() {
    const mode = this._currentMode();
    const pool = this._currentPool();
    const { min, max } = MODE_HOP_RANGES[mode] || { min: MIN_HOPS, max: MAX_HOPS };
    const pair = pickRandomPair(min, max, 200, pool);
    if (!pair) {
      console.error(`[TRAVEL/${mode}] Could not pick a valid pair`);
      this.gameEngine.endGame();
      return;
    }
    const { start, end, distance } = pair;
    this.gameState.travel.phase = 'playing';
    this.gameState.travel.start = start;
    this.gameState.travel.end = end;
    this.gameState.travel.optimalDistance = distance;
    this.gameState.travel.maxGuesses = distance + 2;
    this.phaseStartMs = Date.now();
    const endsAt = this.phaseStartMs + PLAY_DURATION;
    this.gameState.travel.endsAt = endsAt;
    this.firstSolverId = null;

    const isoByName = this.isoByName;
    const isoOf = (name) => isoByName.get(name) || null;

    // Compute relevant ISO codes: optimal path + immediate neighbors, for the map viewport
    const optimalChain = shortestPathChain(start, end, pool) || [start, end];
    const relevantNamesSet = new Set();
    for (const c of optimalChain) {
      relevantNamesSet.add(c);
      for (const nb of neighbors(c)) {
        if (!pool || pool.has(nb)) relevantNamesSet.add(nb);
      }
    }
    const relevantNames = Array.from(relevantNamesSet);
    const relevantIsos = relevantNames.map(isoOf).filter(Boolean);

    // Seed each player's chains with start and end (including iso)
    for (const [pid] of this.gameState.players) {
      this.gameState.travel.players[pid] = {
        frontChain: [{ name: start, iso: isoOf(start) }],
        backChain: [{ name: end, iso: isoOf(end) }],
        history: [],
        solved: false,
        solvedAtMs: null,
        guessesUsed: 0
      };
    }

    console.log(`[TRAVEL/${mode}] ${start} → ${end} (${distance} hops, ${this.gameState.travel.maxGuesses} budget)`);

    this.io.emit('travel:round:start', {
      mode,
      modeLabel: MODE_LABELS[mode] || mode,
      modeIndex: this.currentModeIndex,
      totalModes: this.modes.length,
      multiplier: MODE_MULTIPLIERS[mode] ?? 1,
      start,
      startIso: isoOf(start),
      end,
      endIso: isoOf(end),
      optimalDistance: distance,
      relevantIsos,
      relevantNames,
      maxGuesses: this.gameState.travel.maxGuesses,
      duration: PLAY_DURATION,
      endsAt
    });

    this.timer = new Timer(PLAY_DURATION, null, () => this._endRound());
    this.timer.start();
  }

  handleSubmit(playerId, { name }) {
    if (this.gameState.travel.phase !== 'playing') return;
    const ps = this.gameState.travel.players[playerId];
    if (!ps || ps.solved) return;
    if (ps.guessesUsed >= this.gameState.travel.maxGuesses) return;

    const resolved = resolveCountry(name);
    if (!resolved) {
      this._ackInvalid(playerId, `"${name}" not recognized`);
      return;
    }

    // Reject countries outside the current mode's pool (e.g. guessing China during the Europe round).
    const pool = this._currentPool();
    if (pool && !pool.has(resolved)) {
      this._ackInvalid(playerId, `"${resolved}" is not in this round (Europe only)`);
      return;
    }

    const frontHead = ps.frontChain[ps.frontChain.length - 1].name;
    const backHead = ps.backChain[0].name;
    const adjFront = isAdjacent(frontHead, resolved);
    const adjBack = isAdjacent(backHead, resolved);

    if (!adjFront && !adjBack) {
      // Per QA 2026-05-14: a non-adjacent (i.e. wrong) guess still consumes
      // the player's guess budget. Record it as a red history entry, but
      // don't extend either chain.
      const isoOfResolved = this.isoByName.get(resolved) || null;
      ps.history.push({ name: resolved, color: 'red', side: null, iso: isoOfResolved, intent: null });
      ps.guessesUsed++;
      const socket = this._socketFor(playerId);
      if (socket) {
        socket.emit('travel:guess:result', {
          name: resolved,
          color: 'red',
          side: null,
          intent: null,
          frontChain: ps.frontChain,
          backChain: ps.backChain,
          guessesUsed: ps.guessesUsed,
          guessesRemaining: this.gameState.travel.maxGuesses - ps.guessesUsed,
          solved: ps.solved
        });
      }
      this._broadcastProgress();
      this._checkEarlyEnd();
      return;
    }

    // Pick side — front wins ties.
    const side = adjFront ? 'front' : 'back';
    const extendingHead = side === 'front' ? frontHead : backHead;
    const otherHead = side === 'front' ? backHead : frontHead;

    let color;
    if (resolved === otherHead) {
      color = 'green'; // closes the gap by landing on the other head
    } else {
      const info = shortestPathInfo(extendingHead, otherHead, pool);
      if (info && info.nextOnShortestPath.has(resolved)) color = 'green';
      else if (canReach(resolved, otherHead, pool)) color = 'orange';
      else color = 'red';
    }

    // Compute intent: the next country on a shortest path from `resolved` toward
    // `otherHead`. This gives the host/client a precise arc endpoint rather than
    // the distant chain endpoint.
    let intentTarget = otherHead; // fallback: the opposite chain head
    if (resolved !== otherHead) {
      const intentInfo = shortestPathInfo(resolved, otherHead, pool);
      if (intentInfo && intentInfo.nextOnShortestPath.size > 0) {
        // Pick the first entry (Set iteration order is insertion order, which is
        // BFS neighbour order — a reasonable canonical choice).
        intentTarget = intentInfo.nextOnShortestPath.values().next().value;
      }
    }
    // intent.side is the side the player was extending (front extends toward end,
    // back extends toward start).
    const intent = { side, target: intentTarget };

    const resolvedIso = this.isoByName.get(resolved) || null;
    if (side === 'front') {
      ps.frontChain.push({ name: resolved, color, iso: resolvedIso });
    } else {
      ps.backChain.unshift({ name: resolved, color, iso: resolvedIso });
    }
    ps.history.push({ name: resolved, color, side, iso: resolvedIso, intent });
    ps.guessesUsed++;

    const newFront = ps.frontChain[ps.frontChain.length - 1].name;
    const newBack = ps.backChain[0].name;
    if (newFront === newBack || isAdjacent(newFront, newBack)) {
      ps.solved = true;
      ps.solvedAtMs = Date.now();
      if (this.firstSolverId === null) this.firstSolverId = playerId;
    }

    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit('travel:guess:result', {
        name: resolved,
        color,
        side,
        intent,
        frontChain: ps.frontChain,
        backChain: ps.backChain,
        guessesUsed: ps.guessesUsed,
        guessesRemaining: this.gameState.travel.maxGuesses - ps.guessesUsed,
        solved: ps.solved
      });
    }

    this._broadcastProgress();
    this._checkEarlyEnd();
  }

  _ackInvalid(playerId, reason) {
    const socket = this._socketFor(playerId);
    if (socket) socket.emit('travel:guess:invalid', { reason });
  }

  _broadcastProgress() {
    const playerProgress = {};
    for (const [pid, ps] of Object.entries(this.gameState.travel.players)) {
      playerProgress[pid] = {
        frontHead: ps.frontChain[ps.frontChain.length - 1]?.name || null,
        backHead: ps.backChain[0]?.name || null,
        chainTotal: ps.frontChain.length + ps.backChain.length, // total nodes across both
        frontChain: ps.frontChain,    // full chain with name, color, iso
        backChain: ps.backChain,      // full chain with name, color, iso
        colors: ps.history.map((h) => h.color),
        solved: ps.solved,
        guessesUsed: ps.guessesUsed
      };
    }
    this.io.emit('travel:progress', { playerProgress });
  }

  _checkEarlyEnd() {
    const connectedIds = Array.from(this.gameState.players.entries())
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    if (connectedIds.length === 0) return;
    const allDone = connectedIds.every((id) => {
      const s = this.gameState.travel.players[id];
      if (!s) return true;
      return s.solved || s.guessesUsed >= this.gameState.travel.maxGuesses;
    });
    if (allDone) {
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _endRound() {
    this.gameState.travel.phase = 'results';
    const mode = this._currentMode();
    const pool = this._currentPool();
    const multiplier = MODE_MULTIPLIERS[mode] ?? 1;
    const isLastMode = this.currentModeIndex >= this.modes.length - 1;
    const { start, end, optimalDistance } = this.gameState.travel;
    const optimalChain = shortestPathChain(start, end, pool);
    const total = PLAY_DURATION;

    const playerResults = [];
    for (const [pid, p] of this.gameState.players) {
      const ps = this.gameState.travel.players[pid];
      if (!ps) {
        const cumul = this.cumulativeScores.get(pid) || 0;
        p.score = cumul;
        playerResults.push({
          playerId: pid,
          playerName: p.name,
          modeScore: 0,
          score: 0,
          cumulativeScore: cumul,
          solved: false,
          frontChain: [], backChain: [], history: []
        });
        continue;
      }

      let combined;
      const fh = ps.frontChain[ps.frontChain.length - 1].name;
      const bh = ps.backChain[0].name;
      if (fh === bh) {
        combined = ps.frontChain.concat(ps.backChain.slice(1));
      } else {
        combined = ps.frontChain.concat(ps.backChain);
      }
      const yourLength = Math.max(0, combined.length - 1);

      let rawScore = 0;
      if (ps.solved) {
        const remainingMs = Math.max(0, (this.phaseStartMs + total) - ps.solvedAtMs);
        rawScore = scoreSolved(yourLength, optimalDistance, remainingMs, total, this.firstSolverId === pid);
      } else {
        rawScore = scorePartial(ps.history);
      }
      const modeScore = Math.round(rawScore * multiplier);
      const cumul = (this.cumulativeScores.get(pid) || 0) + modeScore;
      this.cumulativeScores.set(pid, cumul);
      p.score = cumul;

      playerResults.push({
        playerId: pid,
        playerName: p.name,
        // `score` kept for backward compat with any UI reading round-level score.
        score: modeScore,
        modeScore,
        cumulativeScore: cumul,
        solved: ps.solved,
        frontChain: ps.frontChain,
        backChain: ps.backChain,
        combinedChain: combined,
        history: ps.history,
        firstSolver: this.firstSolverId === pid
      });
    }

    this.gameState.travel.cumulativeScores = Object.fromEntries(this.cumulativeScores);

    const optimalChainIsos = (optimalChain || []).map((n) => this.isoByName.get(n)).filter(Boolean);

    const endsAt = Date.now() + RESULTS_DURATION;
    this.gameState.travel.endsAt = endsAt;
    this.io.emit('travel:round:results', {
      mode,
      modeLabel: MODE_LABELS[mode] || mode,
      modeIndex: this.currentModeIndex,
      totalModes: this.modes.length,
      multiplier,
      isLastMode,
      start,
      end,
      optimalDistance,
      optimalChain,
      optimalChainIsos,
      results: playerResults,
      cumulativeScores: this.gameState.travel.cumulativeScores,
      duration: RESULTS_DURATION,
      endsAt
    });
    this.gameEngine.broadcastPlayerList();
    console.log(`[TRAVEL/${mode}] Ended. ${start}→${end} (${optimalDistance} hops, ×${multiplier}). First: ${this.firstSolverId || 'none'}. Last mode: ${isLastMode}`);

    this.timer = new Timer(RESULTS_DURATION, null, () => {
      if (isLastMode) {
        this.gameEngine.endGame();
      } else {
        this.currentModeIndex++;
        this._playCurrentMode();
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

  cleanup() {
    console.log('[TRAVEL] Cleaning up');
    if (this.timer) { this.timer.stop(); this.timer = null; }
  }

  getState() {
    return {
      phase: this.gameState.travel?.phase || 'intro',
      start: this.gameState.travel?.start || null,
      end: this.gameState.travel?.end || null,
      maxGuesses: this.gameState.travel?.maxGuesses || null,
      endsAt: this.gameState.travel?.endsAt
    };
  }

  /**
   * Per bug-report 2026-05-14 §A5: replay round-start (start/end are public,
   * the optimal chain stays server-side until results), public progress, and
   * the requesting player's private chain on remount. We never emit the
   * optimal chain mid-round, so neither host nor player leaks the target
   * solution here.
   */
  getResyncEvents({ playerId } = {}) {
    const events = [];
    const t = this.gameState.travel;
    if (!t) return events;
    const mode = t.mode || this._currentMode();
    const pool = poolForMode(mode);

    if (t.phase === 'intro') {
      events.push({
        name: 'travel:intro',
        payload: {
          title: 'Travel',
          description: 'Two rounds: Europe first (½ points), then the world. Connect two countries via shared land borders. Greens are optimal, oranges still reach the goal, reds are dead ends.',
          scoringRules: [
            'Solving = 50 base + optimality (matching optimal = +30) + speed bonus',
            'First to solve: +10 bonus',
            'Not solving: 3×greens + 1×oranges − 2×reds (floored at 0)',
            'Europe round: ½ points · World round: full points'
          ],
          modes: this.modes.map((m) => ({ id: m, label: MODE_LABELS[m] || m, multiplier: MODE_MULTIPLIERS[m] ?? 1 })),
          countries: ALL_COUNTRIES.map((c) => ({ name: c.name, aliases: c.aliases || [] })),
          duration: Math.max(0, (t.endsAt || Date.now()) - Date.now()),
          endsAt: t.endsAt || null
        }
      });
    } else if (t.phase === 'modeIntro') {
      events.push({
        name: 'travel:mode:intro',
        payload: {
          mode,
          modeLabel: MODE_LABELS[mode] || mode,
          modeIndex: t.modeIndex ?? this.currentModeIndex,
          totalModes: t.totalModes ?? this.modes.length,
          multiplier: MODE_MULTIPLIERS[mode] ?? 1,
          duration: Math.max(0, (t.endsAt || Date.now()) - Date.now()),
          endsAt: t.endsAt || null
        }
      });
    } else if (t.phase === 'playing' && t.start && t.end) {
      // Reconstruct the relevantIsos viewport from the canonical pair.
      const optimalChain = shortestPathChain(t.start, t.end, pool) || [t.start, t.end];
      const relevantNamesSet = new Set();
      for (const c of optimalChain) {
        relevantNamesSet.add(c);
        for (const nb of neighbors(c)) {
          if (!pool || pool.has(nb)) relevantNamesSet.add(nb);
        }
      }
      const relevantNames = Array.from(relevantNamesSet);
      const isoOf = (name) => this.isoByName.get(name) || null;
      const relevantIsos = relevantNames.map(isoOf).filter(Boolean);

      events.push({
        name: 'travel:round:start',
        payload: {
          mode,
          modeLabel: MODE_LABELS[mode] || mode,
          modeIndex: t.modeIndex ?? this.currentModeIndex,
          totalModes: t.totalModes ?? this.modes.length,
          multiplier: MODE_MULTIPLIERS[mode] ?? 1,
          start: t.start,
          startIso: isoOf(t.start),
          end: t.end,
          endIso: isoOf(t.end),
          optimalDistance: t.optimalDistance,
          relevantIsos,
          relevantNames,
          maxGuesses: t.maxGuesses,
          duration: Math.max(0, (t.endsAt || Date.now()) - Date.now()),
          endsAt: t.endsAt
        }
      });

      // Public per-player progress (front/back heads + chain breakdown for the
      // host tracker). This is the same payload _broadcastProgress sends and
      // already excludes the optimal chain.
      const playerProgress = {};
      for (const [pid, ps] of Object.entries(t.players || {})) {
        playerProgress[pid] = {
          frontHead: ps.frontChain[ps.frontChain.length - 1]?.name || null,
          backHead: ps.backChain[0]?.name || null,
          chainTotal: ps.frontChain.length + ps.backChain.length,
          frontChain: ps.frontChain,
          backChain: ps.backChain,
          colors: ps.history.map((h) => h.color),
          solved: ps.solved,
          guessesUsed: ps.guessesUsed
        };
      }
      events.push({ name: 'travel:progress', payload: { playerProgress } });

      // Requesting player's last guess result so their personal chain UI hydrates.
      if (playerId && t.players[playerId]) {
        const ps = t.players[playerId];
        const last = ps.history[ps.history.length - 1];
        if (last) {
          events.push({
            name: 'travel:guess:result',
            payload: {
              name: last.name,
              color: last.color,
              side: last.side,
              intent: last.intent,
              frontChain: ps.frontChain,
              backChain: ps.backChain,
              guessesUsed: ps.guessesUsed,
              guessesRemaining: t.maxGuesses - ps.guessesUsed,
              solved: ps.solved,
              resync: true
            }
          });
        }
      }
    }
    return events;
  }
}
