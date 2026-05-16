import stringSimilarity from 'string-similarity';
import { Timer } from '../utils/timer.js';
import { contentStore } from '../contentStore.js';

export const POINTLESS_ROUND_DURATION = 60000;
const POINTLESS_INTRO_DURATION = 30000;
const POINTLESS_REVEAL_DURATION = 8000;
const ANSWER_LABEL_OVERRIDES = {
  coda: 'CODA'
};

const MINOR_TITLE_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to'
]);

const formatAnswerLabel = (value) => {
  if (!value) {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (ANSWER_LABEL_OVERRIDES[normalized]) {
    return ANSWER_LABEL_OVERRIDES[normalized];
  }

  return normalized
    .split(' ')
    .map((word, index) => {
      if (!word) {
        return word;
      }

      if (index > 0 && MINOR_TITLE_WORDS.has(word)) {
        return word;
      }

      return word
        .split('-')
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join('-');
    })
    .join(' ');
};

const normalizeAnswerEntry = ([answer, rawValue]) => {
  if (typeof rawValue === 'number') {
    return {
      answer,
      displayText: formatAnswerLabel(answer),
      score: rawValue
    };
  }

  return {
    answer,
    displayText: rawValue.label || formatAnswerLabel(answer),
    score: rawValue.score
  };
};

export class PointlessGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.pendingTimeouts = []; // Track setTimeout IDs for cleanup

    // Initialize pointless state
    this.gameState.pointless = {
      phase: 'intro', // intro | playing | reveal | finished
      roundIndex: 0,
      currentRound: null,
      answers: new Map(), // playerId -> { text, displayText, score, isCorrect, originalInput }
      introEndsAt: null,
      startTime: null,
      revealIndex: 0,
      hasRevealed: false,
      obscureAnswers: [],
      frequentAnswers: []
    };
  }

  /**
   * Start the game
   */
  start() {
    console.log('[POINTLESS] Starting Pointless game');
    this.showIntro();
  }

  showIntro() {
    this.gameState.pointless.phase = 'intro';
    this.gameState.pointless.introEndsAt = Date.now() + POINTLESS_INTRO_DURATION;

    this.io.emit('pointless:intro', {
      title: 'Pointless',
      description: 'We asked 100 people. Find an official answer that as few of them gave as possible.',
      scoringRules: [
        'Each official answer is scored by how many people said it',
        'Lower scores are better',
        'A pointless answer scores 0',
        'Invalid or missing answers score 100'
      ],
      placementInfo: 'Lowest total score wins this game',
      totalRounds: contentStore.getPointlessRounds().length,
      duration: POINTLESS_INTRO_DURATION,
      endsAt: this.gameState.pointless.introEndsAt
    });

    this.timer = new Timer(POINTLESS_INTRO_DURATION, null, () => {
      this.startRound(0);
    });
    this.timer.start();
  }

  /**
   * Start a specific round
   * @param {number} index - Round index
   */
  startRound(index) {
    // Stop existing timer if any
    if (this.timer) {
      this.timer.stop();
      this.timer = null;
    }

    if (index >= contentStore.getPointlessRounds().length) {
      this.endGame();
      return;
    }

    const roundData = contentStore.getPointlessRounds()[index];

    this.gameState.pointless.phase = 'playing';
    this.gameState.pointless.roundIndex = index;
    this.gameState.pointless.currentRound = {
      id: roundData.id,
      category: roundData.category,
      question: roundData.question,
      // Don't send answers to client!
    };
    this.gameState.pointless.answers.clear();
    this.gameState.pointless.introEndsAt = null;
    this.gameState.pointless.startTime = Date.now();
    this.gameState.pointless.revealIndex = 0;
    this.gameState.pointless.hasRevealed = false;
    this.gameState.pointless.obscureAnswers = [];
    this.gameState.pointless.frequentAnswers = [];

    console.log(`[POINTLESS] Starting Round ${index + 1}: ${roundData.category}`);

    // Emit round start to all players
    this.io.emit('pointless:round:start', {
      roundIndex: index,
      totalRounds: contentStore.getPointlessRounds().length,
      category: roundData.category,
      question: roundData.question,
      duration: POINTLESS_ROUND_DURATION
    });

    // Per §D1: prime the host tracker with everyone shown as still thinking.
    this.broadcastProgress();

    // Auto-reveal after the answer window closes
    this.timer = new Timer(POINTLESS_ROUND_DURATION, null, () => {
      this.endRound();
    });
    this.timer.start();
  }

  /**
   * Handle player answer submission
   * @param {string} playerId 
   * @param {string} text 
   */
  submitAnswer(playerId, text) {
    if (this.gameState.pointless.phase !== 'playing') return;

    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Strip common articles helper function
    const stripArticles = (str) => {
      return str.replace(/^(the|a|an)\s+/i, '').trim();
    };

    // Sanitize input
    const input = text.trim().toLowerCase();
    if (!input) return;

    console.log(`[POINTLESS] Player ${player.name} submitted: "${text}"`);

    // Check if already submitted
    if (this.gameState.pointless.answers.has(playerId)) {
      console.warn(`[POINTLESS] ${player.name} already submitted`);
      return;
    }

    const roundData = contentStore.getPointlessRounds()[this.gameState.pointless.roundIndex];
    const answerEntries = Object.entries(roundData.answers).map(normalizeAnswerEntry);
    const answers = new Map(answerEntries.map((entry) => [entry.answer, entry]));

    let score = 100;
    let isCorrect = false;
    let matchedAnswer = null;
    let matchedDisplayText = null;

    const strippedInput = stripArticles(input);

    // 1. Exact match check (try both original and stripped)
    if (answers.has(input)) {
      score = answers.get(input).score;
      isCorrect = true;
      matchedAnswer = input;
      matchedDisplayText = answers.get(input).displayText;
    } else if (answers.has(strippedInput)) {
      score = answers.get(strippedInput).score;
      isCorrect = true;
      matchedAnswer = strippedInput;
      matchedDisplayText = answers.get(strippedInput).displayText;
      console.log(`[POINTLESS] Article-stripped match: "${input}" -> "${strippedInput}"`);
    } else {
      // 2. Fuzzy match check with stripped candidates
      const candidates = Array.from(answers.keys());
      const strippedCandidates = candidates.map(stripArticles);
      const matches = stringSimilarity.findBestMatch(strippedInput, strippedCandidates);
      const bestMatch = matches.bestMatch;

      if (bestMatch.rating > 0.75) {  // Reduced threshold from 0.85 to 0.75
        // Find original answer key
        const matchIndex = strippedCandidates.indexOf(bestMatch.target);
        matchedAnswer = candidates[matchIndex];
        score = answers.get(matchedAnswer).score;
        matchedDisplayText = answers.get(matchedAnswer).displayText;
        isCorrect = true;
        console.log(`[POINTLESS] Fuzzy match: "${input}" -> "${matchedAnswer}" (Rating: ${bestMatch.rating.toFixed(2)})`);
      } else {
        // Incorrect
        score = 100;
        isCorrect = false;
        console.log(`[POINTLESS] No match for "${input}" (Best: "${bestMatch.target}" @ ${bestMatch.rating.toFixed(2)})`);
      }
    }

    // Store result (do NOT reveal yet)
    this.gameState.pointless.answers.set(playerId, {
      text: matchedAnswer || input, // Use corrected text if matched
      displayText: matchedDisplayText || text.trim(),
      originalInput: text,
      score,
      isCorrect
    });

    // Emit confirmation to player only
    const socket = this.io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('pointless:answer:received', { text });
    }

    // Notify host of submission count
    this.updateHost();

    // Notify host of specific player answer
    if (this.gameState.meta.hostSocketId) {
      this.io.to(this.gameState.meta.hostSocketId).emit('host:player_answered', {
        playerId,
        game: 'pointless'
      });
    }

    // Per bug-report 2026-05-14 §D1: broadcast per-player progress so the host
    // display can render the locked-in / still-thinking tracker live.
    this.broadcastProgress();

    // Early-end: once every connected player has submitted, don't waste the
    // remaining timer — close the round immediately.
    const connectedIds = Array.from(this.gameState.players.entries())
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    if (connectedIds.length > 0 && connectedIds.every((id) => this.gameState.pointless.answers.has(id))) {
      if (this.timer) { this.timer.stop(); this.timer = null; }
      this.endRound();
    }
  }

  /**
   * Per bug-report 2026-05-14 §D1/D2: emit a per-player status snapshot so the
   * host display can render the player tracker live without polling.
   *
   * Status values:
   *   - 'submitted': the player has locked in an answer for this round
   *   - 'none':      no submission yet (or no submission by end of round)
   */
  broadcastProgress() {
    if (!this.gameState.pointless) return;
    const playerProgress = {};
    for (const [playerId] of this.gameState.players) {
      playerProgress[playerId] = {
        status: this.gameState.pointless.answers.has(playerId) ? 'submitted' : 'none'
      };
    }
    this.io.emit('pointless:progress', {
      roundIndex: this.gameState.pointless.roundIndex,
      submissionCount: this.gameState.pointless.answers.size,
      playerProgress
    });
  }

  /**
   * End round (stop accepting answers).
   *
   * Per bug-report 2026-05-14 §D3: the host no longer has to click "Reveal" —
   * the reveal animation auto-starts as soon as the 30s submission window
   * closes. The 'reveal' case in host:control is kept as an optional
   * "reveal early" shortcut (skips the remaining submission time by calling
   * revealResults() directly), but the default flow does not require it.
   */
  endRound() {
    if (this.timer) this.timer.stop();

    // Safety check
    if (!this.gameState.pointless || this.gameState.pointless.phase !== 'playing') {
      return;
    }

    this.gameState.pointless.phase = 'reveal';
    console.log('[POINTLESS] Round ended. Auto-revealing results.');

    // Calculate scores for non-submitters (100 points)
    for (const [playerId, player] of this.gameState.players) {
      if (!this.gameState.pointless.answers.has(playerId)) {
        this.gameState.pointless.answers.set(playerId, {
          text: "No Answer",
          displayText: "No Answer",
          originalInput: "",
          score: 100,
          isCorrect: false
        });
      }
    }

    this.io.emit('pointless:round:end', {
      answerCount: this.gameState.pointless.answers.size
    });

    // Notify host it's ready to reveal (kept for any consumers tracking phase)
    this.updateHost();

    // Auto-reveal — no host action required.
    this.revealResults();
  }

  /**
   * Reveal results for all players simultaneously
   */
  revealResults() {
    if (!this.gameState.pointless || this.gameState.pointless.phase !== 'reveal') {
      console.warn('[POINTLESS] Reveal requested outside reveal phase');
      return;
    }

    if (this.gameState.pointless.hasRevealed) {
      console.warn('[POINTLESS] Reveal already completed for this round');
      return;
    }

    this.gameState.pointless.hasRevealed = true;
    const triggerTime = Date.now() + 250;
    const highlights = this.getRoundHighlights();
    this.gameState.pointless.obscureAnswers = highlights.obscureAnswers;
    this.gameState.pointless.frequentAnswers = highlights.frequentAnswers;

    console.log(`[POINTLESS] Revealing results at ${triggerTime}`);

    this.io.emit('pointless:reveal:display', this.getDisplayRevealPayload(triggerTime));

    // Emit per-player array to host for sequential ScoreDrop reveals
    const playerReveals = [];
    for (const [playerId, answerData] of this.gameState.pointless.answers) {
      const player = this.gameState.players.get(playerId);
      if (!player) continue;
      playerReveals.push({
        playerId,
        playerName: player.name,
        score: answerData.score,
        originalInput: answerData.originalInput,
        isCorrect: answerData.isCorrect,
        correctAnswer: answerData.displayText,
        triggerTime
      });
    }
    // Sort by score ascending so lowest (best) reveals last — most dramatic.
    // Per QA 2026-05-14 §17: only player sockets receive this payload — never
    // the host. Send per-player so no broadcast lands on the host's connection.
    playerReveals.sort((a, b) => b.score - a.score);
    for (const [playerId] of this.gameState.players) {
      const player = this.gameState.players.get(playerId);
      if (!player?.connected) continue;
      const socket = this.io.sockets.sockets.get(player.socketId);
      if (socket) socket.emit('pointless:reveal:players', { players: playerReveals });
    }

    // Update scores for ALL players, emit results only to connected ones
    for (const [playerId, answerData] of this.gameState.pointless.answers) {
      const player = this.gameState.players.get(playerId);
      if (!player) continue;

      // Always update score regardless of connection status
      player.score += answerData.score;

      // Only emit to connected players with active sockets
      if (player.connected) {
        const socket = this.io.sockets.sockets.get(player.socketId);
        if (socket) {
          socket.emit('game:pointless:reveal', this.getRevealPayload(playerId, triggerTime));
        }
      }
    }

    this.gameEngine.broadcastPlayerList();

    // Per bug-report 2026-05-14 §A4: drop the inter-round leaderboard pop and
    // chain straight from the reveal animation to the next round.
    this.trackTimeout(() => {
      this.finishRound();
    }, POINTLESS_REVEAL_DURATION);
  }

  finishRound() {
    const nextRound = this.gameState.pointless.roundIndex + 1;
    if (nextRound < contentStore.getPointlessRounds().length) {
      this.startRound(nextRound);
    } else {
      this.endGame();
    }
  }

  updateHost() {
    // Optional: push specific state to host if needed outside standard polling
  }

  getRoundHighlights() {
    const roundData = contentStore.getPointlessRounds()[this.gameState.pointless.roundIndex];
    if (!roundData?.answers) {
      return {
        obscureAnswers: [],
        frequentAnswers: []
      };
    }

    const normalizedAnswers = Object.entries(roundData.answers)
      .map(normalizeAnswerEntry)
      .map(({ answer, displayText, score }) => ({
        answer: displayText,
        score,
        isPointless: score === 0,
        normalizedAnswer: answer
      }));

    const obscureAnswers = [...normalizedAnswers]
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score;
        }

        return a.answer.localeCompare(b.answer);
      })
      .slice(0, 3);

    const frequentAnswers = [...normalizedAnswers]
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }

        return a.answer.localeCompare(b.answer);
      })
      .slice(0, 3);

    return {
      obscureAnswers,
      frequentAnswers
    };
  }

  getRevealPayload(playerId, triggerTime = Date.now() + 400) {
    const answerData = this.gameState.pointless.answers.get(playerId);
    if (!answerData) {
      return null;
    }

    return {
      score: answerData.score,
      triggerTime,
      isCorrect: answerData.isCorrect,
      correctAnswer: answerData.displayText,
      originalInput: answerData.originalInput
    };
  }

  getDisplayRevealPayload(triggerTime = Date.now() + 250) {
    const roundData = contentStore.getPointlessRounds()[this.gameState.pointless.roundIndex];
    if (!roundData) {
      return null;
    }

    return {
      triggerTime,
      roundIndex: this.gameState.pointless.roundIndex,
      totalRounds: contentStore.getPointlessRounds().length,
      category: roundData.category,
      question: roundData.question,
      obscureAnswers: this.gameState.pointless.obscureAnswers || [],
      frequentAnswers: this.gameState.pointless.frequentAnswers || []
    };
  }

  endGame() {
    console.log('[POINTLESS] Game finished');
    this.gameState.pointless.phase = 'finished';

    this.io.emit('pointless:end', {
      leaderboard: this.gameEngine.getLeaderboard()
    });

    this.trackTimeout(() => {
      this.gameEngine.endGame();
    }, 3000);
  }

  /**
   * Pause the game
   */
  pause() {
    if (this.timer) {
      this.timer.pause();
      console.log('[POINTLESS] Game paused');
    }
  }

  /**
   * Resume the game
   */
  resume() {
    if (this.timer) {
      this.timer.resume();
      console.log('[POINTLESS] Game resumed');
    }
  }

  /**
   * Helper to track setTimeout calls
   */
  trackTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
      this.pendingTimeouts = this.pendingTimeouts.filter(id => id !== timeoutId);
      callback();
    }, delay);
    this.pendingTimeouts.push(timeoutId);
    return timeoutId;
  }

  cleanup() {
    console.log('[POINTLESS] ========== CLEANUP ==========');

    if (this.timer) {
      console.log('[POINTLESS] Stopping timer');
      this.timer.stop();
      this.timer = null;
    }

    // Clear all pending timeouts
    console.log(`[POINTLESS] Clearing ${this.pendingTimeouts.length} pending timeouts`);
    this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingTimeouts = [];

    console.log('[POINTLESS] Cleanup complete');
  }

  getState() {
    return {
      phase: this.gameState.pointless.phase,
      roundIndex: this.gameState.pointless.roundIndex,
      totalRounds: contentStore.getPointlessRounds().length,
      introEndsAt: this.gameState.pointless.introEndsAt,
      currentRound: this.gameState.pointless.currentRound,
      answerCount: this.gameState.pointless.answers.size
    };
  }
}
