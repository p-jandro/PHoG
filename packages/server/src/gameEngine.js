/**
 * GameEngine - Core game state management and phase transitions
 * Orchestrates game flow: lobby → playing → leaderboard → finished
 */

import { EventEmitter } from 'events';
import { generateLeaderboard, getLeader, updatePlayerPlacements } from './utils/scoring.js';

export class GameEngine extends EventEmitter {
  constructor(gameState, io) {
    super();
    this.gameState = gameState;
    this.io = io;
    this.currentGameModule = null;
    this.isGameRunning = false; // Flag to prevent concurrent games
    this.leaderboardTimeout = null; // Track leaderboard timeout

    // Championship state
    this.championship = {
      active: false,
      sequence: [],
      currentIndex: 0,
      isAdvancing: false // Flag to prevent multiple simultaneous advances
    };
  }

  /**
   * Start a championship sequence
   * @param {string[]} sequence - Array of game names
   */
  startChampionship(sequence) {
    if (!sequence || sequence.length === 0) {
      console.error('[CHAMPIONSHIP] Invalid sequence');
      return;
    }

    this.championship = {
      active: true,
      sequence,
      currentIndex: 0,
      isAdvancing: false
    };

    console.log(`[CHAMPIONSHIP] Started with sequence: ${sequence.join(', ')}`);
    this.startChampionshipGame();
  }

  /**
   * Start the current game in the championship sequence
   */
  startChampionshipGame() {
    const { sequence, currentIndex } = this.championship;
    
    if (currentIndex >= sequence.length) {
      this.endSession(); // End championship if no more games
      return;
    }

    const gameName = sequence[currentIndex];
    
    // We need to instantiate the game module here based on name
    // This requires importing the game classes or having a factory
    // For now, we emit an event for index.js to handle the instantiation
    // or we handle it here if we pass factories. 
    // Better approach: Emit internal event that index.js listens to?
    // OR: Since index.js passes the game module to startGame, we need a way to get it.
    // Let's emit an event back to index.js to instantiate and start the specific game.
    
    this.emit('requestGameStart', { game: gameName });
  }

  /**
   * Proceed to the next game in the championship
   */
  nextChampionshipGame() {
    if (!this.championship.active) return;

    this.championship.currentIndex++;
    
    if (this.championship.currentIndex < this.championship.sequence.length) {
        this.startChampionshipGame();
    } else {
        this.endSession();
    }
  }

  /**
   * Finalize results for the current game
   * Calculates placements and updates tournament scores
   * @param {string} gameName - Name of the game finishing
   */
  finalizeGameResults(gameName) {
    console.log(`[SCORING] Finalizing results for ${gameName}`);

    // 1. Calculate placements based on current game scores (which are temporarily in .score from legacy code)
    // NOTE: The current game logic writes to player.score. We use this to calculate placement,
    // then we'll archive it to currentGameScore and reset score for the next game.
    
    updatePlayerPlacements(this.gameState.players, gameName);

    // 2. Archive current scores and reset for next game
    for (const [playerId, player] of this.gameState.players) {
        // Store the score they got in this game for display
        player.currentGameScore = player.score;
        
        // Reset main score for next game
        player.score = 0;
    }

    // 3. Emit update
    this.broadcastPlayerList();
  }

  /**
   * Get current phase
   */
  getPhase() {
    return this.gameState.currentPhase;
  }

  /**
   * Clean up current game module before starting a new one
   */
  cleanupCurrentGame() {
    if (!this.currentGameModule) {
      console.log('[CLEANUP] No current game module to clean up');
      return;
    }

    const gameName = this.gameState.currentGame;
    console.log(`[CLEANUP] Cleaning up ${gameName} game module`);

    // Call cleanup method if it exists
    if (typeof this.currentGameModule.cleanup === 'function') {
      try {
        this.currentGameModule.cleanup();
        console.log(`[CLEANUP] ${gameName}.cleanup() completed`);
      } catch (error) {
        console.error(`[CLEANUP] Error in ${gameName}.cleanup():`, error);
      }
    } else {
      console.warn(`[CLEANUP] ${gameName} has no cleanup() method`);
    }

    // Clear the module reference
    this.currentGameModule = null;

    // Clear game-specific state
    if (this.gameState[gameName]) {
      console.log(`[CLEANUP] Clearing ${gameName} state`);
      this.gameState[gameName] = null;
    }

    // Clear leaderboard timeout if exists
    if (this.leaderboardTimeout) {
      clearTimeout(this.leaderboardTimeout);
      this.leaderboardTimeout = null;
      console.log('[CLEANUP] Cleared leaderboard timeout');
    }

    // Reset game running flag
    this.isGameRunning = false;
    console.log(`[CLEANUP] Game cleanup complete, isGameRunning = false`);
  }

