# **TECHNICAL IMPLEMENTATION PLAN**

## **ARCHITECTURE DECISION**

### **Stack Confirmation:**
```yaml
Backend:
  - Runtime: Node.js v20+
  - Framework: Express.js
  - WebSocket: Socket.io v4.6+
  - Validation: joi (for event validation)
  - Dictionary: an-array-of-english-words (npm)
  - Utils: uuid, lodash, cors
  
Frontend:
  - Framework: React 18 + TypeScript
  - Build: Vite (faster than CRA)
  - Styling: Tailwind CSS
  - State: Zustand (simpler than Redux)
  - Animations: Framer Motion
  - WebSocket: socket.io-client
  - UI: Radix UI primitives

Deployment:
  - Platform: Railway.app
  - Environment: Production Node
  - Domain: Custom domain or Railway subdomain
```

### **No Database Required - In-Memory State**
```javascript
// Server state structure - NO database needed!
const gameState = {
  meta: {
    gameId: crypto.randomUUID(),
    startedAt: null,
    hostSocketId: null,
    config: {
      maxPlayers: 30,
      gameSequence: ['quiz', 'trueFalse', 'countdown']
    }
  },
  
  players: new Map(), // playerId -> playerObject
  
  currentGame: null, // 'quiz' | 'trueFalse' | 'countdown'
  currentPhase: 'lobby', // lobby | playing | leaderboard | finished
  
  // Game-specific state
  quiz: { /* ... */ },
  trueFalse: { /* ... */ },
  countdown: { /* ... */ }
};
```

## **COLOR SCHEME (Plandek-inspired)**

Based on Plandek's analytics/data visualization theme:

```javascript
const colors = {
  // Primary Palette
  primary: {
    navy: '#1a2332',      // Dark navy (background)
    blue: '#0066FF',      // Bright blue (primary actions)
    teal: '#00D4AA',      // Teal (success/correct)
    purple: '#7B61FF',    // Purple (special/leader)
  },
  
  // Game State Colors
  game: {
    correct: '#00D4AA',   // Teal
    incorrect: '#FF4757', // Soft red
    warning: '#FFA502',   // Orange
    leader: '#FFD700',    // Gold
  },
  
  // Difficulty Colors (Game 1)
  difficulty: {
    easy: '#00D4AA',      // Teal
    medium: '#0066FF',    // Blue
    hard: '#FFA502',      // Orange
    impossible: '#FF4757', // Red
  },
  
  // UI Elements
  ui: {
    background: '#0F1419',     // Very dark
    cardBg: '#1a2332',        // Navy
    border: '#2A3441',        // Subtle border
    text: '#FFFFFF',          // White
    textMuted: '#8B92A1',     // Gray
    overlay: 'rgba(0,0,0,0.7)'
  },
  
  // Answer Buttons (Game 1)
  answers: {
    A: '#0066FF',  // Blue
    B: '#00D4AA',  // Teal
    C: '#FFA502',  // Orange
    D: '#7B61FF',  // Purple
  }
};
```

## **CONNECTION ARCHITECTURE FOR 30+ PLAYERS**

```javascript
// Server-side connection management
class ConnectionManager {
  constructor() {
    this.connections = new Map(); // socketId -> playerId
    this.playerSockets = new Map(); // playerId -> socketId
    this.reconnectTokens = new Map(); // token -> playerId
    this.rateLimiter = new Map(); // socketId -> timestamp
  }
  
  handleConnection(socket) {
    // Rate limiting
    const lastAction = this.rateLimiter.get(socket.id) || 0;
    if (Date.now() - lastAction < 50) return false; // 50ms cooldown
    
    // Connection tracking
    console.log(`[CONNECT] Socket ${socket.id} connected`);
    
    // Heartbeat for connection health
    socket.pingTimeout = setTimeout(() => {
      socket.disconnect();
    }, 30000);
    
    socket.on('pong', () => {
      clearTimeout(socket.pingTimeout);
      socket.pingTimeout = setTimeout(() => {
        socket.disconnect();
      }, 30000);
    });
    
    return true;
  }
}

// Client-side reconnection strategy
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ['websocket'], // Skip polling for better performance
});
```

