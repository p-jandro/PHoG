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

// Install process-level error handlers BEFORE any game code so that uncaught
// exceptions / unhandled rejections during boot are captured into the ring
// buffer (and forwarded to Sentry if SENTRY_DSN is set).
import * as errorReporter from './ops/errorReporter.js';
errorReporter.install();

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
import { PointlessGame, POINTLESS_ROUND_DURATION } from './games/pointless.js';
import { ThemedDleGame } from './games/themedDle.js';
import { NumbersGame } from './games/numbers.js';
import { WordleGame } from './games/wordle.js';
import { TravelGame } from './games/travel.js';
import { contentStore } from './contentStore.js';

const app = express();
const server = createServer(app);

const allowedOrigins = new Set(
  [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
    process.env.HOST_URL
  ].filter(Boolean)
);

const LAN_ORIGIN_PATTERN = /^https?:\/\/(?:(?:localhost|127(?:\.\d{1,3}){3})|(?:10(?:\.\d{1,3}){3})|(?:192\.168(?:\.\d{1,3}){2})|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})|(?:[a-z0-9-]+\.local))(?::\d+)?$/i;

const allowOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  return allowedOrigins.has(origin) || LAN_ORIGIN_PATTERN.test(origin);
};

const corsOrigin = (origin, callback) => {
  if (allowOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin not allowed: ${origin}`));
};

// CORS configuration for client and host apps
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json());

// Socket.io server setup
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket']
});

// Optimize connection ID generation
io.engine.generateId = (req) => randomUUID();

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
      gameSequence: ['quiz', 'trueFalse', 'pointless']
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
    connections: connectionManager.getStats(),
    errors: errorReporter.errorStats()
  });
});

// Debug endpoint: most recent process-level errors (uncaughtException,
// unhandledRejection). Server-internal — no auth, only useful on the LAN
// where the host already sees server logs.
app.get('/debug/errors', (req, res) => {
  res.json({
    stats: errorReporter.errorStats(),
    entries: errorReporter.recentErrors()
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
  } else if (gameName === 'pokedle' || gameName === 'hpdle') {
      // Each themed-dle game plays all 4 modes sequentially:
      //   pokedle: Classic → Emoji → Silhouette → Grid
      //   hpdle:   Classic → Emoji → Spell → Grid
      const theme = gameName === 'pokedle' ? 'pokemon' : 'hp';
      const game = new ThemedDleGame(gameState, io, gameEngine, { theme });
      gameEngine.startGame(gameName, game);
      game.start();
  } else if (gameName === 'numbers') {
      const numbersGame = new NumbersGame(gameState, io, gameEngine);
      gameEngine.startGame('numbers', numbersGame);
      numbersGame.start();
  } else if (gameName === 'wordle') {
      const wordleGame = new WordleGame(gameState, io, gameEngine);
      gameEngine.startGame('wordle', wordleGame);
      wordleGame.start();
  } else if (gameName === 'travel') {
      const travelGame = new TravelGame(gameState, io, gameEngine);
      gameEngine.startGame('travel', travelGame);
      travelGame.start();
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

  // Helper: kick a previously-mapped socket when a duplicate session displaces it.
  const kickDuplicate = (displacedSocketId) => {
    if (!displacedSocketId) return;
    const old = io.sockets.sockets.get(displacedSocketId);
    if (!old) return;
    try {
      old.emit('player:kicked', { reason: 'duplicate_session' });
      old.disconnect();
    } catch (e) {
      console.warn('[KICK] Failed to evict duplicate session:', e?.message || e);
    }
  };

  // Player join event
  socket.on('player:join', ({ name, reconnectToken: incomingToken }) => {
    try {
      let playerId = null;
      let isReconnect = false;

      // Check for reconnection via HMAC-signed token. Token verification is
      // stateless; a valid token re-binds the new socket to the existing
      // player record. If another live socket holds the same identity, it
      // is displaced and we kick it (duplicate-session protection).
      if (incomingToken) {
        const result = connectionManager.reconnectPlayer(socket.id, incomingToken);
        if (result.playerId && gameState.players.has(result.playerId)) {
          playerId = result.playerId;
          isReconnect = true;
          kickDuplicate(result.displacedSocketId);
          console.log(`[PLAYER] ${name || '(unknown)'} reconnected as ${playerId}`);
        } else if (result.playerId && !gameState.players.has(result.playerId)) {
          // Token verified but the player record is gone (server restarted
          // mid-game, or session reset). Fall through to fresh-join path.
          console.log(`[PLAYER] Token valid but player ${result.playerId} no longer exists; treating as new join`);
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
        const displaced = connectionManager.registerPlayer(socket.id, playerId);
        kickDuplicate(displaced);

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
            pointless: null,
            pokedle: null,
            hpdle: null,
            numbers: null,
            wordle: null,
            travel: null
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
      console.log(`[HOST] Login attempt - password ${password === expectedPassword ? 'matches' : 'does not match'}`);

      if (password !== expectedPassword) {
        socket.emit('host:rejected', { message: 'Invalid password' });
        return;
      }

      // Evict previous host session if one exists
      if (gameState.meta.hostSocketId && gameState.meta.hostSocketId !== socket.id) {
        const oldHostSocket = io.sockets.sockets.get(gameState.meta.hostSocketId);
        if (oldHostSocket) {
          console.log(`[HOST] Evicting previous host: ${gameState.meta.hostSocketId}`);
          oldHostSocket.emit('host:rejected', { message: 'Another host session has taken over' });
          oldHostSocket.disconnect();
        }
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

  // Host settings (content editor) events — gated on host auth + lobby phase.
  function isAuthorizedHost() {
    return socket.id === gameState.meta?.hostSocketId;
  }

  socket.on('host:settings:get', ({ kind } = {}) => {
    try {
      if (!isAuthorizedHost()) {
        socket.emit('host:settings:rejected', { kind, reason: 'not_authorized' });
        return;
      }
      let data;
      if (kind === 'quiz')           data = contentStore.getQuizRoundsAll();
      else if (kind === 'trueFalse') data = contentStore.getStatementsAll();
      else if (kind === 'pointless') data = contentStore.getPointlessRoundsAll();
      else { socket.emit('host:settings:rejected', { kind, reason: 'unknown_kind' }); return; }
      const version = contentStore.getVersion(kind);
      socket.emit('host:settings:data', { kind, data, version });
    } catch (err) {
      console.error('[ERROR] host:settings:get:', err);
      socket.emit('host:settings:rejected', { kind, reason: 'server_error' });
    }
  });

  socket.on('host:settings:save', ({ kind, data, version } = {}) => {
    try {
      if (!isAuthorizedHost()) {
        socket.emit('host:settings:rejected', { kind, reason: 'not_authorized' });
        return;
      }
      if (gameState.currentPhase !== 'lobby') {
        socket.emit('host:settings:rejected', { kind, reason: 'wrong_phase' });
        return;
      }
      const currentVersion = contentStore.getVersion(kind);
      if (typeof version === 'number' && version > 0 && Math.abs(currentVersion - version) > 1) {
        socket.emit('host:settings:rejected', { kind, reason: 'stale_version', currentVersion });
        return;
      }
      let result;
      if (kind === 'quiz')           result = contentStore.saveQuizRounds(data);
      else if (kind === 'trueFalse') result = contentStore.saveStatements(data);
      else if (kind === 'pointless') result = contentStore.savePointlessRounds(data);
      else { socket.emit('host:settings:rejected', { kind, reason: 'unknown_kind' }); return; }
      if (result.ok) {
        socket.emit('host:settings:saved', { kind, version: result.version });
      } else {
        socket.emit('host:settings:rejected', { kind, reason: 'validation', details: result.reason });
      }
    } catch (err) {
      console.error('[ERROR] host:settings:save:', err);
      socket.emit('host:settings:rejected', { kind, reason: 'server_error' });
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
            io.emit('championship:state', { active: true, sequence });
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
          // Per bug-report 2026-05-14 §D3: reveal auto-starts after the 30s
          // submission window. This case is now an optional "reveal early"
          // shortcut — if the round is still in 'playing' phase, end it
          // immediately (which itself triggers revealResults()). If we're
          // already in 'reveal' phase (the auto-call lost the race or this
          // is a legacy host UI), call revealResults() directly; it is
          // guarded against double-invocation.
          if (gameState.currentGame === 'pointless') {
            const pointlessGame = gameEngine.currentGameModule;
            if (gameState.pointless?.phase === 'playing' && typeof pointlessGame?.endRound === 'function') {
              pointlessGame.endRound();
            } else if (gameState.pointless?.phase === 'reveal' && typeof pointlessGame?.revealResults === 'function') {
              pointlessGame.revealResults();
            } else {
              socket.emit('error', { message: 'Pointless round is not in a revealable state' });
              return;
            }
          } else {
            socket.emit('error', { message: 'No Pointless round to reveal' });
            return;
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

  // Themed-dle (Pokédle / HP-dle) — guess submission
  // Payload shape varies by mode:
  //   classic/emoji/silhouette: { name: 'Pikachu' }
  //   spell:                    { name: 'Expecto Patronum' }
  //   grid:                     { row: 0, col: 1, name: 'Snape' }
  socket.on('themedDle:guess', (payload) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }
    const game = gameState.currentGame;
    if (game !== 'pokedle' && game !== 'hpdle') {
      socket.emit('error', { message: 'No themed-dle game running' });
      return;
    }
    if (gameState[game]?.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }
    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleGuess === 'function') {
      currentGame.handleGuess(playerId, payload);
    }
  });

  socket.on('numbers:operation', ({ aId, op, bId }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) { socket.emit('error', { message: 'Not registered' }); return; }
    if (gameState.currentGame !== 'numbers') { socket.emit('error', { message: 'Numbers Round not running' }); return; }
    if (gameState.numbers?.phase !== 'playing') { socket.emit('error', { message: 'Not in playing phase' }); return; }
    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleOperation === 'function') {
      currentGame.handleOperation(playerId, { aId, op, bId });
    }
  });
  socket.on('numbers:reset', () => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) return;
    if (gameState.currentGame !== 'numbers' || gameState.numbers?.phase !== 'playing') return;
    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleReset === 'function') {
      currentGame.handleReset(playerId);
    }
  });

  socket.on('wordle:submit', ({ guess }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }
    if (gameState.currentGame !== 'wordle') {
      socket.emit('error', { message: 'Wordle not running' });
      return;
    }
    if (gameState.wordle?.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }
    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleSubmit === 'function') {
      currentGame.handleSubmit(playerId, { guess });
    }
  });

  socket.on('travel:submit', ({ name }) => {
    const playerId = connectionManager.getPlayerId(socket.id);
    if (!playerId) {
      socket.emit('error', { message: 'Not registered' });
      return;
    }
    if (gameState.currentGame !== 'travel') {
      socket.emit('error', { message: 'Travel not running' });
      return;
    }
    if (gameState.travel?.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }
    const currentGame = gameEngine.currentGameModule;
    if (currentGame && typeof currentGame.handleSubmit === 'function') {
      currentGame.handleSubmit(playerId, { name });
    }
  });

  // Themed-dle — host configures mode/difficulty before starting
  socket.on('host:themedDle:configure', ({ mode, difficulty }) => {
    if (socket.id !== gameState.meta?.hostSocketId) {
      socket.emit('error', { message: 'Only host can configure' });
      return;
    }
    gameState.themedDleConfig = {
      mode: mode || 'classic',
      difficulty: difficulty || 'difficult'
    };
    console.log('[THEMEDDLE] Config set:', gameState.themedDleConfig);
    socket.emit('host:themedDle:configured', gameState.themedDleConfig);
  });

  // State synchronization for late joiners/refresh
  socket.on('request:state', () => {
    const players = Array.from(gameState.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      currentGameScore: p.currentGameScore,
      totalPlacementScore: p.totalPlacement,
      gamePlacements: p.placements,
      connected: p.connected
    }));

    socket.emit('players:update', players);

    socket.emit('phase:change', {
      phase: gameState.currentPhase,
      previousPhase: gameState.currentPhase,
      timestamp: Date.now()
    });

    if (gameState.currentGame) {
      socket.emit('game:start', {
        game: gameState.currentGame,
        timestamp: Date.now()
      });
    }

    if (gameEngine.currentGameModule && typeof gameEngine.currentGameModule.getState === 'function') {
      const state = gameEngine.currentGameModule.getState();

      // Quiz / TrueFalse intro+playing resync is handled by their
      // getResyncEvents() implementations below.

      if (gameState.currentGame === 'pointless' && gameState.pointless) {
        const pointlessState = gameState.pointless;

        if (pointlessState.phase === 'intro') {
          const remaining = Math.max(0, (state.introEndsAt || Date.now()) - Date.now());

          socket.emit('pointless:intro', {
            title: 'Pointless',
            description: 'We asked 100 people. Find an official answer that as few of them gave as possible.',
            scoringRules: [
              'Each official answer is scored by how many people said it',
              'Lower scores are better',
              'A pointless answer scores 0',
              'Invalid or missing answers score 100'
            ],
            placementInfo: 'Lowest total score wins this game',
            totalRounds: state.totalRounds,
            duration: remaining,
            endsAt: Date.now() + remaining
          });
        } else if (pointlessState.phase === 'playing') {
          const elapsed = Date.now() - pointlessState.startTime;
          const remaining = Math.max(0, POINTLESS_ROUND_DURATION - elapsed);

          socket.emit('pointless:round:start', {
            roundIndex: state.roundIndex,
            totalRounds: state.totalRounds,
            category: state.currentRound.category,
            question: state.currentRound.question,
            duration: remaining
          });

          // Per §D1/D2: rebroadcast progress so a re-mounted host display has
          // the live tracker without waiting for the next submission.
          if (typeof gameEngine.currentGameModule.broadcastProgress === 'function') {
            gameEngine.currentGameModule.broadcastProgress();
          }
        } else if (pointlessState.phase === 'reveal') {
          if (typeof gameEngine.currentGameModule.getDisplayRevealPayload === 'function') {
            const displayRevealPayload = gameEngine.currentGameModule.getDisplayRevealPayload();
            if (displayRevealPayload) {
              socket.emit('pointless:reveal:display', displayRevealPayload);
            }
          }

          const playerId = connectionManager.getPlayerId(socket.id);
          if (playerId && typeof gameEngine.currentGameModule.getRevealPayload === 'function') {
            const revealPayload = gameEngine.currentGameModule.getRevealPayload(playerId);
            if (revealPayload) {
              socket.emit('game:pointless:reveal', revealPayload);
            }
          }
        }
      }

      // Per bug-report 2026-05-14 §A5/§E8: re-emit playing-state events for
      // other games so a host display that re-mounts mid-game (e.g. after
      // toggling Dashboard ↔ Display) immediately repaints the active screen
      // instead of being stuck on "Loading…". We emit best-effort using each
      // module's getState() output — fields that aren't present simply mean
      // the screen will resync on the next live event anyway.
      const gameModule = gameEngine.currentGameModule;
      try {
        // Themed-dle, numbers, wordle, travel, quiz, trueFalse: replay the
        // playing-start (or results) events from the module's snapshot so the
        // host display re-routes off "Loading…" immediately. The contract:
        //
        //   getResyncEvents({ socketId, playerId, isHost }) -> Array<{name, payload}>
        //
        // The returned events are emitted ONLY to the requesting socket. Each
        // module decides what to expose to host vs. player (e.g. the host gets
        // the target for wordle / themed-dle; players never do). If a module
        // can't safely resync the current phase, it returns []. Note the
        // pointless / quiz-intro / truefalse-intro / quiz-question / quiz-voting
        // / truefalse-statement branches above handle their own resync inline,
        // so games shouldn't double-emit those.
        if (typeof gameModule?.getResyncEvents === 'function') {
          const requestingPlayerId = connectionManager.getPlayerId(socket.id);
          const events = gameModule.getResyncEvents({
            socketId: socket.id,
            playerId: requestingPlayerId,
            isHost: socket.id === gameState.meta.hostSocketId
          }) || [];
          for (const evt of events) {
            socket.emit(evt.name, evt.payload);
          }
        }
      } catch (resyncError) {
        console.warn('[REQUEST:STATE] Resync emit failed:', resyncError?.message || resyncError);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const playerId = connectionManager.handleDisconnection(socket.id, socket);

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
  const stats = errorReporter.errorStats();
  if (stats.size > 0) {
    console.log(`[SHUTDOWN] Dumping ${stats.size} recent error(s) from ring buffer:`);
    for (const entry of errorReporter.recentErrors()) {
      console.log(`  - [${entry.type}] ${new Date(entry.ts).toISOString()}: ${entry.payload?.error?.message || ''}`);
    }
  }
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

export { io, gameState, connectionManager, gameEngine };