  /**
   * Transition to a new phase
   * @param {string} newPhase - lobby | playing | leaderboard | finished
   */
  transitionPhase(newPhase) {
    const validPhases = ['lobby', 'playing', 'leaderboard', 'finished'];

    if (!validPhases.includes(newPhase)) {
      throw new Error(`Invalid phase: ${newPhase}`);
    }

    const oldPhase = this.gameState.currentPhase;

    // Prevent invalid transitions: playing → playing
    if (oldPhase === 'playing' && newPhase === 'playing') {
      console.error('[PHASE] Invalid transition: playing → playing (game already running)');
      throw new Error('Cannot transition to playing phase - game already running');
    }

    this.gameState.currentPhase = newPhase;

    console.log(`[PHASE] ${oldPhase} → ${newPhase}`);

    // Emit phase change to all clients
    this.io.emit('phase:change', {
      phase: newPhase,
      previousPhase: oldPhase,
      timestamp: Date.now()
    });

    // Emit internal event
    this.emit('phaseChange', { oldPhase, newPhase });
  }

  /**
   * Start a game
   * @param {string} gameName - quiz | trueFalse | countdown | pointless
   * @param {Object} gameModule - Game module instance
   */
  startGame(gameName, gameModule) {
    const validGames = ['quiz', 'trueFalse', 'countdown', 'pointless'];

    if (!validGames.includes(gameName)) {
      throw new Error(`Invalid game: ${gameName}`);
    }

    // Check if a game is already running
    if (this.isGameRunning) {
      const currentGame = this.gameState.currentGame;
      console.error(`[GAME] Cannot start ${gameName} - ${currentGame} is already running`);
      throw new Error(`Cannot start ${gameName}: ${currentGame} game is already in progress`);
    }

    console.log(`[GAME] ========== STARTING ${gameName.toUpperCase()} ==========`);

    // Cleanup any previous game module (safety measure)
    if (this.currentGameModule) {
      console.warn(`[GAME] Previous game module still exists, cleaning up...`);
      this.cleanupCurrentGame();
    }

    // Set new game state
    this.gameState.currentGame = gameName;
    this.currentGameModule = gameModule;
    this.isGameRunning = true;

    console.log(`[GAME] Set isGameRunning = true`);

    // Transition to playing phase
    this.transitionPhase('playing');

    console.log(`[GAME] ${gameName} started successfully`);

    // Emit game start to all clients
    this.io.emit('game:start', {
      game: gameName,
      timestamp: Date.now()
    });

    // Emit internal event
    this.emit('gameStart', { game: gameName });
  }

  /**
   * End current game
   */
  endGame() {
    const gameName = this.gameState.currentGame;

    console.log(`[GAME] ========== ENDING ${gameName?.toUpperCase() || 'UNKNOWN'} ==========`);

    // Emit game end to all clients
    this.io.emit('game:end', {
      game: gameName,
      timestamp: Date.now()
    });

    // Transition to leaderboard
    this.finalizeGameResults(gameName);
    this.showLeaderboard();

    // Mark game as no longer running
    this.isGameRunning = false;
    console.log(`[GAME] Set isGameRunning = false`);

    // Emit internal event
    this.emit('gameEnd', { game: gameName });
  }

  /**
   * Show leaderboard
   * @param {number} duration - Duration in milliseconds (default: 10 seconds)
   */
  showLeaderboard(duration = 10000) {
    this.transitionPhase('leaderboard');

    const leaderboard = this.getLeaderboard();
    const leader = this.getLeader();

    // Emit leaderboard to all clients
    this.io.emit('leaderboard:show', {
      leaderboard,
      leader,
      duration,
      timestamp: Date.now()
    });

    console.log(`[LEADERBOARD] Showing for ${duration}ms`);

    // Clear any existing leaderboard timeout
    if (this.leaderboardTimeout) {
      clearTimeout(this.leaderboardTimeout);
      this.leaderboardTimeout = null;
    }

    // Auto-advance after duration
    this.leaderboardTimeout = setTimeout(() => {
      this.leaderboardTimeout = null;
      this.emit('leaderboardComplete');
    }, duration);
  }

  /**
   * Return to lobby
   */
  returnToLobby() {
    console.log('[LOBBY] ========== RETURNING TO LOBBY ==========');

    // Cleanup current game module using centralized method
    this.cleanupCurrentGame();

    this.gameState.currentGame = null;
    this.transitionPhase('lobby');

    console.log('[LOBBY] Returned to lobby');

    // Emit to all clients
    this.io.emit('lobby:return', {
      timestamp: Date.now()
    });
  }

  /**
   * End the entire game session
   */
  endSession() {
    console.log('[SESSION] ========== ENDING SESSION ==========');

    // Cleanup current game module using centralized method
    this.cleanupCurrentGame();

    this.transitionPhase('finished');

    const leaderboard = this.getLeaderboard();
    const winner = leaderboard[0];

    console.log(`[SESSION] Game session ended. Winner: ${winner?.name || 'None'}`);

    // Emit final results
    this.io.emit('session:end', {
      leaderboard,
      winner,
      timestamp: Date.now()
    });

    this.emit('sessionEnd', { winner });
  }