## **PROJECT STRUCTURE**

```
peter-house-of-games/
├── server/
│   ├── src/
│   │   ├── index.js              # Entry point
│   │   ├── gameEngine.js         # Core game logic
│   │   ├── connectionManager.js  # WebSocket handling
│   │   ├── games/
│   │   │   ├── quiz.js          # Game 1 logic
│   │   │   ├── trueFalse.js     # Game 2 logic
│   │   │   └── countdown.js     # Game 3 logic
│   │   ├── utils/
│   │   │   ├── timer.js         # Timer management
│   │   │   ├── scoring.js       # Score calculations
│   │   │   └── validation.js    # Event validation
│   │   └── data/
│   │       ├── questions.json   # Quiz questions
│   │       ├── statements.json  # True/false statements
│   │       └── dictionary.json  # Word list for Countdown
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── stores/
│   │   │   └── gameStore.ts     # Zustand store
│   │   ├── hooks/
│   │   │   └── useSocket.ts     # Socket.io hook
│   │   ├── screens/
│   │   │   ├── Lobby.tsx
│   │   │   ├── Quiz.tsx
│   │   │   ├── TrueFalse.tsx
│   │   │   ├── Countdown.tsx
│   │   │   └── Leaderboard.tsx
│   │   └── components/
│   │       ├── Timer.tsx
│   │       ├── Button.tsx
│   │       └── AnimatedScore.tsx
│   └── package.json
│
├── host/
│   ├── src/
│   │   ├── App.tsx              # Host control panel
│   │   ├── screens/
│   │   │   ├── Dashboard.tsx    # Main control
│   │   │   └── Display.tsx      # Projector view
│   └── package.json
│
└── deploy/
    ├── railway.toml
    └── .env.example
```

## **IMPLEMENTATION PLAN FOR CODING AGENT**

### **PHASE 1: Core Infrastructure (Day 1-2)**

```markdown
## Task 1.1: Initialize Project
- Create monorepo structure with three packages (server, client, host)
- Set up TypeScript configurations
- Install core dependencies
- Create basic Express server with Socket.io
- Test with simple echo message

## Task 1.2: Connection System
- Implement ConnectionManager class
- Add player join/leave logic
- Create reconnection token system
- Add rate limiting
- Test with 30+ simultaneous connections using artillery.io

## Task 1.3: Game State Manager
- Create GameEngine class with state management
- Implement phase transitions (lobby → game → leaderboard)
- Add event validation with joi
- Create Timer class for countdowns
- Test state mutations
```

### **PHASE 2: Player Client Foundation (Day 3-4)**

```markdown
## Task 2.1: React Setup
- Initialize Vite + React + TypeScript
- Configure Tailwind with Plandek colors
- Create responsive layout shell
- Add Framer Motion

## Task 2.2: Socket Hook
- Create useSocket custom hook
- Implement reconnection UI
- Add connection state indicators
- Create event listener system

## Task 2.3: Basic Screens
- Lobby screen with join form
- Waiting room with player list
- Basic navigation system
- Error boundary setup
```

### **PHASE 3: Game 1 - Quiz (Day 5-7)**

```markdown
## Task 3.1: Backend Quiz Logic
- Create quiz.js game module
- Load questions from JSON
- Implement voting system with 2x leader multiplier
- Add category selection algorithm
- Create scoring calculator

## Task 3.2: Frontend Quiz Screens  
- Vote screen with 4 categories
- Question display with 4 answer buttons
- Results screen with animations
- Live leaderboard component

## Task 3.3: Quiz Testing
- Add 60 test questions (15 per difficulty)
- Test voting edge cases
- Verify scoring accuracy
- Load test with 30 players
```

