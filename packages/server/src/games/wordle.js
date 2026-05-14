/**
 * Wordle game module — multiplayer, simultaneous-same-puzzle.
 *
 * Session shape:
 *   8s intro → 120s play → 8s results.
 *
 * Per-player state: up to 6 guesses, each guess gets private color feedback.
 * Round ends early when every connected player has solved or exhausted guesses.
 *
 * Scoring (per player, at round end):
 *   Solved: 50 base + efficiency (7 - guessesUsed) * 20 + speed bonus 0..50
 *           (floor(50 * remainingMsAtSolve / totalMs)) + first-solver bonus +10
 *   Did not solve: 5 * uniqueGreens + 2 * uniqueYellows (partial credit)
 */

import { Timer } from '../utils/timer.js';
import { colorGuess, isAllowedGuess, pickRandomAnswer } from './wordle/coloring.js';

const INTRO_DURATION = 8000;
const PLAY_DURATION = 120000;
const RESULTS_DURATION = 8000;
const MAX_GUESSES = 6;

function uniqueColored(history, color) {
  const set = new Set();
  for (const { guess, colors } of history) {
    for (let i = 0; i < guess.length; i++) {
      if (colors[i] === color) set.add(guess[i]);
    }
  }
  return set.size;
}

function scoreSolved(guessesUsed, remainingMs, totalMs, isFirstSolver) {
  const base = 50;
  const efficiency = (7 - guessesUsed) * 20;
  const speed = Math.floor(50 * Math.max(0, Math.min(1, remainingMs / totalMs)));
  const firstBonus = isFirstSolver ? 10 : 0;
  return base + efficiency + speed + firstBonus;
}

function scorePartial(history) {
  return 5 * uniqueColored(history, 'green') + 2 * uniqueColored(history, 'yellow');
}

