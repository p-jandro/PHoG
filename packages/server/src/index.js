/**
 * PHoG Server - Main entry point
 * Handles WebSocket connections for multiplayer game show system
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: join(__dirname, '../../../.env.local') });
console.log('[ENV] Environment loaded. Host password is:', process.env.HOST_PASSWORD ? 'SET' : 'NOT SET');

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { ConnectionManager } from './connectionManager.js';
import { GameEngine } from './gameEngine.js';
import { QuizGame } from './games/quiz.js';
import { TrueFalseGame } from './games/trueFalse.js';
import { CountdownGame } from './games/countdown.js';
import { PointlessGame } from './games/pointless.js';

const app = express();
const server = createServer(app);

// CORS configuration for client and host apps
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
    process.env.HOST_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());

// Socket.io server setup
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.CLIENT_URL,
      process.env.HOST_URL
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket']
});

// Optimize connection ID generation
io.engine.generateId = (req) => randomUUID();

// Global rate limiter for connections
const connectionRateLimiter = new Map();

// Rate limiting removed by user request
io.use((socket, next) => {
  next();
});

// Initialize connection manager
const connectionManager = new ConnectionManager();

// Initialize game engine (after io is created)
let gameEngine;

// Game state (in-memory, no database)
const gameState = {
  meta: {
    gameId: randomUUID(),
    startedAt: null,
    hostSocketId: null,
    config: {
      maxPlayers: 30,
      gameSequence: ['quiz', 'trueFalse', 'pointless', 'countdown']
    }
  },

  players: new Map(), // playerId -> playerObject

  currentGame: null, // 'quiz' | 'trueFalse' | 'countdown' | 'pointless'
  currentPhase: 'lobby', // lobby | playing | leaderboard | finished

  // Game-specific state
  quiz: null,
  trueFalse: null,
  countdown: null,
  pointless: null
};

// Initialize game engine after io is ready
gameEngine = new GameEngine(gameState, io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    gameId: gameState.meta.gameId,
    phase: gameState.currentPhase,
    players: gameState.players.size,
    connections: connectionManager.getStats()
  });
});

// API endpoint to get current game state
app.get('/api/state', (req, res) => {
  res.json({
    phase: gameState.currentPhase,
    currentGame: gameState.currentGame,
    playerCount: gameState.players.size
  });
});

// Helper to start a specific game instance
function startSpecificGame(gameName) {
  if (gameName === 'quiz') {
      const quizGame = new QuizGame(gameState, io, gameEngine);
      gameEngine.startGame('quiz', quizGame);
      quizGame.start();
  } else if (gameName === 'trueFalse') {
      const trueFalseGame = new TrueFalseGame(gameState, io, gameEngine);
      gameEngine.startGame('trueFalse', trueFalseGame);
      trueFalseGame.start();
  } else if (gameName === 'countdown') {
      const countdownGame = new CountdownGame(gameState, io, gameEngine);
      gameEngine.startGame('countdown', countdownGame);
      countdownGame.start();
  } else if (gameName === 'pointless') {
      const pointlessGame = new PointlessGame(gameState, io, gameEngine);
      gameEngine.startGame('pointless', pointlessGame);
      pointlessGame.start();
  }
}

// Listen for internal requests from GameEngine to start games (for championship flow)
gameEngine.on('requestGameStart', ({ game }) => {
  startSpecificGame(game);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`\n[CONNECTION] New socket connection: ${socket.id}`);

  // Handle connection with rate limiting
  if (!connectionManager.handleConnection(socket)) {
    socket.disconnect();
    return;
  }

  // Respond to ping with pong
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Player join event
  socket.on('player:join', ({ name, reconnectToken: incomingToken }) => {
    try {
      let playerId;
      let isReconnect = false;

      // Check for reconnection
      if (incomingToken) {
        playerId = connectionManager.reconnectPlayer(socket.id, incomingToken);
        if (playerId) {
          isReconnect = true;
          console.log(`[PLAYER] ${name} reconnected as ${playerId}`);
        }
      }

      // New player
      if (!playerId) {
        // Require name for new players
        if (!name || !name.trim()) {
          socket.emit('error', { message: 'Name is required' });
          return;
        }

        playerId = randomUUID();
        connectionManager.registerPlayer(socket.id, playerId);

        // Create player object
        const player = {
          id: playerId,
          name: name.trim(),
          socketId: socket.id,
          score: 0, // Current game score
          currentGameScore: 0, // Score for the active mini-game
          totalResponseTime: 0, // Tiebreaker: Sum of response times (ms)
          placements: {
            quiz: null,
            trueFalse: null,
            countdown: null,
            pointless: null
          }, // Rank for each game
          totalPlacement: 0, // Sum of all placements (lower is better)
          joinedAt: Date.now(),
          connected: true
        };

        gameState.players.set(playerId, player);
        console.log(`[PLAYER] New player joined: ${player.name} (${playerId})`);
      } else {
        // Update reconnected player
        const player = gameState.players.get(playerId);
        if (player) {
          player.socketId = socket.id;
          player.connected = true;
        }
      }

      // Send success response
      const player = gameState.players.get(playerId);
      const reconnectToken = connectionManager.generateReconnectToken(playerId);

      socket.emit('player:joined', {
        playerId,
        player,
        reconnectToken,
        isReconnect
      });

      // Broadcast updated player list to all clients
      broadcastPlayerList();

    } catch (error) {
      console.error('[ERROR] player:join:', error);
      socket.emit('error', { message: 'Failed to join game' });
    }
  });

  // Host join event
  socket.on('host:join', ({ password }) => {
    try {
      const expectedPassword = process.env.HOST_PASSWORD || 'admin';
      console.log(`[HOST] Login attempt - Expected: "${expectedPassword}", Received: "${password}"`);

      if (password !== expectedPassword) {
        socket.emit('host:rejected', { message: 'Invalid password' });
        return;
      }

      gameState.meta.hostSocketId = socket.id;
      socket.emit('host:joined', {
        gameId: gameState.meta.gameId,
        gameState: gameEngine.getGameState()
      });

      console.log(`[HOST] Host joined: ${socket.id}`);
    } catch (error) {
      console.error('[ERROR] host:join:', error);
      socket.emit('error', { message: 'Failed to join as host' });
    }
  });

  // Host control events
  socket.on('host:control', ({ action, game, sequence }) => {
    if (socket.id !== gameState.meta.hostSocketId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      switch (action) {
        case 'startChampionship':
          if (sequence && Array.isArray(sequence)) {
            gameEngine.startChampionship(sequence);
          }
          break;
        case 'nextGame':
          gameEngine.nextChampionshipGame();
          break;
        case 'start':
          // Start a specific game
          startSpecificGame(game);
          break;
        case 'reset':
          gameEngine.reset();
          break;
        case 'pause':
          gameEngine.pause();
          break;
        case 'resume':
          gameEngine.resume();
          break;
        case 'skip':
          gameEngine.skip();
          break;
        case 'lobby':
          gameEngine.returnToLobby();
          break;
        case 'reveal':
          if (gameState.currentGame === 'pointless') {
            const pointlessGame = gameEngine.currentGameModule;
            if (pointlessGame && typeof pointlessGame.revealResults === 'function') {
              pointlessGame.revealResults();
            }
          }
          break;
        case 'end':
          gameEngine.endSession();
          break;
      }

      socket.emit('host:control:success', { action });
    } catch (error) {
      console.error('[ERROR] host:control:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Quiz game events
  socket.on('quiz:vote', ({ optionId, category }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    if (gameState.currentGame !== 'quiz' || gameState.quiz?.phase !== 'voting') {
      socket.emit('error', { message: 'Not in voting phase' });
      return;
    }

    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleVote === 'function') {
      // Support both old format (category) and new format (optionId)
      currentGame.handleVote(playerId, optionId || category);
    }
  });

  socket.on('quiz:answer', ({ questionId, answer, timeRemaining }) => {
    console.log(`[SERVER] quiz:answer event received - QuestionId: ${questionId}, Answer: ${answer}`);

    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      console.error('[SERVER] ❌ quiz:answer - Player not registered');
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    console.log(`[SERVER] Player ${playerId} answering`);

    if (gameState.currentGame !== 'quiz') {
      console.error(`[SERVER] ❌ Not in quiz game. Current: ${gameState.currentGame}`);
      socket.emit('error', { message: 'Not in quiz game' });
      return;
    }

    if (gameState.quiz?.phase !== 'question') {
      console.error(`[SERVER] ❌ Not in question phase. Current: ${gameState.quiz?.phase}`);
      socket.emit('error', { message: 'Not in question phase' });
      return;
    }

    // Validate question ID matches current question
    if (gameState.quiz.currentQuestion?.id !== questionId) {
      console.error(`[SERVER] ❌ Question mismatch. Expected: ${gameState.quiz.currentQuestion?.id}, Got: ${questionId}`);
      socket.emit('error', { message: 'Question mismatch' });
      return;
    }

    console.log(`[SERVER] ✓ All validations passed, forwarding to quiz.handleAnswer()`);

    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleAnswer === 'function') {
      currentGame.handleAnswer(playerId, answer, timeRemaining);
    } else {
      console.error('[SERVER] ❌ Quiz game module or handleAnswer not found');
    }
  });

  // True/False game events
  socket.on('truefalse:answer', ({ statementId, answer }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    if (gameState.currentGame !== 'trueFalse' || gameState.trueFalse?.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }

    // Validate statement ID matches current statement
    if (gameState.trueFalse.currentStatement?.id !== statementId) {
      socket.emit('error', { message: 'Statement mismatch' });
      return;
    }

    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleAnswer === 'function') {
      currentGame.handleAnswer(playerId, answer);
    }
  });

  // Countdown game events
  socket.on('countdown:submit', ({ word }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    if (gameState.currentGame !== 'countdown' || gameState.countdown?.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }

    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleSubmit === 'function') {
      currentGame.handleSubmit(playerId, word);
    }
  });

  // Pointless game events
  socket.on('pointless:submit', ({ text }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }

    if (gameState.currentGame !== 'pointless' || gameState.pointless?.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }

    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.submitAnswer === 'function') {
      currentGame.submitAnswer(playerId, text);
    }
  });

  // State synchronization for late joiners/refresh
  socket.on('request:state', () => {
    if (gameState.currentGame === 'pointless' && gameEngine.currentGameModule) {
        const state = gameEngine.currentGameModule.getState();
        const pointlessState = gameState.pointless;
        
        if (pointlessState.phase === 'playing') {
            const elapsed = Date.now() - pointlessState.startTime;
            const remaining = Math.max(0, 60000 - elapsed);
            
            socket.emit('pointless:round:start', {
                roundIndex: state.roundIndex,
                totalRounds: state.totalRounds,
                category: state.currentRound.category,
                question: state.currentRound.question,
                duration: remaining
            });
        }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const playerId = connectionManager.handleDisconnection(socket.id);

    if (playerId) {
      const player = gameState.players.get(playerId);
      if (player) {
        player.connected = false;
        console.log(`[DISCONNECT] Player ${player.name} disconnected`);

        // Broadcast updated player list
        broadcastPlayerList();
      }
    }

    // Check if host disconnected
    if (socket.id === gameState.meta.hostSocketId) {
      gameState.meta.hostSocketId = null;
      console.log('[HOST] Host disconnected');
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`[SOCKET_ERROR] ${socket.id}:`, error);
  });
});

/**
 * Broadcast player list to all connected clients
 */
function broadcastPlayerList() {
  const players = Array.from(gameState.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    currentGameScore: p.currentGameScore,
    totalPlacementScore: p.totalPlacement,
    gamePlacements: p.placements,
    connected: p.connected
  }));

  io.emit('players:update', players);
}

/**
 * Get public game state (safe to send to clients)
 */
function getPublicGameState() {
  return {
    gameId: gameState.meta.gameId,
    phase: gameState.currentPhase,
    currentGame: gameState.currentGame,
    playerCount: gameState.players.size,
    maxPlayers: gameState.meta.config.maxPlayers
  };
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🎮 PHoG Server Running                ║
║                                        ║
║  Port: ${PORT.toString().padEnd(32)}║
║  Game ID: ${gameState.meta.gameId.substring(0, 8)}...               ║
║  Status: Ready for players             ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

export { io, gameState, connectionManager, gameEngine };