### **PHASE 4: Game 2 - True/False (Day 8-9)**

```markdown
## Task 4.1: Backend True/False
- Create trueFalse.js module  
- Implement rapid-fire timing
- Add statement rotation logic

## Task 4.2: Frontend True/False
- Simple two-button interface
- Success rate display
- Quick transition animations

## Task 4.3: Content & Testing
- Add 20+ statements
- Test timing precision
- Verify state transitions
```

### **PHASE 5: Game 3 - Countdown (Day 10-12)**

```markdown
## Task 5.1: Countdown Logic
- Implement letter generation algorithm
- Add dictionary validation (an-array-of-english-words)
- Create word scoring system
- Handle edge cases (invalid words, no submission)

## Task 5.2: Countdown UI
- Letter display grid
- Text input with auto-caps
- Letter usage tracker
- Results sorting by length

## Task 5.3: Dictionary Setup
- Load and optimize word list
- Test validation speed
- Add common proper nouns
```

### **PHASE 6: Host Control Panel (Day 13-14)**

```markdown
## Task 6.1: Host Dashboard
- Authentication screen
- Player management table
- Game control buttons (start/pause/next)
- Manual override controls

## Task 6.2: Projector Display
- Full-screen game view
- Live statistics
- Dramatic transitions
- QR code for joining

## Task 6.3: Host Integration
- Sync with game state
- Add admin events
- Test all controls
```

### **PHASE 7: Polish & Deploy (Day 15-17)**

```markdown
## Task 7.1: UI Polish
- Add sound effects (optional)
- Smooth all animations
- Mobile optimization
- Loading states

## Task 7.2: Error Handling
- Graceful disconnection handling  
- Network error recovery
- Invalid state recovery
- User-friendly error messages

## Task 7.3: Deployment
- Configure Railway deployment
- Environment variables setup
- HTTPS configuration
- Create join.plandek-party.com subdomain
```

### **PHASE 8: Testing & Rehearsal (Day 18-20)**

```markdown
## Task 8.1: Load Testing
- Simulate 40 concurrent players
- Test on actual mobile devices
- Verify on office WiFi
- Measure latency

## Task 8.2: Content Review
- Finalize all questions
- Collect colleague facts
- Test all word validations
- Review difficulty balance

## Task 8.3: Dress Rehearsal
- Full run-through with team
- Test projector setup
- Practice host controls
- Gather feedback
```

## **CRITICAL FIRST COMMANDS FOR CODING AGENT**

```bash
# Start here!
mkdir peter-house-of-games
cd peter-house-of-games

# Initialize monorepo
npm init -y
npm install -D lerna
npx lerna init

# Create packages
mkdir -p packages/server packages/client packages/host

# Server setup
cd packages/server
npm init -y
npm install express socket.io cors uuid joi an-array-of-english-words
npm install -D nodemon @types/node

# Client setup  
cd ../client
npm create vite@latest . -- --template react-ts
npm install socket.io-client zustand framer-motion
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Host setup
cd ../host
npm create vite@latest . -- --template react-ts
npm install socket.io-client framer-motion recharts
```

## **FIRST FILE TO CREATE**

```javascript
// packages/server/src/index.js
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = require('http').createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"]
  }
});

const gameState = {
  players: new Map(),
  phase: 'lobby',
  currentGame: null
};

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  socket.on('player:join', ({ name }) => {
    const playerId = crypto.randomUUID();
    gameState.players.set(playerId, {
      id: playerId,
      name,
      socketId: socket.id,
      score: 0
    });
    
    socket.emit('player:joined', { playerId, name });
    io.emit('players:update', Array.from(gameState.players.values()));
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
```

This plan gives you everything needed to build the system. Start with Phase 1 and test each component before moving forward. The architecture is designed to handle 30+ players easily with room to scale.