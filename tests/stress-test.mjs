/**
 * PHoG Stress Test - 50 simulated players
 * Usage: node tests/stress-test.js [numPlayers] [serverUrl]
 *
 * Simulates players joining, then playing through a championship:
 *   Quiz (10 rounds) → True/False (20 statements) → Pointless (5 rounds)
 *
 * The host must start the championship manually from the host panel,
 * OR pass --auto-host to have this script act as host too.
 */

import { io } from 'socket.io-client';

const NUM_PLAYERS = parseInt(process.argv[2]) || 50;
const SERVER_URL = process.argv[3] || 'http://localhost:3000';
const AUTO_HOST = process.argv.includes('--auto-host');
const HOST_PASSWORD = process.argv.find(a => a.startsWith('--password='))?.split('=')[1] || 'test123';

// Fun names for simulated players
const FIRST_NAMES = [
  'Speed', 'Turbo', 'Mega', 'Ultra', 'Hyper', 'Super', 'Quantum', 'Cosmic',
  'Thunder', 'Flash', 'Blaze', 'Storm', 'Shadow', 'Pixel', 'Glitch', 'Byte',
  'Nova', 'Zen', 'Ace', 'Lucky', 'Mighty', 'Swift', 'Bold', 'Epic', 'Nitro',
  'Neon', 'Laser', 'Cyber', 'Turbo', 'Rocket', 'Plasma', 'Fusion', 'Alpha',
  'Beta', 'Omega', 'Delta', 'Sigma', 'Zeta', 'Iron', 'Steel', 'Chrome',
  'Titan', 'Atlas', 'Zeus', 'Thor', 'Odin', 'Mars', 'Luna', 'Sol', 'Star', 'Comet'
];

const LAST_NAMES = [
  'Fox', 'Wolf', 'Bear', 'Hawk', 'Lion', 'Tiger', 'Eagle', 'Shark',
  'Dragon', 'Phoenix', 'Cobra', 'Viper', 'Falcon', 'Panther', 'Jaguar', 'Raven',
  'Bot', 'Player', 'Gamer', 'Champ', 'Pro', 'King', 'Queen', 'Knight',
  'Wizard', 'Ninja', 'Pirate', 'Viking', 'Samurai', 'Spartan', 'Ranger', 'Scout',
  'Chief', 'Boss', 'Legend', 'Hero', 'Ace', 'Star', 'Master', 'Lord',
  'Duke', 'Baron', 'Count', 'Prince', 'Sage', 'Oracle', 'Mystic', 'Ghost', 'Phantom', 'Spectre'
];