  /**
   * Reset game state
   */
  reset() {
    console.log('[RESET] ========== RESETTING GAME ==========');

    // Cleanup current game module using centralized method
    this.cleanupCurrentGame();

    // Reset all player scores
    for (const [playerId, player] of this.gameState.players) {
      player.score = 0;
      // Reset placements
      player.placements = {
        quiz: null,
        trueFalse: null,
        countdown: null,
        pointless: null
      };
      player.totalPlacement = 0;
    }

    // Reset game state
    this.gameState.currentGame = null;
    this.gameState.quiz = null;
    this.gameState.trueFalse = null;
    this.gameState.countdown = null;
    this.gameState.pointless = null;

    this.transitionPhase('lobby');

    console.log('[RESET] Game state reset complete');

    // Emit to all clients
    this.io.emit('game:reset', {
      timestamp: Date.now()
    });

    // Broadcast updated player list
    this.broadcastPlayerList();
  }

  /**
   * Get current leaderboard
   * @returns {Array}
   */
  getLeaderboard() {
    return generateLeaderboard(this.gameState.players, this.gameState.currentGame);
  }

  /**
   * Get current leader
   * @returns {string|null}
   */
  getLeader() {
    return getLeader(this.gameState.players);
  }

  /**
   * Update player score
   * @param {string} playerId - Player ID
   * @param {number} points - Points to add
   */
  updateScore(playerId, points) {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.warn(`[SCORE] Player not found: ${playerId}`);
      return;
    }

    const oldScore = player.score;
    player.score += points;

    console.log(`[SCORE] ${player.name}: ${oldScore} → ${player.score} (+${points})`);

    // Emit score update
    this.io.emit('score:update', {
      playerId,
      oldScore,
      newScore: player.score,
      points,
      timestamp: Date.now()
    });
  }

  /**
   * Set player score directly
   * @param {string} playerId - Player ID
   * @param {number} score - New score
   */
  setScore(playerId, score) {
    const player = this.gameState.players.get(playerId);
    if (!player) {
      console.warn(`[SCORE] Player not found: ${playerId}`);
      return;
    }

    const oldScore = player.score;
    player.score = score;

    console.log(`[SCORE] ${player.name}: ${oldScore} → ${score}`);

    // Emit score update
    this.io.emit('score:update', {
      playerId,
      oldScore,
      newScore: score,
      points: score - oldScore,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast updated player list
   */
  broadcastPlayerList() {
    const players = Array.from(this.gameState.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      currentGameScore: p.currentGameScore,
      totalPlacementScore: p.totalPlacement,
      gamePlacements: p.placements,
      connected: p.connected
    }));

    this.io.emit('players:update', players);
  }

  /**
   * Remove a player (kick)
   * @param {string} playerId - Player ID
   */
  removePlayer(playerId) {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    console.log(`[KICK] Removing player: ${player.name}`);

    // Disconnect their socket if connected
    if (player.socketId) {
      const socket = this.io.sockets.sockets.get(player.socketId);
      if (socket) {
        socket.emit('player:kicked', { reason: 'Kicked by host' });
        socket.disconnect();
      }
    }

    // Remove from game state
    this.gameState.players.delete(playerId);
    
    // Broadcast updated player list
    this.broadcastPlayerList();

    this.emit('playerRemoved', { playerId, player });
  }

  /**
   * Pause current game
   */
  pause() {
    if (this.currentGameModule && typeof this.currentGameModule.pause === 'function') {
      this.currentGameModule.pause();
      console.log('[GAME] Paused');
      this.io.emit('game:paused', {
        game: this.gameState.currentGame,
        timestamp: Date.now()
      });
    } else {
      console.warn('[GAME] Current module does not support pause');
    }
  }

  /**
   * Resume current game
   */
  resume() {
    if (this.currentGameModule && typeof this.currentGameModule.resume === 'function') {
      this.currentGameModule.resume();
      console.log('[GAME] Resumed');
      this.io.emit('game:resumed', {
        game: this.gameState.currentGame,
        timestamp: Date.now()
      });
    } else {
      console.warn('[GAME] Current module does not support resume');
    }
  }

  /**
   * Emergency skip current phase/round
   */
  skip() {
    console.log('[GAME] Emergency skip requested');
    if (this.currentGameModule && typeof this.currentGameModule.skip === 'function') {
      this.currentGameModule.skip();
    } else {
        console.warn('[GAME] Current module does not support skip');
    }
  }


  /**
   * Get current game state (for host dashboard)
   * @returns {Object}
   */
  getGameState() {
    return {
      phase: this.gameState.currentPhase,
      currentGame: this.gameState.currentGame,
      playerCount: this.gameState.players.size,
      players: Array.from(this.gameState.players.values()),
      leaderboard: this.getLeaderboard(),
      leader: this.getLeader(),
      pointless: this.gameState.pointless,
      gameData: this.currentGameModule?.getState?.() || null,
      championship: this.championship // Send championship state
    };
  }
}