export class WordleGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.firstSolverId = null;
    this.phaseStartMs = null;

    this.gameState.wordle = {
      phase: 'intro',
      answer: null,            // server-only, never broadcast until reveal
      duration: PLAY_DURATION,
      endsAt: null,
      players: {}              // playerId → { history, solved, solvedAtMs, guessesUsed }
    };
    for (const [pid] of this.gameState.players) {
      this.gameState.wordle.players[pid] = { history: [], solved: false, solvedAtMs: null, guessesUsed: 0 };
    }
  }

  start() {
    console.log('[WORDLE] Starting game');
    this._showIntro();
  }

  _showIntro() {
    this.gameState.wordle.phase = 'intro';
    const endsAt = Date.now() + INTRO_DURATION;
    this.io.emit('wordle:intro', {
      title: 'Wordle',
      description: 'Guess the 5-letter word in 6 tries. Same word for everyone.',
      scoringRules: [
        'Solving = 50 base + efficiency + speed (up to ~220 total)',
        'Not solving = partial credit per unique green / yellow letter',
        'First solver: +10 bonus'
      ],
      duration: INTRO_DURATION,
      endsAt
    });
    this.timer = new Timer(INTRO_DURATION, null, () => this._startRound());
    this.timer.start();
  }

  _startRound() {
    this.gameState.wordle.phase = 'playing';
    this.gameState.wordle.answer = pickRandomAnswer();
    this.phaseStartMs = Date.now();
    const endsAt = this.phaseStartMs + PLAY_DURATION;
    this.gameState.wordle.endsAt = endsAt;
    this.firstSolverId = null;

    console.log(`[WORDLE] Answer: ${this.gameState.wordle.answer}`);

    // Broadcast round-start to ALL sockets (host + players) — target intentionally omitted
    // so players never see the answer here.
    this.io.emit('wordle:round:start', {
      duration: PLAY_DURATION,
      endsAt,
      maxGuesses: MAX_GUESSES
    });

    // Send target exclusively to the host socket so it can prepare reveal infrastructure.
    // Players must NOT receive this event — it is emitted only to the host socket.
    const hostSocketId = this.gameState.meta?.hostSocketId;
    const hostSocket = hostSocketId ? this.io.sockets.sockets.get(hostSocketId) : null;
    if (hostSocket) {
      hostSocket.emit('wordle:round:start:host', {
        target: this.gameState.wordle.answer
      });
    }

    this.timer = new Timer(PLAY_DURATION, null, () => this._endRound());
    this.timer.start();
  }

  handleSubmit(playerId, { guess }) {
    if (this.gameState.wordle.phase !== 'playing') return;
    const ps = this.gameState.wordle.players[playerId];
    if (!ps) return;
    if (ps.solved || ps.guessesUsed >= MAX_GUESSES) return;

    const raw = String(guess || '').toLowerCase().trim();
    if (raw.length !== 5 || !/^[a-z]{5}$/.test(raw)) {
      this._ackInvalid(playerId, 'guess must be 5 letters');
      return;
    }
    if (!isAllowedGuess(raw)) {
      this._ackInvalid(playerId, 'not in word list');
      return;
    }

    const colors = colorGuess(raw, this.gameState.wordle.answer);
    ps.history.push({ guess: raw, colors });
    ps.guessesUsed++;
    const isSolved = colors.every((c) => c === 'green');
    if (isSolved) {
      ps.solved = true;
      ps.solvedAtMs = Date.now();
      if (this.firstSolverId === null) this.firstSolverId = playerId;
    }

    // Private feedback to the submitter only
    const socket = this._socketFor(playerId);
    if (socket) {
      socket.emit('wordle:guess:result', {
        guess: raw,
        colors,
        guessesUsed: ps.guessesUsed,
        guessesRemaining: MAX_GUESSES - ps.guessesUsed,
        solved: ps.solved
      });
    }

    this._broadcastProgress();
    this._checkEarlyEnd();
  }

  _ackInvalid(playerId, reason) {
    const socket = this._socketFor(playerId);
    if (socket) socket.emit('wordle:guess:invalid', { reason });
  }

  _broadcastProgress() {
    // Send only color patterns + solved flags — never the actual letters
    const playerProgress = {};
    for (const [pid, ps] of Object.entries(this.gameState.wordle.players)) {
      playerProgress[pid] = {
        guessesUsed: ps.guessesUsed,
        solved: ps.solved,
        colorRows: ps.history.map((h) => h.colors)
      };
    }
    this.io.emit('wordle:progress', { playerProgress });
  }

  _checkEarlyEnd() {
    const connectedIds = Array.from(this.gameState.players.entries())
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    if (connectedIds.length === 0) return;
    const allDone = connectedIds.every((id) => {
      const s = this.gameState.wordle.players[id];
      if (!s) return true;
      return s.solved || s.guessesUsed >= MAX_GUESSES;
    });
    if (allDone) {
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this._endRound();
    }
  }

  _endRound() {
    this.gameState.wordle.phase = 'results';
    const { answer } = this.gameState.wordle;
    const total = PLAY_DURATION;
    const playerResults = [];
    for (const [pid, p] of this.gameState.players) {
      const ps = this.gameState.wordle.players[pid];
      if (!ps) {
        p.score = 0;
        playerResults.push({ playerId: pid, playerName: p.name, score: 0, solved: false, guessesUsed: 0, history: [] });
        continue;
      }
      let score = 0;
      if (ps.solved) {
        const remainingMs = Math.max(0, (this.phaseStartMs + total) - ps.solvedAtMs);
        score = scoreSolved(ps.guessesUsed, remainingMs, total, this.firstSolverId === pid);
      } else {
        score = scorePartial(ps.history);
      }
      p.score = score;
      playerResults.push({
        playerId: pid,
        playerName: p.name,
        score,
        solved: ps.solved,
        guessesUsed: ps.guessesUsed,
        history: ps.history,
        firstSolver: this.firstSolverId === pid
      });
    }

    const endsAt = Date.now() + RESULTS_DURATION;
    this.io.emit('wordle:round:results', {
      answer,
      results: playerResults,
      duration: RESULTS_DURATION,
      endsAt
    });
    this.gameEngine.broadcastPlayerList();
    console.log(`[WORDLE] Ended. Answer ${answer}. First solver: ${this.firstSolverId || 'none'}`);

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
  skip()   {
    if (this.timer) { this.timer.stop(); if (this.timer.onComplete) this.timer.onComplete(); }
  }

  cleanup() {
    console.log('[WORDLE] Cleaning up');
    if (this.timer) { this.timer.stop(); this.timer = null; }
  }

  getState() {
    return {
      phase: this.gameState.wordle?.phase || 'intro',
      answer: this.gameState.wordle?.phase === 'results' ? this.gameState.wordle.answer : null,
      endsAt: this.gameState.wordle?.endsAt
    };
  }

  /**
   * Per bug-report 2026-05-14 §A5: replay the round-start (host gets target,
   * players don't), plus the public progress snapshot, plus the requesting
   * player's private board so their own grid doesn't reset on remount.
   */
  getResyncEvents({ isHost = false, playerId } = {}) {
    const events = [];
    const w = this.gameState.wordle;
    if (!w) return events;

    if (w.phase === 'intro') {
      events.push({
        name: 'wordle:intro',
        payload: {
          title: 'Wordle',
          description: 'Guess the 5-letter word in 6 tries. Same word for everyone.',
          scoringRules: [
            'Solving = 50 base + efficiency + speed (up to ~220 total)',
            'Not solving = partial credit per unique green / yellow letter',
            'First solver: +10 bonus'
          ],
          duration: Math.max(0, (w.endsAt || Date.now()) - Date.now()),
          endsAt: w.endsAt || null
        }
      });
    } else if (w.phase === 'playing') {
      events.push({
        name: 'wordle:round:start',
        payload: {
          duration: Math.max(0, (w.endsAt || Date.now()) - Date.now()),
          endsAt: w.endsAt,
          maxGuesses: MAX_GUESSES
        }
      });

      // Host-only: the target word, mirroring the original emit in _startRound.
      if (isHost && w.answer) {
        events.push({
          name: 'wordle:round:start:host',
          payload: { target: w.answer }
        });
      }

      // Public progress (color rows for every player) so host tracker repaints.
      const playerProgress = {};
      for (const [pid, ps] of Object.entries(w.players || {})) {
        playerProgress[pid] = {
          guessesUsed: ps.guessesUsed,
          solved: ps.solved,
          colorRows: ps.history.map((h) => h.colors)
        };
      }
      events.push({ name: 'wordle:progress', payload: { playerProgress } });

      // Requesting player's private board (letters + colors). Other players'
      // letters never leak — only the colors went out in `wordle:progress`.
      if (playerId && w.players[playerId]) {
        const ps = w.players[playerId];
        // Replay each historical guess so the client can rebuild its grid.
        for (const row of ps.history) {
          events.push({
            name: 'wordle:guess:result',
            payload: {
              guess: row.guess,
              colors: row.colors,
              guessesUsed: ps.guessesUsed,
              guessesRemaining: MAX_GUESSES - ps.guessesUsed,
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
