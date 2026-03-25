import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import stringSimilarity from 'string-similarity';
import { Timer } from '../utils/timer.js';
import { updatePlayerPlacements } from '../utils/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load pointless data
const pointlessDataPath = join(__dirname, '../data/pointless.json');
const pointlessData = JSON.parse(readFileSync(pointlessDataPath, 'utf-8'));

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
      answers: new Map(), // playerId -> { text, score, isCorrect, originalInput }
      startTime: null,
      revealIndex: 0
    };
  }

  /**
   * Start the game
   */
  start() {
    console.log('[POINTLESS] Starting Pointless game');
    this.startRound(0);
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

    if (index >= pointlessData.length) {
      this.endGame();
      return;
    }

    const roundData = pointlessData[index];

    this.gameState.pointless.phase = 'playing';
    this.gameState.pointless.roundIndex = index;
    this.gameState.pointless.currentRound = {
      id: roundData.id,
      category: roundData.category,
      question: roundData.question,
      // Don't send answers to client!
    };
    this.gameState.pointless.answers.clear();
    this.gameState.pointless.startTime = Date.now();
    this.gameState.pointless.revealIndex = 0;

    console.log(`[POINTLESS] Starting Round ${index + 1}: ${roundData.category}`);

    // Emit round start to all players
    this.io.emit('pointless:round:start', {
      roundIndex: index,
      totalRounds: pointlessData.length,
      category: roundData.category,
      question: roundData.question,
      duration: 20000 // 20 seconds to answer
    });

    // Auto-reveal after 20 seconds
    this.timer = new Timer(20000, null, () => {
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

    const roundData = pointlessData[this.gameState.pointless.roundIndex];
    const answers = roundData.answers; // Object: { "answer": score }

    let score = 100;
    let isCorrect = false;
    let matchedAnswer = null;

    const strippedInput = stripArticles(input);

    // 1. Exact match check (try both original and stripped)
    if (answers.hasOwnProperty(input)) {
      score = answers[input];
      isCorrect = true;
      matchedAnswer = input;
    } else if (answers.hasOwnProperty(strippedInput)) {
      score = answers[strippedInput];
      isCorrect = true;
      matchedAnswer = strippedInput;
      console.log(`[POINTLESS] Article-stripped match: "${input}" -> "${strippedInput}"`);
    } else {
      // 2. Fuzzy match check with stripped candidates
      const candidates = Object.keys(answers);
      const strippedCandidates = candidates.map(stripArticles);
      const matches = stringSimilarity.findBestMatch(strippedInput, strippedCandidates);
      const bestMatch = matches.bestMatch;

      if (bestMatch.rating > 0.75) {  // Reduced threshold from 0.85 to 0.75
        // Find original answer key
        const matchIndex = strippedCandidates.indexOf(bestMatch.target);
        matchedAnswer = candidates[matchIndex];
        score = answers[matchedAnswer];
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
  }

  /**
   * End round (stop accepting answers)
   */
  endRound() {
    if (this.timer) this.timer.stop();
    
    // Safety check
    if (!this.gameState.pointless) {
      return;
    }

    this.gameState.pointless.phase = 'reveal';
    console.log('[POINTLESS] Round ended. Waiting for host to reveal.');

    // Calculate scores for non-submitters (100 points)
    for (const [playerId, player] of this.gameState.players) {
      if (!this.gameState.pointless.answers.has(playerId)) {
        this.gameState.pointless.answers.set(playerId, {
          text: "No Answer",
          originalInput: "",
          score: 100,
          isCorrect: false
        });
      }
    }

    this.io.emit('pointless:round:end', {
      answerCount: this.gameState.pointless.answers.size
    });

    // Notify host it's ready to reveal
    this.updateHost();

    // Auto-reveal after brief delay
    this.trackTimeout(() => {
      this.revealResults();
    }, 1000);
  }

  /**
   * Reveal results for all players simultaneously
   */
  revealResults() {
    const triggerTime = Date.now() + 2000; // 2 seconds in future

    console.log(`[POINTLESS] Revealing results at ${triggerTime}`);

    // Send individual results to each player
    for (const [playerId, answerData] of this.gameState.pointless.answers) {
      const player = this.gameState.players.get(playerId);
      if (player && player.connected) {
        // Update score
        player.score += answerData.score;

        const socket = this.io.sockets.sockets.get(player.socketId);
        if (socket) {
          socket.emit('game:pointless:reveal', {
            score: answerData.score,
            triggerTime,
            isCorrect: answerData.isCorrect,
            correctAnswer: answerData.text,
            originalInput: answerData.originalInput
          });
        }
      }
    }

    // Also update host with full results
    // Wait for animation to finish (3s + 2s buffer) before moving on
    this.trackTimeout(() => {
      this.finishRound();
    }, 6000);
  }

  finishRound() {
    // Show round summary / leaderboard
    this.gameEngine.broadcastPlayerList();

    // Wait then next round
    this.trackTimeout(() => {
      const nextRound = this.gameState.pointless.roundIndex + 1;
      if (nextRound < pointlessData.length) {
        this.startRound(nextRound);
      } else {
        this.endGame();
      }
    }, 5000);
  }

  updateHost() {
    // Optional: push specific state to host if needed outside standard polling
  }

  endGame() {
    console.log('[POINTLESS] Game finished');
    this.gameState.pointless.phase = 'finished';
    updatePlayerPlacements(this.gameState.players, 'pointless'); // Add 'pointless' to valid games if needed or reuse a slot

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
      totalRounds: pointlessData.length,
      currentRound: this.gameState.pointless.currentRound,
      answerCount: this.gameState.pointless.answers.size
    };
  }
}


