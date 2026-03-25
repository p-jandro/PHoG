/**
 * Countdown Word Game Module
 * Features: Letter generation, word validation, length-based scoring
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Timer } from '../utils/timer.js';
import { calculateCountdownScore, updatePlayerPlacements } from '../utils/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load dictionary from node_modules (monorepo root)
const dictionaryPath = join(__dirname, '../../../../node_modules/an-array-of-english-words/index.json');
const words = JSON.parse(readFileSync(dictionaryPath, 'utf-8'));

// Create a Set for fast word lookup
const wordSet = new Set(words.map(w => w.toUpperCase()));

export class CountdownGame {
  constructor(gameState, io, gameEngine) {
    this.gameState = gameState;
    this.io = io;
    this.gameEngine = gameEngine;
    this.timer = null;
    this.pendingTimeouts = []; // Track setTimeout IDs for cleanup

    // Initialize game state
    this.gameState.countdown = {
      phase: 'intro', // intro | playing | results
      letters: [],
      playerWords: new Map(), // playerId -> { word, valid, score }
      roundNumber: 0,
      totalRounds: 3
    };
  }

  /**
   * Start the Countdown game
   */
  start() {
    console.log('[COUNTDOWN] Starting game');
    this.showIntro();
  }

  /**
   * Show game intro
   */
  showIntro() {
    this.gameState.countdown.phase = 'intro';

    console.log('[COUNTDOWN] Showing intro and rules');

    this.io.emit('countdown:intro', {
      title: 'Countdown Word Game',
      description: '3 rounds - make the longest word from 15 letters',
      scoringRules: [
        'Points = (word length)² × 10',
        'Bonus +200 for longest word in round',
        'Examples:',
        '  - 5 letter word = 250 pts',
        '  - 8 letter word = 640 pts',
        '  - 10 letter word = 1000 pts'
      ],
      placementInfo: 'Your rank in this game determines your placement score',
      shuffleInfo: 'Use the shuffle button to rearrange letters (letters stay the same)',
      totalRounds: this.gameState.countdown.totalRounds,
      timePerRound: 30000,
      duration: 30000 // 30 seconds
    });

    // Start first round after 30 seconds
    this.timer = new Timer(30000, null, () => {
      this.startRound();
    });
    this.timer.start();
  }

  /**
   * Generate random letters (consonants and vowels)
   * @param {number} consonants - Number of consonants
   * @param {number} vowels - Number of vowels
   * @returns {string[]} - Array of letters
   */
  generateLetters(consonants = 10, vowels = 5) {
    const consonantPool = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
    const vowelPool = 'AEIOU'.split('');

    const letters = [];

    // Add consonants
    for (let i = 0; i < consonants; i++) {
      const randomIndex = Math.floor(Math.random() * consonantPool.length);
      letters.push(consonantPool[randomIndex]);
    }

    // Add vowels
    for (let i = 0; i < vowels; i++) {
      const randomIndex = Math.floor(Math.random() * vowelPool.length);
      letters.push(vowelPool[randomIndex]);
    }

    // Shuffle letters
    return letters.sort(() => Math.random() - 0.5);
  }

  /**
   * Start a new round
   */
  startRound() {
    // Ensure any existing timer is stopped
    if (this.timer) {
        this.timer.stop();
        this.timer = null;
    }

    this.gameState.countdown.roundNumber++;

    // Check if game is over
    if (this.gameState.countdown.roundNumber > this.gameState.countdown.totalRounds) {
      this.endGame();
      return;
    }

    this.gameState.countdown.phase = 'playing';
    this.gameState.countdown.playerWords.clear();

    // Generate letters
    this.gameState.countdown.letters = this.generateLetters();

    console.log(`[COUNTDOWN] Round ${this.gameState.countdown.roundNumber}: ${this.gameState.countdown.letters.join('')}`);

    // Emit round start to all players
    this.io.emit('countdown:round:start', {
      roundNumber: this.gameState.countdown.roundNumber,
      totalRounds: this.gameState.countdown.totalRounds,
      letters: this.gameState.countdown.letters,
      duration: 30000 // 30 seconds to form word
    });

    // Auto-advance after 30 seconds
    this.timer = new Timer(30000, null, () => {
      this.endRound();
    });
    this.timer.start();
  }

  /**
   * Validate if a word can be formed from given letters
   * @param {string} word - Word to validate
   * @param {string[]} letters - Available letters
   * @returns {boolean}
   */
  canFormWord(word, letters) {
    const wordLetters = word.toUpperCase().split('');
    const availableLetters = [...letters];

    for (const letter of wordLetters) {
      const index = availableLetters.indexOf(letter);
      if (index === -1) {
        return false;
      }
      availableLetters.splice(index, 1);
    }

    return true;
  }

  /**
   * Validate if a word exists in the dictionary
   * @param {string} word - Word to validate
   * @returns {boolean}
   */
  isValidWord(word) {
    return wordSet.has(word.toUpperCase());
  }

  /**
   * Handle player word submission
   * @param {string} playerId - Player ID
   * @param {string} word - Word submitted
   */
  handleSubmit(playerId, word) {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.warn('[COUNTDOWN] Player not found:', playerId);
      return;
    }

    // Check if already submitted
    if (this.gameState.countdown.playerWords.has(playerId)) {
      console.warn(`[COUNTDOWN] ${player.name} already submitted`);
      return;
    }

    const wordUpper = word.toUpperCase();
    const canForm = this.canFormWord(wordUpper, this.gameState.countdown.letters);
    const isValid = this.isValidWord(wordUpper);
    const valid = canForm && isValid;

    this.gameState.countdown.playerWords.set(playerId, {
      word: wordUpper,
      valid,
      score: 0,
      canForm,
      isValid
    });

    console.log(`[COUNTDOWN] ${player.name} submitted: ${wordUpper} - ${valid ? 'Valid' : 'Invalid'} (canForm: ${canForm}, isValid: ${isValid})`);

    // Emit submission confirmation to player
    const socket = this.io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('countdown:submit:received', { word: wordUpper });
    }

    // Notify host
    if (this.gameState.meta.hostSocketId) {
      this.io.to(this.gameState.meta.hostSocketId).emit('host:player_answered', {
        playerId,
        game: 'countdown'
      });
    }
  }

  /**
   * End current round and calculate scores
   */
  endRound() {
    console.log('[COUNTDOWN] Round ended');

    const submissions = [];
    let maxLength = 0;

    // Find longest valid word
    for (const [playerId, wordData] of this.gameState.countdown.playerWords) {
      if (wordData.valid && wordData.word.length > maxLength) {
        maxLength = wordData.word.length;
      }
    }

    // Calculate scores
    for (const [playerId, wordData] of this.gameState.countdown.playerWords) {
      const player = this.gameState.players.get(playerId);
      if (!player) continue;

      let points = 0;
      if (wordData.valid) {
        points = calculateCountdownScore(wordData.word, maxLength);
        player.score += points;
        wordData.score = points;
      }

      submissions.push({
        playerId,
        playerName: player.name,
        word: wordData.word,
        valid: wordData.valid,
        length: wordData.word.length,
        points,
        newScore: player.score,
        isLongest: wordData.valid && wordData.word.length === maxLength
      });

      console.log(`[COUNTDOWN] ${player.name}: ${wordData.word} (${wordData.word.length}) - ${wordData.valid ? 'Valid' : 'Invalid'} (+${points} pts) = ${player.score}`);
    }

    // Sort by word length
    submissions.sort((a, b) => b.length - a.length);

    // Emit round results
    this.io.emit('countdown:round:end', {
      submissions,
      longestLength: maxLength,
      leaderboard: this.gameEngine.getLeaderboard()
    });

    // Broadcast updated player list
    this.gameEngine.broadcastPlayerList();

    // Continue to next round after 5 seconds
    this.trackTimeout(() => {
      this.startRound();
    }, 5000);
  }

  /**
   * End the game
   */
  endGame() {
    console.log('[COUNTDOWN] Game ended');

    this.gameState.countdown.phase = 'results';

    // Calculate placements for Countdown
    updatePlayerPlacements(this.gameState.players, 'countdown');

    this.io.emit('countdown:end', {
      finalLeaderboard: this.gameEngine.getLeaderboard()
    });

    // End game in game engine
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
    }
  }

  /**
   * Resume the game
   */
  resume() {
    if (this.timer) {
      this.timer.resume();
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
    console.log('[COUNTDOWN] ========== CLEANUP ==========');

    if (this.timer) {
      console.log('[COUNTDOWN] Stopping timer');
      this.timer.stop();
      this.timer = null;
    }

    // Clear all pending timeouts
    console.log(`[COUNTDOWN] Clearing ${this.pendingTimeouts.length} pending timeouts`);
    this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingTimeouts = [];

    console.log('[COUNTDOWN] Cleanup complete');
  }

  /**
   * Get current game state
   */
  getState() {
    return {
      phase: this.gameState.countdown.phase,
      roundNumber: this.gameState.countdown.roundNumber,
      totalRounds: this.gameState.countdown.totalRounds,
      letters: this.gameState.countdown.letters,
      submissionCount: this.gameState.countdown.playerWords.size
    };
  }
}

