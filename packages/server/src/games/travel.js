/**
 * Travel game module — country-chain puzzle, simultaneous-same-pair.
 *
 * Round shape:
 *   8s intro → 90s play → 8s reveal.
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
  neighbors
} from './travel/graph.js';

const INTRO_DURATION = 8000;
const PLAY_DURATION = 90000;
const RESULTS_DURATION = 8000;
const MIN_HOPS = 4;
const MAX_HOPS = 7;

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
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.firstSolverId = null;
    this.phaseStartMs = null;
    // Cache iso lookup built once from countries data
    this.isoByName = new Map(ALL_COUNTRIES.map((c) => [c.name, c.iso]));

    this.gameState.travel = {
      phase: 'intro',
      start: null,
      end: null,
      optimalDistance: null,
      maxGuesses: null,
      duration: PLAY_DURATION,
      endsAt: null,
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

  start() {
    console.log('[TRAVEL] Starting game');
    this._showIntro();
  }

  _showIntro() {
    this.gameState.travel.phase = 'intro';
    const endsAt = Date.now() + INTRO_DURATION;
    this.io.emit('travel:intro', {
      title: 'Travel',
      description: 'Connect two countries via shared land borders. Greens are optimal, oranges still reach the goal, reds are dead ends.',
      scoringRules: [
        'Solving = 50 base + optimality (matching optimal = +30) + speed bonus',
        'First to solve: +10 bonus',
        'Not solving: 3×greens + 1×oranges − 2×reds (floored at 0)'
      ],
      countries: ALL_COUNTRIES.map((c) => ({ name: c.name, aliases: c.aliases || [] })),
      duration: INTRO_DURATION,
      endsAt
    });
    this.timer = new Timer(INTRO_DURATION, null, () => this._startRound());
    this.timer.start();
  }

  _startRound() {
    const pair = pickRandomPair(MIN_HOPS, MAX_HOPS);
    if (!pair) {
      console.error('[TRAVEL] Could not pick a valid pair');
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
    const optimalChain = shortestPathChain(start, end) || [start, end];
    const relevantNamesSet = new Set();
    for (const c of optimalChain) {
      relevantNamesSet.add(c);
      for (const nb of neighbors(c)) relevantNamesSet.add(nb);
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

    console.log(`[TRAVEL] ${start} → ${end} (${distance} hops, ${this.gameState.travel.maxGuesses} budget)`);

    this.io.emit('travel:round:start', {
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

    const frontHead = ps.frontChain[ps.frontChain.length - 1].name;
    const backHead = ps.backChain[0].name;
    const adjFront = isAdjacent(frontHead, resolved);
    const adjBack = isAdjacent(backHead, resolved);

    if (!adjFront && !adjBack) {
      this._ackInvalid(playerId, `${resolved} doesn't border ${frontHead} or ${backHead}`);
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
      const info = shortestPathInfo(extendingHead, otherHead);
      if (info && info.nextOnShortestPath.has(resolved)) color = 'green';
      else if (canReach(resolved, otherHead)) color = 'orange';
      else color = 'red';
    }

    // Compute intent: the next country on a shortest path from `resolved` toward
    // `otherHead`. This gives the host/client a precise arc endpoint rather than
    // the distant chain endpoint.
    let intentTarget = otherHead; // fallback: the opposite chain head
    if (resolved !== otherHead) {
      const intentInfo = shortestPathInfo(resolved, otherHead);
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
    const { start, end, optimalDistance } = this.gameState.travel;
    const optimalChain = shortestPathChain(start, end);
    const total = PLAY_DURATION;

    const playerResults = [];
    for (const [pid, p] of this.gameState.players) {
      const ps = this.gameState.travel.players[pid];
      if (!ps) {
        p.score = 0;
        playerResults.push({ playerId: pid, playerName: p.name, score: 0, solved: false, frontChain: [], backChain: [], history: [] });
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

      let score = 0;
      if (ps.solved) {
        const remainingMs = Math.max(0, (this.phaseStartMs + total) - ps.solvedAtMs);
        score = scoreSolved(yourLength, optimalDistance, remainingMs, total, this.firstSolverId === pid);
      } else {
        score = scorePartial(ps.history);
      }
      p.score = score;

      playerResults.push({
        playerId: pid,
        playerName: p.name,
        score,
        solved: ps.solved,
        frontChain: ps.frontChain,
        backChain: ps.backChain,
        combinedChain: combined,
        history: ps.history,
        firstSolver: this.firstSolverId === pid
      });
    }

    const optimalChainIsos = (optimalChain || []).map((n) => this.isoByName.get(n)).filter(Boolean);

    const endsAt = Date.now() + RESULTS_DURATION;
    this.io.emit('travel:round:results', {
      start,
      end,
      optimalDistance,
      optimalChain,
      optimalChainIsos,
      results: playerResults,
      duration: RESULTS_DURATION,
      endsAt
    });
    this.gameEngine.broadcastPlayerList();
    console.log(`[TRAVEL] Ended. ${start}→${end} (${optimalDistance} hops). First: ${this.firstSolverId || 'none'}`);

    this.timer = new Timer(RESULTS_DURATION, null, () => {
      this.gameEngine.endGame();
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

    if (t.phase === 'intro') {
      events.push({
        name: 'travel:intro',
        payload: {
          title: 'Travel',
          description: 'Connect two countries via shared land borders. Greens are optimal, oranges still reach the goal, reds are dead ends.',
          scoringRules: [
            'Solving = 50 base + optimality (matching optimal = +30) + speed bonus',
            'First to solve: +10 bonus',
            'Not solving: 3×greens + 1×oranges − 2×reds (floored at 0)'
          ],
          countries: ALL_COUNTRIES.map((c) => ({ name: c.name, aliases: c.aliases || [] })),
          duration: Math.max(0, (t.endsAt || Date.now()) - Date.now()),
          endsAt: t.endsAt || null
        }
      });
    } else if (t.phase === 'playing' && t.start && t.end) {
      // Reconstruct the relevantIsos viewport from the canonical pair.
      const optimalChain = shortestPathChain(t.start, t.end) || [t.start, t.end];
      const relevantNamesSet = new Set();
      for (const c of optimalChain) {
        relevantNamesSet.add(c);
        for (const nb of neighbors(c)) relevantNamesSet.add(nb);
      }
      const relevantNames = Array.from(relevantNamesSet);
      const isoOf = (name) => this.isoByName.get(name) || null;
      const relevantIsos = relevantNames.map(isoOf).filter(Boolean);

      events.push({
        name: 'travel:round:start',
        payload: {
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
