import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const SERVER_URL = 'http://localhost:3000';
const NUM_PLAYERS = 30;
const HOST_PASSWORD = 'test123'; // Matches your .env.local
const LOG_FILE = path.join(process.cwd(), 'load-test.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
}

// Clear log
fs.writeFileSync(LOG_FILE, '');
log(`[LOAD_TEST] Starting test with ${NUM_PLAYERS} players...`);

const players = [];
const hostSocket = io(SERVER_URL, { forceNew: true });
let votingStarted = false;

// 1. Setup Host
hostSocket.on('connect', () => {
  log('[HOST] Connected, logging in...');
  hostSocket.emit('host:join', { password: HOST_PASSWORD });
});

hostSocket.on('host:joined', () => {
  log('[HOST] Login successful. Resetting game...');
  hostSocket.emit('host:control', { action: 'reset' });
  
  setTimeout(() => {
    log('[HOST] Starting Quiz...');
    hostSocket.emit('host:control', { action: 'start', game: 'quiz' });
  }, 2000);
});

hostSocket.on('error', (err) => {
  log(`[HOST] Error: ${err.message}`);
});

// 2. Setup Players
for (let i = 0; i < NUM_PLAYERS; i++) {
  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    autoConnect: false,
    forceNew: true
  });

  socket.on('connect', () => {
    socket.emit('player:join', { name: `LoadTester_${i}` });
  });

  // Listen for the specific voting event on the first player only to trigger the mass vote
  if (i === 0) {
    socket.on('quiz:intro', (data) => {
      log(`[GAME] Intro started. Waiting ${data.duration}ms for voting...`);
  });

    socket.on('quiz:voting:start', (data) => {
      if (votingStarted) return;
      votingStarted = true;
      
      const firstOption = data.options[0].id;
      log(`[GAME] Voting started! Casting ${NUM_PLAYERS} votes for option: ${firstOption}`);

      // Mass Vote
      let votesCast = 0;
      players.forEach((p, idx) => {
        if (p.connected) {
          // Stagger votes slightly to be realistic (over 200ms)
          setTimeout(() => {
            p.emit('quiz:vote', { optionId: firstOption });
            votesCast++;
            if (votesCast === players.length) {
               log('[GAME] All votes cast.');
            }
          }, Math.random() * 200);
        }
      });
  });

    socket.on('quiz:voting:end', (data) => {
        log(`[GAME] Voting ended. Winner: ${data.winningOption.category}. Votes: ${JSON.stringify(data.voteCounts)}`);
        cleanup();
  });
  }

  players.push(socket);
  
  // Stagger connections
  setTimeout(() => {
    socket.connect();
  }, i * 30);
}

function cleanup() {
  log('[LOAD_TEST] Test complete. Disconnecting...');
  hostSocket.disconnect();
  players.forEach(p => p.disconnect());
  setTimeout(() => process.exit(0), 1000);
}

// Safety timeout (60s)
setTimeout(() => {
  log('[TIMEOUT] Test took too long. Force exiting.');
  cleanup();
}, 60000);

