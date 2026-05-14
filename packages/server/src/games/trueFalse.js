/**
 * True/False Game Module
 * Features: Rapid-fire true/false statements, accuracy scoring
 */

import { Timer } from '../utils/timer.js';
import { contentStore } from '../contentStore.js';

const INTRO_DURATION = 30000;
const ANSWER_REVEAL_DURATION = 5000;
const INTER_ROUND_LEADERBOARD_DURATION = 5000;

export class TrueFalseGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.statementTimer = null;
    this.pendingTimeouts = []; // Track setTimeout IDs for pause/resume

    // Initialize game state
    this.gameState.trueFalse = {
      phase: 'intro', // intro | playing | results
      currentStatement: null,
      statementNumber: 0,
      totalStatements: 20,
      playerAnswers: new Map(), // playerId -> { correct, total, streak }
      usedStatements: new Set(),
      answeredPlayers: new Set(), // Track who answered current statement
      introEndsAt: null
    };

    // Track player streaks separately
    this.playerStreaks = new Map();
  }

  /**
   * Start the True/False game
   */
  start() {
    console.log('[TRUE/FALSE] Starting game');

    // Initialize player answer tracking and streaks
    for (const [playerId] of this.gameState.players) {
      this.gameState.trueFalse.playerAnswers.set(playerId, {
        correct: 0,
        total: 0
      });
      this.playerStreaks.set(playerId, 0);
    }

    // Show intro
    this.showIntro();
  }

  /**
   * Show game intro
   */
  showIntro() {
    this.gameState.trueFalse.phase = 'intro';

    console.log('[TRUE/FALSE] Showing intro and rules');
    this.gameState.trueFalse.introEndsAt = Date.now() + INTRO_DURATION;

    this.io.emit('truefalse:intro', {
      title: 'True or False Rapid Fire',
      description: '20 statements, answer as fast as you can!',
      scoringRules: [
        'Base: 10 points per correct answer',
        '2 in a row: 12 pts',
        '3 in a row: 14 pts',
        '4 in a row: 16 pts',
        '5+ in a row: 18+ pts',
        'Formula: 10 + (2 × (streak - 1)) points',
        'Wrong answer resets streak'
      ],
      placementInfo: 'Your rank in this game determines your placement score',
      totalStatements: this.gameState.trueFalse.totalStatements,
      timePerStatement: 5000,
      duration: INTRO_DURATION,
      endsAt: this.gameState.trueFalse.introEndsAt
    });

    // Start game after 30 seconds
    this.timer = new Timer(INTRO_DURATION, null, () => {
      this.nextStatement();
    });
    this.timer.start();
  }

  /**
   * Show next statement
   */
  nextStatement() {
    this.gameState.trueFalse.statementNumber++;

    // Check if game is over
    if (this.gameState.trueFalse.statementNumber > this.gameState.trueFalse.totalStatements) {
      this.endGame();
      return;
    }

    this.gameState.trueFalse.phase = 'playing';
    this.gameState.trueFalse.introEndsAt = null;

    // Select random unused statement
    const availableStatements = contentStore.getStatements().filter(
      s => !this.gameState.trueFalse.usedStatements.has(s.id)
    );

    if (availableStatements.length === 0) {
      console.warn('[TRUE/FALSE] No more statements available');
      this.endGame();
      return;
    }

    const statement = availableStatements[Math.floor(Math.random() * availableStatements.length)];
    this.gameState.trueFalse.usedStatements.add(statement.id);

    this.gameState.trueFalse.currentStatement = statement;
    this.gameState.trueFalse.answeredPlayers.clear();

    console.log(`[TRUE/FALSE] Statement ${this.gameState.trueFalse.statementNumber}: ${statement.statement}`);

    // Emit statement to all players (without answer)
    this.io.emit('truefalse:statement', {
      statementId: statement.id,
      statement: statement.statement,
      statementNumber: this.gameState.trueFalse.statementNumber,
      totalStatements: this.gameState.trueFalse.totalStatements,
      duration: 5000 // 5 seconds to answer
    });

    // Auto-advance after 5 seconds
    this.statementTimer = new Timer(5000, null, () => {
      this.showAnswer();
    });
    this.statementTimer.start();
  }

  /**
   * Handle player answer
   * @param {string} playerId - Player ID
   * @param {boolean} answer - true or false
   */
  handleAnswer(playerId, answer) {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.warn('[TRUE/FALSE] Player not found:', playerId);
      return;
    }

    const playerAnswers = this.gameState.trueFalse.playerAnswers.get(playerId);
    if (!playerAnswers) {
      console.warn('[TRUE/FALSE] Player answers not found:', playerId);
      return;
    }

    // Check if already answered current statement
    if (this.gameState.trueFalse.answeredPlayers.has(playerId)) {
      console.warn(`[TRUE/FALSE] ${player.name} already answered current statement`);
      return;
    }
    this.gameState.trueFalse.answeredPlayers.add(playerId);

    const statement = this.gameState.trueFalse.currentStatement;
    const isValidAnswer = typeof answer === 'boolean';
    const isCorrect = isValidAnswer && answer === statement.answer;

    // Get current streak
    let currentStreak = this.playerStreaks.get(playerId) || 0;
    let pointsEarned = 0;

    if (isCorrect) {
      playerAnswers.correct++;
      // Increment streak
      currentStreak++;
      this.playerStreaks.set(playerId, currentStreak);

      // Calculate points: 10 + (2 × (streak - 1))
      // streak 1 = 10, streak 2 = 12, streak 3 = 14, streak 5 = 18
      pointsEarned = 10 + (2 * (currentStreak - 1));

      // Award points to player
      player.score += pointsEarned;
    } else {
      // Reset streak on wrong answer
      currentStreak = 0;
      this.playerStreaks.set(playerId, 0);
      pointsEarned = 0;
    }

    playerAnswers.total++;

    console.log(`[TRUE/FALSE] ${player.name} answered: ${answer} - ${isCorrect ? 'Correct' : 'Wrong'} - Streak: ${currentStreak} - Points: ${pointsEarned} (Total: ${player.score})`);

    // Emit answer confirmation to player (streak hidden until round end)
    const socket = this.io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('truefalse:answer:received', {
        answer,
        confirmed: true,
        isCorrect,
        streak: currentStreak,
        pointsEarned
      });
    }

    // Notify host (include correctness)
    if (this.gameState.meta.hostSocketId) {
      this.io.to(this.gameState.meta.hostSocketId).emit('host:player_answered', {
        playerId,
        game: 'trueFalse',
        isCorrect
      });
    }
  }

  /**
   * Show answer for current statement
   */
  showAnswer() {
    const statement = this.gameState.trueFalse.currentStatement;

    for (const [playerId] of this.gameState.players) {
      if (!this.gameState.trueFalse.answeredPlayers.has(playerId)) {
        const playerAnswers = this.gameState.trueFalse.playerAnswers.get(playerId);
        if (playerAnswers) {
          playerAnswers.total++;
        }
        this.playerStreaks.set(playerId, 0);
      }
    }

    const placements = new Map(
      Array.from(this.gameState.players.values())
        .filter(player => player.connected)
        .sort((a, b) => b.score - a.score)
        .map((player, index) => [player.id, index + 1])
    );

    console.log(`[TRUE/FALSE] Showing answer: ${statement.answer}`);

    // Build per-player results for this statement
    const playerResults = {};
    for (const [playerId] of this.gameState.players) {
      const answered = this.gameState.trueFalse.answeredPlayers.has(playerId);
      const playerAnswer = answered ? this.gameState.trueFalse.playerAnswers.get(playerId) : null;
      const streak = this.playerStreaks.get(playerId) || 0;
      playerResults[playerId] = {
        answered,
        streak,
        score: this.gameState.players.get(playerId)?.score || 0,
        placement: placements.get(playerId) || null
      };
    }

    const leaderboard = this.gameEngine.getLeaderboard().map((entry) => ({
      ...entry,
      streak: this.playerStreaks.get(entry.id) || 0
    }));

    // Emit answer to all players (with streaks revealed after round)
    this.io.emit('truefalse:answer', {
      statementId: statement.id,
      statement: statement.statement,
      statementNumber: this.gameState.trueFalse.statementNumber,
      totalStatements: this.gameState.trueFalse.totalStatements,
      correctAnswer: statement.answer,
      explanation: statement.explanation || '',
      playerResults,
      leaderboard
    });

    this.gameEngine.broadcastPlayerList();

    // Per QA 2026-05-14 §16: re-introduce an inter-statement leaderboard
    // between rounds. Skipped after the final statement, which hands off to
    // endGame().
    const isFinal = this.gameState.trueFalse.statementNumber >= this.gameState.trueFalse.totalStatements;
    if (isFinal) {
      this.trackTimeout(() => this.nextStatement(), ANSWER_REVEAL_DURATION);
    } else {
      this.trackTimeout(() => {
        const board = this.gameEngine.getLeaderboard();
        this.io.emit('truefalse:leaderboard:show', {
          leaderboard: board,
          duration: INTER_ROUND_LEADERBOARD_DURATION,
          endsAt: Date.now() + INTER_ROUND_LEADERBOARD_DURATION
        });
        this.trackTimeout(() => this.nextStatement(), INTER_ROUND_LEADERBOARD_DURATION);
      }, ANSWER_REVEAL_DURATION);
    }
  }

  /**
   * End the game and calculate final scores
   */
  endGame() {
    console.log('[TRUE/FALSE] ========== GAME ENDED ==========');

    this.gameState.trueFalse.phase = 'results';

    const results = [];

    // Build results from player answers (scores already calculated during gameplay)
    for (const [playerId, answerData] of this.gameState.trueFalse.playerAnswers) {
      const player = this.gameState.players.get(playerId);
      if (!player) continue;

      const accuracy = answerData.total > 0 ? (answerData.correct / answerData.total) * 100 : 0;

      results.push({
        playerId,
        playerName: player.name,
        correct: answerData.correct,
        total: answerData.total,
        accuracy: Math.round(accuracy),
        points: player.score, // Use already-calculated score
        newScore: player.score
      });

      console.log(`[TRUE/FALSE] ${player.name}: ${answerData.correct}/${answerData.total} correct (${Math.round(accuracy)}% accuracy) - Final Score: ${player.score}`);
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.newScore - a.newScore);

    // Emit results
    this.io.emit('truefalse:end', {
      results,
      finalLeaderboard: this.gameEngine.getLeaderboard()
    });

    // Broadcast updated player list
    this.gameEngine.broadcastPlayerList();

    // End game in game engine
    this.trackTimeout(() => {
      this.gameEngine.endGame();
    }, 5000);
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

  /**
   * Pause the game
   */
  pause() {
    console.log('[TRUE/FALSE] Pausing game');

    if (this.timer) {
      this.timer.pause();
    }

    if (this.statementTimer) {
      this.statementTimer.pause();
    }

    // Clear all pending timeouts
    this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingTimeouts = [];

    console.log('[TRUE/FALSE] Game paused - all timers stopped');
  }

  /**
   * Resume the game
   */
  resume() {
    console.log('[TRUE/FALSE] Resuming game');

    if (this.timer) {
      this.timer.resume();
    }

    if (this.statementTimer) {
      this.statementTimer.resume();
    }

    console.log('[TRUE/FALSE] Game resumed');
  }

  /**
   * Cleanup/destroy - stop all timers
   */
  cleanup() {
    console.log('[TRUE/FALSE] ========== CLEANUP ==========');

    // Stop intro/main timer
    if (this.timer) {
      console.log('[TRUE/FALSE] Stopping main timer');
      this.timer.stop();
      this.timer = null;
    }

    // Stop statement timer
    if (this.statementTimer) {
      console.log('[TRUE/FALSE] Stopping statement timer');
      this.statementTimer.stop();
      this.statementTimer = null;
    }

    // Clear all pending timeouts
    console.log(`[TRUE/FALSE] Clearing ${this.pendingTimeouts.length} pending timeouts`);
    this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingTimeouts = [];

    console.log('[TRUE/FALSE] Cleanup complete');
  }

  /**
   * Per bug-report 2026-05-14 §A5: see quiz.js. The statement payload has no
   * answer-secret (the truth value lives only on the server until showAnswer
   * is called), so we can replay to host or player indistinguishably.
   */
  getResyncEvents(/* { socketId, playerId, isHost } */) {
    const events = [];
    const tf = this.gameState.trueFalse;
    if (!tf) return events;

    if (tf.phase === 'intro' && tf.introEndsAt) {
      const remaining = Math.max(0, tf.introEndsAt - Date.now());
      events.push({
        name: 'truefalse:intro',
        payload: {
          title: 'True or False Rapid Fire',
          description: '20 statements, answer as fast as you can!',
          scoringRules: [
            'Base: 10 points per correct answer',
            '2 in a row: 12 pts',
            '3 in a row: 14 pts',
            '4 in a row: 16 pts',
            '5+ in a row: 18+ pts',
            'Formula: 10 + (2 × (streak - 1)) points',
            'Wrong answer resets streak'
          ],
          placementInfo: 'Your rank in this game determines your placement score',
          totalStatements: tf.totalStatements,
          timePerStatement: 5000,
          duration: remaining,
          endsAt: tf.introEndsAt
        }
      });
    } else if (tf.phase === 'playing' && tf.currentStatement) {
      events.push({
        name: 'truefalse:statement',
        payload: {
          statementId: tf.currentStatement.id,
          statement: tf.currentStatement.statement,
          statementNumber: tf.statementNumber,
          totalStatements: tf.totalStatements,
          duration: 5000
        }
      });
    }
    return events;
  }

  /**
   * Get current game state
   */
  getState() {
    return {
      phase: this.gameState.trueFalse.phase,
      statementNumber: this.gameState.trueFalse.statementNumber,
      totalStatements: this.gameState.trueFalse.totalStatements,
      introEndsAt: this.gameState.trueFalse.introEndsAt,
      currentStatement: this.gameState.trueFalse.currentStatement ? {
        id: this.gameState.trueFalse.currentStatement.id,
        statement: this.gameState.trueFalse.currentStatement.statement
      } : null
    };
  }
}