// Known pointless answers for realistic submissions
const POINTLESS_ANSWERS = {
  'South American Countries': ['brazil', 'argentina', 'chile', 'peru', 'colombia', 'ecuador', 'bolivia', 'venezuela', 'uruguay', 'paraguay', 'guyana', 'suriname'],
  'Countries Beginning with B': ['brazil', 'belgium', 'bangladesh', 'bahamas', 'bulgaria', 'botswana', 'belarus', 'bahrain', 'bolivia', 'bhutan', 'benin', 'belize', 'barbados', 'brunei', 'burkina faso', 'burundi', 'bosnia and herzegovina'],
  'Nintendo Home Consoles': ['switch', 'wii', 'nintendo 64', 'gamecube', 'snes', 'nes', 'wii u'],
  'Premier League Title-Winning Clubs': ['manchester united', 'liverpool', 'arsenal', 'chelsea', 'manchester city', 'leicester city', 'blackburn rovers'],
  'Planets and Dwarf Planets': ['earth', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus', 'pluto', 'ceres', 'eris', 'makemake', 'haumea']
};

// Stats tracking
const stats = {
  connected: 0,
  joined: 0,
  quizVotes: 0,
  quizAnswers: 0,
  trueFalseAnswers: 0,
  pointlessAnswers: 0,
  countdownSubmits: 0,
  numbersOps: 0,
  wordleGuesses: 0,
  travelGuesses: 0,
  themedDleGuesses: 0,
  errors: 0,
  disconnects: 0,
  gamesCompleted: new Set()
};

// Small word lists for free-form game inputs. Don't need to be valid for every
// puzzle — server validates; invalid submissions are no-ops, not errors.
const COMMON_5_LETTER_WORDS = [
  'plays', 'plumb', 'crane', 'slate', 'audio', 'piano', 'media', 'beach',
  'house', 'place', 'thing', 'world', 'right', 'might', 'plane', 'glory',
  'water', 'fight', 'light', 'sound', 'green', 'black', 'spore', 'crone'
];
const COMMON_SHORT_WORDS = [
  'cat', 'dog', 'run', 'sun', 'sea', 'eat', 'bat', 'rat', 'tap', 'pet',
  'four', 'time', 'race', 'tear', 'rope', 'star', 'rest', 'east', 'mate'
];

function randomDelay(min, max) {
  return new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateName(index) {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]}${LAST_NAMES[index % LAST_NAMES.length]}`;
}

function printStats() {
  console.log(`\n📊 Stats: ${stats.connected}c/${stats.joined}j | Quiz ${stats.quizVotes}v/${stats.quizAnswers}a | TF ${stats.trueFalseAnswers}a | PL ${stats.pointlessAnswers}a | CD ${stats.countdownSubmits} | NUM ${stats.numbersOps} | WRD ${stats.wordleGuesses} | TRV ${stats.travelGuesses} | DLE ${stats.themedDleGuesses} | err ${stats.errors} | dc ${stats.disconnects}`);
}

function createPlayer(index) {
  return new Promise((resolve) => {
    const name = generateName(index);
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    let playerId = null;
    let currentGame = null;

    socket.on('connect', () => {
      stats.connected++;
      socket.emit('player:join', { name });
    });

    // Respond to server heartbeat pings
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      stats.connected--;
      stats.disconnects++;
    });

    socket.on('error', (err) => {
      stats.errors++;
      console.error(`  ❌ [${name}] Error: ${err.message}`);
    });

    socket.on('player:joined', (data) => {
      playerId = data.playerId;
      stats.joined++;
      if (stats.joined % 10 === 0 || stats.joined === NUM_PLAYERS) {
        console.log(`  ✅ ${stats.joined}/${NUM_PLAYERS} players joined`);
      }
      if (stats.joined === NUM_PLAYERS) {
        console.log('\n🎉 All players connected! Waiting for host to start championship...\n');
      }
      resolve({ socket, name, playerId });
    });

    // --- Game start ---
    socket.on('game:start', ({ game }) => {
      currentGame = game;
      if (index === 0) {
        stats.gamesCompleted.add(game);
        console.log(`\n🎮 Game started: ${game.toUpperCase()}`);
      }
    });

    // --- QUIZ: Vote on category ---
    socket.on('quiz:voting:start', async (data) => {
      await randomDelay(500, 4000);
      if (data.options && data.options.length > 0) {
        const choice = randomChoice(data.options);
        socket.emit('quiz:vote', { optionId: choice.id });
        stats.quizVotes++;
      }
    });

    // --- QUIZ: Answer question ---
    socket.on('quiz:question:start', async (data) => {
      const thinkTime = 1000 + Math.random() * (data.duration - 2000); // Answer within time limit
      await randomDelay(1000, Math.min(thinkTime, data.duration - 1000));
      const answers = ['A', 'B', 'C', 'D'];
      const answer = randomChoice(answers);
      const timeRemaining = Math.max(0, data.duration - thinkTime);

      socket.emit('quiz:answer', {
        questionId: data.questionId,
        answer,
        timeRemaining: Math.round(timeRemaining)
      });
      stats.quizAnswers++;
    });

    // --- TRUE/FALSE: Answer statement ---
    socket.on('truefalse:statement', async (data) => {
      await randomDelay(200, 3500); // Rapid fire — faster responses
      const answer = Math.random() < 0.5; // 50/50 guess
      socket.emit('truefalse:answer', {
        statementId: data.statementId,
        answer
      });
      stats.trueFalseAnswers++;
    });

    // --- POINTLESS: Submit answer ---
    socket.on('pointless:round:start', async (data) => {
      await randomDelay(1000, 12000);

      // Try to pick a known answer for this category, or submit something random
      const knownAnswers = POINTLESS_ANSWERS[data.category];
      let text;
      if (knownAnswers && Math.random() < 0.7) {
        // 70% chance of submitting a known answer
        text = randomChoice(knownAnswers);
      } else {
        // 30% chance of a wild guess
        text = randomChoice(['banana', 'pizza', 'the moon', 'neptune', 'shakespeare', 'france']);
      }

      socket.emit('pointless:submit', { text });
      stats.pointlessAnswers++;
    });

    // --- COUNTDOWN (word from letters): submit a short word ---
    socket.on('countdown:round:start', async (data) => {
      await randomDelay(2000, 18000);
      // Try to form a 2-4 letter word from the given letters; fall back to a common word
      // (server validates; invalid is rejected silently — that's fine for the smoke test).
      const letters = (data.letters || []).map(l => String(l).toLowerCase());
      let word = null;
      // Try a known short word that uses only letters from the pool (with multiplicity)
      for (const w of COMMON_SHORT_WORDS) {
        const pool = letters.slice();
        let ok = true;
        for (const c of w) {
          const i = pool.indexOf(c);
          if (i < 0) { ok = false; break; }
          pool.splice(i, 1);
        }
        if (ok) { word = w; break; }
      }
      if (!word) word = letters.slice(0, 3).join(''); // last resort
      socket.emit('countdown:submit', { word });
      stats.countdownSubmits++;
    });

    // --- NUMBERS: do one or two random operations to make progress ---
    let numbersPool = []; // current pool per player
    socket.on('numbers:round:start', async (data) => {
      numbersPool = (data.tiles || []).map(t => ({ id: t.id, value: t.value }));
      // Do up to 3 random valid operations
      for (let i = 0; i < 3 && numbersPool.length >= 2; i++) {
        await randomDelay(1500, 5000);
        const a = randomChoice(numbersPool);
        const candidates = numbersPool.filter(t => t.id !== a.id);
        if (candidates.length === 0) break;
        const b = randomChoice(candidates);
        const op = randomChoice(['+', '*', '-']); // skip '/' to avoid frequent non-integer rejects
        socket.emit('numbers:operation', { aId: a.id, op, bId: b.id });
        stats.numbersOps++;
      }
    });
    // Track operation acks so we can update our local pool
    socket.on('numbers:operation:ack', (payload) => {
      // payload typically includes new tile id + value, and the consumed ids
      // We don't need to be precise — just remove consumed and add new
      if (payload?.consumed && payload?.result) {
        numbersPool = numbersPool.filter(t => !payload.consumed.includes(t.id));
        numbersPool.push({ id: payload.result.id, value: payload.result.value });
      }
    });
    socket.on('numbers:progress', () => {
      // No-op — bots don't react to others' progress
    });

    // --- WORDLE: submit a random 5-letter word, up to 6 attempts ---
    let wordleGuessesUsed = 0;
    socket.on('wordle:round:start', () => {
      wordleGuessesUsed = 0;
    });
    async function submitWordleGuess() {
      if (wordleGuessesUsed >= 6) return;
      await randomDelay(2000, 9000);
      const guess = randomChoice(COMMON_5_LETTER_WORDS);
      socket.emit('wordle:submit', { guess });
      stats.wordleGuesses++;
      wordleGuessesUsed++;
    }
    // After round start, kick off first guess
    socket.on('wordle:round:start', () => { submitWordleGuess(); });
    // Re-guess after every result (until solved or out of guesses)
    socket.on('wordle:guess:result', (data) => {
      if (data?.solved) return;
      if ((data?.guessesRemaining ?? 0) <= 0) return;
      submitWordleGuess();
    });
    socket.on('wordle:guess:invalid', () => {
      // Try a different word (no count consumed for invalid)
      if (wordleGuessesUsed < 6) submitWordleGuess();
    });

    // --- TRAVEL: submit random countries from the relevant list ---
    let travelCandidates = [];
    let travelGuessCount = 0;
    socket.on('travel:round:start', (data) => {
      // The round-start exposes the full set of relevant countries between start and end.
      travelCandidates = (data.relevantNames || []).filter(n => n !== data.start && n !== data.end);
      travelGuessCount = 0;
      // Submit 2-4 guesses spaced out
      const numGuesses = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numGuesses; i++) {
        setTimeout(() => {
          if (travelCandidates.length === 0) return;
          const name = randomChoice(travelCandidates);
          socket.emit('travel:submit', { name });
          stats.travelGuesses++;
          travelGuessCount++;
        }, 2000 + i * 4000);
      }
    });
    socket.on('travel:guess:result', () => { /* keep submitting from round-start schedule */ });

    // --- THEMED-DLE (Pokédle / HPdle): submit guesses per mode ---
    let dleRoster = [];        // current mode's public roster (names)
    let dleSpells = [];        // hp 'spell' mode list (if any)
    let dleMode = null;
    let dleGuessesUsed = 0;
    let dleMaxGuesses = 5;
    function dleEvent(suffix) {
      return ['pokedle', 'hpdle'].map(g => `${g}:${suffix}`);
    }
    for (const ev of dleEvent('intro')) {
      socket.on(ev, (data) => {
        dleMode = data?.mode || null;
        dleGuessesUsed = 0;
        dleMaxGuesses = data?.maxGuesses || (data?.mode === 'spell' ? 5 : 5);
      });
    }
    async function submitDleGuess(gameName, fromPayload) {
      if (dleGuessesUsed >= dleMaxGuesses) return;
      await randomDelay(2000, 12000);
      if (dleMode === 'grid') {
        // Pick a random cell + a random roster name
        const row = Math.floor(Math.random() * 3);
        const col = Math.floor(Math.random() * 3);
        const name = dleRoster.length ? randomChoice(dleRoster).name || randomChoice(dleRoster) : 'unknown';
        socket.emit('themedDle:guess', { row, col, name: typeof name === 'string' ? name : name?.name });
      } else if (dleMode === 'spell') {
        const name = dleSpells.length ? randomChoice(dleSpells) : 'lumos';
        socket.emit('themedDle:guess', { name: typeof name === 'string' ? name : name?.name });
      } else {
        const entry = dleRoster.length ? randomChoice(dleRoster) : { name: 'unknown' };
        const name = typeof entry === 'string' ? entry : entry?.name;
        socket.emit('themedDle:guess', { name });
      }
      stats.themedDleGuesses++;
      dleGuessesUsed++;
    }
    for (const ev of dleEvent('playing:start')) {
      socket.on(ev, (data) => {
        dleMode = data?.mode || dleMode;
        dleMaxGuesses = data?.maxGuesses || dleMaxGuesses;
        dleRoster = data?.roster || dleRoster;
        dleSpells = data?.spells || dleSpells;
        // Kick off first guess after a short delay
        setTimeout(() => submitDleGuess(), 1500);
      });
    }
    for (const ev of dleEvent('guess:result')) {
      socket.on(ev, (data) => {
        if (data?.solved) return;
        if (dleGuessesUsed < dleMaxGuesses) submitDleGuess();
      });
    }
    for (const ev of dleEvent('grid:cell:result')) {
      socket.on(ev, (data) => {
        if (dleGuessesUsed < dleMaxGuesses) submitDleGuess();
      });
    }

    // --- Session end ---
    socket.on('session:end', () => {
      if (index === 0) {
        console.log('\n🏆 Session ended!');
        printStats();
      }
    });

    // Connection timeout
    setTimeout(() => {
      if (!playerId) {
        console.error(`  ⏰ [${name}] Failed to join within 10s`);
        stats.errors++;
        resolve({ socket, name, playerId: null });
      }
    }, 10000);
  });
}

async function createHost() {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('🎙️  Auto-host connected, authenticating...');
      socket.emit('host:join', { password: HOST_PASSWORD });
    });

    // Heartbeat — server expects a pong reply to its ping, otherwise it disconnects us.
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('host:joined', async (data) => {
      console.log('🎙️  Auto-host authenticated. Current phase:', data?.gameState?.phase || 'unknown');

      // Reset game if not in lobby
      if (data?.gameState?.phase !== 'lobby') {
        console.log('🎙️  Game not in lobby, resetting...');
        socket.emit('host:control', { action: 'reset' });
        await randomDelay(2000, 2000);
      }

      console.log('🎙️  Starting championship in 3s...');
      await randomDelay(3000, 3000);

      // Allow caller to choose championship sequence via --sequence=g1,g2,...
      const seqArg = process.argv.find(a => a.startsWith('--sequence='));
      const sequence = seqArg
        ? seqArg.split('=')[1].split(',').filter(Boolean)
        : ['quiz', 'trueFalse', 'pointless', 'countdown', 'numbers', 'wordle', 'travel', 'pokedle', 'hpdle'];
      console.log(`🎙️  Starting championship: ${sequence.join(' → ')}`);
      socket.emit('host:control', {
        action: 'startChampionship',
        sequence
      });
      resolve(socket);
    });

    // Auto-advance championship: after each `game:end`, wait 12s (leaderboard duration + 2s buffer)
    // and emit host:control { nextGame }.
    let nextScheduled = false;
    socket.on('game:end', ({ game }) => {
      if (nextScheduled) return;
      nextScheduled = true;
      console.log(`🎙️  Game ended (${game}) — scheduling nextGame in 12s`);
      setTimeout(() => {
        nextScheduled = false;
        console.log('🎙️  Sending host:control { action: nextGame }');
        socket.emit('host:control', { action: 'nextGame' });
      }, 12000);
    });

    socket.on('session:end', () => {
      console.log('🎙️  Auto-host: session ended (championship finished).');
    });

    socket.on('host:rejected', (data) => {
      console.error('❌ Host authentication failed:', data.message);
      process.exit(1);
    });
  });
}

// --- Main ---
async function main() {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  PHoG Stress Test`);
  console.log(`  Players: ${NUM_PLAYERS} | Server: ${SERVER_URL}`);
  console.log(`  Auto-host: ${AUTO_HOST ? 'YES' : 'NO (start from host panel)'}`);
  console.log(`${'═'.repeat(50)}\n`);

  // Connect players in batches to avoid overwhelming the server
  const BATCH_SIZE = 10;
  const players = [];

  for (let batch = 0; batch < Math.ceil(NUM_PLAYERS / BATCH_SIZE); batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_PLAYERS);

    console.log(`  Connecting batch ${batch + 1}: players ${batchStart + 1}-${batchEnd}...`);

    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(createPlayer(i));
    }

    const batchPlayers = await Promise.all(batchPromises);
    players.push(...batchPlayers);

    // Small delay between batches
    if (batchEnd < NUM_PLAYERS) {
      await randomDelay(500, 1000);
    }
  }

  // Start auto-host if enabled
  if (AUTO_HOST) {
    await createHost();
  }

  // Print periodic stats
  const statsInterval = setInterval(printStats, 15000);

  // Graceful shutdown
  const cleanup = () => {
    console.log('\n\n🛑 Shutting down stress test...');
    clearInterval(statsInterval);
    printStats();

    players.forEach(({ socket }) => {
      if (socket.connected) socket.disconnect();
    });

    console.log('👋 All players disconnected. Done.\n');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Auto-exit after 20 minutes
  setTimeout(() => {
    console.log('\n⏰ 20-minute timeout reached.');
    cleanup();
  }, 20 * 60 * 1000);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
