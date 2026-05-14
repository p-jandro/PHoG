/**
 * Quiz Game Module
 * Features: Category voting, difficulty-based questions, speed bonuses, leader multiplier
 */

import { Timer } from '../utils/timer.js';
import { calculateQuizScore, getLeader } from '../utils/scoring.js';
import { contentStore } from '../contentStore.js';

const QUESTION_RESULTS_DURATION = 3000;
const INTER_ROUND_LEADERBOARD_DURATION = 5000;

export class QuizGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.pendingTimeouts = []; // Track setTimeout IDs for cleanup

    // Initialize quiz state
    this.gameState.quiz = {
      phase: 'intro', // intro | voting | question | results
      votes: new Map(), // playerId -> optionId
      currentQuestion: null,
      questionStartTime: null,
      introEndsAt: null,
      votingEndsAt: null,
      questionEndsAt: null,
      answers: new Map(), // playerId -> { answer, timeRemaining }
      questionNumber: 0,
      totalQuestions: Math.min(10, contentStore.getQuizRounds().length),
      currentRoundOptions: null
    };
  }

  /**
   * Start the quiz game
   */
  start() {
    console.log('[QUIZ] Starting quiz game');
    this.showIntro();
  }

  /**
   * Show intro with scoring rules
   */
  showIntro() {
    this.gameState.quiz.phase = 'intro';
    this.gameState.quiz.introEndsAt = Date.now() + 30000;

    console.log('[QUIZ] Showing intro and rules');

    // Emit intro to all players
    const duration = 30000;
    this.io.emit('quiz:intro', {
      title: 'Quiz Challenge',
      description: `${this.gameState.quiz.totalQuestions} rounds of trivia questions`,
      scoringRules: [
        'Easy: 100 pts base',
        'Medium: 200 pts base',
        'Hard: 300 pts base',
        'Impossible: 500 pts base',
        'Speed bonus: up to 10% for fast answers',
        'Leader gets 2x voting power'
      ],
      placementInfo: 'Your rank in this game determines your placement score',
      duration,
      endsAt: this.gameState.quiz.introEndsAt
    });

    // Auto-advance after 30 seconds
    this.timer = new Timer(duration, null, () => {
      this.startVoting();
    });
    this.timer.start();
  }

  /**
   * Start category voting phase
   */
  startVoting() {
    this.gameState.quiz.phase = 'voting';
    this.gameState.quiz.introEndsAt = null;
    this.gameState.quiz.votes.clear();

    // Get options for current round
    const roundIndex = this.gameState.quiz.questionNumber; // 0-indexed
    const round = contentStore.getQuizRounds()[roundIndex];

    if (!round) {
      console.error('[QUIZ] No round found for index:', roundIndex);
      this.endQuiz();
      return;
    }

    this.gameState.quiz.currentRoundOptions = round.options;

    // Format options for voting (show as "Category (Difficulty)")
    const votingOptions = round.options.map(opt => ({
      id: opt.id,
      label: `${opt.category} (${opt.difficulty.charAt(0).toUpperCase() + opt.difficulty.slice(1)})`,
      color: opt.color,
      category: opt.category,
      difficulty: opt.difficulty
    }));

    console.log('[QUIZ] Starting voting for round', round.roundNumber);

    // Emit voting start to all players
    const duration = 10000;
    this.gameState.quiz.votingEndsAt = Date.now() + duration;
    this.io.emit('quiz:voting:start', {
      options: votingOptions,
      duration,
      endsAt: Date.now() + duration,
      questionNumber: this.gameState.quiz.questionNumber + 1,
      totalQuestions: this.gameState.quiz.totalQuestions
    });

    // Auto-advance after 10 seconds
    this.timer = new Timer(duration, null, () => {
      this.endVoting();
    });
    this.timer.start();
  }

  /**
   * Handle player vote
   * @param {string} playerId - Player ID
   * @param {string} category - Category voted for
   */
  handleVote(playerId, optionId) {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.warn('[QUIZ] Player not found:', playerId);
      return;
    }

    // Check if already voted
    if (this.gameState.quiz.votes.has(playerId)) {
      console.warn(`[QUIZ] ${player.name} already voted`);
      return;
    }

    // Validate option exists in current round
    const validOption = this.gameState.quiz.currentRoundOptions?.find(opt => opt.id === optionId);
    if (!validOption) {
      console.warn('[QUIZ] Invalid option ID:', optionId);
      return;
    }

    this.gameState.quiz.votes.set(playerId, optionId);
    console.log(`[QUIZ] ${player.name} voted for ${validOption.category} (${validOption.difficulty})`);

    // Emit vote confirmation
    const socket = this.io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('quiz:vote:received', { optionId });
    }
  }

  /**
   * End voting and select winning category
   */
  endVoting() {
    // Safety check: if quiz state has been cleared (game reset/ended), don't continue
    if (!this.gameState.quiz || !this.gameState.quiz.votes) {
      console.log('[QUIZ] endVoting called but quiz state is null (game likely reset)');
      return;
    }

    const votes = this.gameState.quiz.votes;
    const leader = getLeader(this.gameState.players);

    // Tally votes by option ID with 2x multiplier for leader
    const voteCounts = {};
    this.gameState.quiz.currentRoundOptions.forEach(opt => {
      voteCounts[opt.id] = 0;
    });

    for (const [playerId, optionId] of votes) {
      const multiplier = playerId === leader ? 2 : 1;
      voteCounts[optionId] = (voteCounts[optionId] || 0) + multiplier;
    }

    // Find winning option
    let winningOptionId = this.gameState.quiz.currentRoundOptions[0].id; // Default to first option
    let maxVotes = 0;

    for (const [optionId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winningOptionId = optionId;
      }
    }

    const winningOption = this.gameState.quiz.currentRoundOptions.find(opt => opt.id === winningOptionId);

    console.log(`[QUIZ] Voting ended. Winner: ${winningOption.category} (${winningOption.difficulty}) - ${maxVotes} votes`);
    console.log('[QUIZ] Vote counts:', voteCounts);
    this.gameState.quiz.votingEndsAt = null;

    // Emit voting results with vote counts
    this.io.emit('quiz:voting:end', {
      winningOptionId,
      winningOption: {
        category: winningOption.category,
        difficulty: winningOption.difficulty,
        color: winningOption.color
      },
      voteCounts,
      leader
    });

    // Start question after 3 seconds
    this.trackTimeout(() => {
      this.startQuestion(winningOption);
    }, 3000);
  }

  /**
   * Start a new question
   * @param {object} questionOption - Question object from voting
   */
  startQuestion(questionOption) {
    // Ensure any existing timer is stopped
    if (this.timer) {
      this.timer.stop();
      this.timer = null;
    }
    
    this.gameState.quiz.phase = 'question';
    this.gameState.quiz.answers.clear();
    this.gameState.quiz.questionNumber++;

    // Store current question
    this.gameState.quiz.currentQuestion = {
      id: questionOption.id,
      question: questionOption.question,
      answers: questionOption.answers,
      category: questionOption.category,
      difficulty: questionOption.difficulty,
      color: questionOption.color,
      correct: questionOption.correct // Keep this for validation
    };

    this.gameState.quiz.questionStartTime = Date.now();

    console.log(`[QUIZ] Question ${this.gameState.quiz.questionNumber}/${this.gameState.quiz.totalQuestions}: ${questionOption.question}`);

    // Emit question to all players (without correct answer)
    const duration = 12000;
    this.gameState.quiz.questionEndsAt = Date.now() + duration;
    this.io.emit('quiz:question:start', {
      questionId: questionOption.id,
      question: questionOption.question,
      answers: questionOption.answers,
      category: questionOption.category,
      difficulty: questionOption.difficulty,
      color: questionOption.color,
      questionNumber: this.gameState.quiz.questionNumber,
      totalQuestions: this.gameState.quiz.totalQuestions,
      duration,
      endsAt: Date.now() + duration
    });

    // Auto-advance after 12 seconds
    this.timer = new Timer(duration, null, () => {
      this.endQuestion();
    });
    this.timer.start();
  }

  /**
   * Handle player answer
   * @param {string} playerId - Player ID
   * @param {string} answer - Answer choice (A, B, C, D)
   * @param {number} timeRemaining - Time remaining in milliseconds
   */
  handleAnswer(playerId, answer, timeRemaining) {
    console.log(`[QUIZ] handleAnswer called - PlayerId: ${playerId}, Answer: ${answer}, Time: ${timeRemaining}`);

    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.error('[QUIZ] ❌ Player not found:', playerId);
      console.error('[QUIZ] Available players:', Array.from(this.gameState.players.keys()));
      return;
    }

    // Check if already answered
    if (this.gameState.quiz.answers.has(playerId)) {
      console.warn(`[QUIZ] ${player.name} already answered`);
      return;
    }

    this.gameState.quiz.answers.set(playerId, {
      answer,
      timeRemaining
    });

    // Update total response time for tiebreaker
    // Default duration is 12000ms
    const responseTime = 12000 - timeRemaining;
    player.totalResponseTime = (player.totalResponseTime || 0) + responseTime;

    console.log(`[QUIZ] ✓ Answer recorded for ${player.name}: ${answer} (${Math.ceil(timeRemaining / 1000)}s remaining)`);
    console.log(`[QUIZ] Total answers: ${this.gameState.quiz.answers.size}/${this.gameState.players.size}`);

    // Emit answer confirmation
    const socket = this.io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('quiz:answer:received', { answer });
    } else {
      console.error(`[QUIZ] ❌ Socket not found for player ${player.name}`);
    }

    // Notify host (include correctness)
    if (this.gameState.meta.hostSocketId) {
      const isCorrect = answer === this.gameState.quiz.currentQuestion?.correct;
      this.io.to(this.gameState.meta.hostSocketId).emit('host:player_answered', {
        playerId,
        game: 'quiz',
        isCorrect
      });
    }
  }

  /**
   * End current question and calculate scores
   */
  endQuestion() {
    // Safety check: if quiz state has been cleared (game reset/ended), don't continue
    if (!this.gameState.quiz || !this.gameState.quiz.currentQuestion) {
      console.log('[QUIZ] endQuestion called but quiz state is null (game likely reset)');
      return;
    }

    const question = this.gameState.quiz.currentQuestion;
    const correctAnswer = question.correct;
    const difficulty = question.difficulty;
    const totalTime = 12000;
    this.gameState.quiz.questionEndsAt = null;

    console.log(`[QUIZ] ========== ENDING QUESTION ==========`);
    console.log(`[QUIZ] Correct answer: ${correctAnswer}`);
    console.log(`[QUIZ] Total answers received: ${this.gameState.quiz.answers.size}`);

    const results = [];
    const leader = getLeader(this.gameState.players);

    // Calculate scores for all players who answered
    for (const [playerId, answerData] of this.gameState.quiz.answers) {
      const player = this.gameState.players.get(playerId);
      if (!player) {
        console.error(`[QUIZ] ❌ Player ${playerId} not found in players map`);
        continue;
      }

      const isCorrect = answerData.answer === correctAnswer;
      const isLeader = playerId === leader;

      let points = 0;
      if (isCorrect) {
        points = calculateQuizScore(
          difficulty,
          answerData.timeRemaining,
          totalTime,
          isLeader
        );
        console.log(`[QUIZ] Calculated ${points} points for ${player.name} (difficulty: ${difficulty}, time: ${answerData.timeRemaining}ms, leader: ${isLeader})`);
        player.score += points;
      }

      results.push({
        playerId,
        playerName: player.name,
        answer: answerData.answer,
        isCorrect,
        points,
        newScore: player.score,
        isLeader
      });

      console.log(`[QUIZ] ${player.name}: ${isCorrect ? '✓ Correct' : '✗ Wrong'} (+${points} pts) → Total: ${player.score}`);
    }

    console.log(`[QUIZ] ========== SCORE CALCULATION COMPLETE ==========`);

    // Emit results to all players
    this.io.emit('quiz:question:end', {
      questionId: question.id,
      question: question.question,
      answers: question.answers,
      category: question.category,
      difficulty: question.difficulty,
      correctAnswer,
      correctAnswerText: question.answers[correctAnswer],
      results,
      leaderboard: this.gameEngine.getLeaderboard()
    });

    // Broadcast updated player list
    this.gameEngine.broadcastPlayerList();

    // Per QA 2026-05-14 §16: re-introduce an inter-round leaderboard between
    // questions (skipped after the final question, which hands off to the
    // championship final-leaderboard).
    const isFinal = this.gameState.quiz.questionNumber >= this.gameState.quiz.totalQuestions;
    if (isFinal) {
      this.trackTimeout(() => this.endQuiz(), QUESTION_RESULTS_DURATION);
    } else {
      this.trackTimeout(() => {
        const board = this.gameEngine.getLeaderboard();
        this.io.emit('quiz:leaderboard:show', {
          leaderboard: board,
          duration: INTER_ROUND_LEADERBOARD_DURATION,
          endsAt: Date.now() + INTER_ROUND_LEADERBOARD_DURATION
        });
        this.trackTimeout(() => this.startVoting(), INTER_ROUND_LEADERBOARD_DURATION);
      }, QUESTION_RESULTS_DURATION);
    }
  }

  /**
   * End the quiz game
   */
  endQuiz() {
    console.log('[QUIZ] Quiz game ended');

    this.io.emit('quiz:end', {
      finalLeaderboard: this.gameEngine.getLeaderboard()
    });

    // End the game in the game engine immediately. The previous 3s gap caused the
    // last question's results screen to briefly re-appear after the round
    // leaderboard overlay dismissed and before the final leaderboard mounted
    // (bug B1 / 2026-05-14). The round leaderboard overlay already gives a clean
    // hand-off, so we transition straight to the final leaderboard here.
    this.gameEngine.endGame();
  }

  /**
   * Pause the quiz
   */
  pause() {
    if (this.timer) {
      this.timer.pause();
    }
  }

  /**
   * Resume the quiz
   */
  resume() {
    if (this.timer) {
      this.timer.resume();
    }
  }

  /**
   * Emergency skip current phase
   */
  skip() {
    console.log('[QUIZ] Emergency skip requested');
    if (this.timer) {
      console.log('[QUIZ] Stopping timer and forcing completion');
      this.timer.stop();
      if (this.timer.onComplete) {
        this.timer.onComplete();
      }
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

  /**
   * Cleanup/destroy - stop all timers
   */
  cleanup() {
    console.log('[QUIZ] Cleaning up timers');
    if (this.timer) {
      this.timer.stop();
      this.timer = null;
    }

    // Clear all pending timeouts
    console.log(`[QUIZ] Clearing ${this.pendingTimeouts.length} pending timeouts`);
    this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingTimeouts = [];
  }

  /**
   * Per bug-report 2026-05-14 §A5: return the events the host display needs to
   * subscribe to in order to render the current phase. The caller (index.js
   * `request:state`) emits these only to the requesting socket. Quiz contains
   * no answer-secret in the question payload (correct answer is stripped at
   * emit time and held server-side), so we can replay to player or host
   * indistinguishably.
   */
  getResyncEvents(/* { socketId, playerId, isHost } */) {
    const events = [];
    const q = this.gameState.quiz;
    if (!q) return events;

    if (q.phase === 'intro' && q.introEndsAt) {
      const remaining = Math.max(0, q.introEndsAt - Date.now());
      events.push({
        name: 'quiz:intro',
        payload: {
          title: 'Quiz Challenge',
          description: `${q.totalQuestions} rounds of trivia questions`,
          scoringRules: [
            'Easy: 100 pts base',
            'Medium: 200 pts base',
            'Hard: 300 pts base',
            'Impossible: 500 pts base',
            'Speed bonus: up to 10% for fast answers',
            'Leader gets 2x voting power'
          ],
          placementInfo: 'Your rank in this game determines your placement score',
          duration: remaining,
          endsAt: q.introEndsAt
        }
      });
    } else if (q.phase === 'voting' && q.currentRoundOptions) {
      const votingOptions = q.currentRoundOptions.map((opt) => ({
        id: opt.id,
        label: `${opt.category} (${opt.difficulty.charAt(0).toUpperCase() + opt.difficulty.slice(1)})`,
        color: opt.color,
        category: opt.category,
        difficulty: opt.difficulty
      }));
      events.push({
        name: 'quiz:voting:start',
        payload: {
          options: votingOptions,
          duration: Math.max(0, (q.votingEndsAt || Date.now()) - Date.now()),
          endsAt: q.votingEndsAt,
          questionNumber: q.questionNumber + 1,
          totalQuestions: q.totalQuestions
        }
      });
    } else if (q.phase === 'question' && q.currentQuestion) {
      events.push({
        name: 'quiz:question:start',
        payload: {
          questionId: q.currentQuestion.id,
          question: q.currentQuestion.question,
          answers: q.currentQuestion.answers,
          category: q.currentQuestion.category,
          difficulty: q.currentQuestion.difficulty,
          color: q.currentQuestion.color,
          questionNumber: q.questionNumber,
          totalQuestions: q.totalQuestions,
          duration: Math.max(0, (q.questionEndsAt || Date.now()) - Date.now()),
          endsAt: q.questionEndsAt
        }
      });
    }
    return events;
  }

  /**
   * Get current quiz state
   */
  getState() {
    return {
      phase: this.gameState.quiz.phase,
      questionNumber: this.gameState.quiz.questionNumber,
      totalQuestions: this.gameState.quiz.totalQuestions,
      introEndsAt: this.gameState.quiz.introEndsAt,
      votingEndsAt: this.gameState.quiz.votingEndsAt,
      questionEndsAt: this.gameState.quiz.questionEndsAt,
      currentRoundOptions: this.gameState.quiz.currentRoundOptions,
      currentQuestion: this.gameState.quiz.currentQuestion ? {
        id: this.gameState.quiz.currentQuestion.id,
        question: this.gameState.quiz.currentQuestion.question,
        answers: this.gameState.quiz.currentQuestion.answers,
        category: this.gameState.quiz.currentQuestion.category,
        difficulty: this.gameState.quiz.currentQuestion.difficulty,
        color: this.gameState.quiz.currentQuestion.color
      } : null,
      voteCount: this.gameState.quiz.votes.size,
      answerCount: this.gameState.quiz.answers.size
    };
  }
}
