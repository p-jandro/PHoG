# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PHoG (Peter's House of Games) is a real-time multiplayer gameshow system supporting 30+ concurrent players. The system consists of three separate applications in a monorepo structure:
- **Server**: Node.js backend with WebSocket support (packages/server)
- **Client**: React player interface (packages/client)
- **Host**: React control panel (packages/host)

## Technology Stack

**Backend:**
- Node.js v20+ with ES modules (`"type": "module"`)
- Express.js for HTTP server
- Socket.io v4.7+ for WebSocket communication
- Joi for event validation
- In-memory state (no database)

**Frontend:**
- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- Framer Motion for animations
- Socket.io-client for WebSocket connections

## Development Commands

### Running the Application

The application requires three separate processes running simultaneously:

```bash
# Terminal 1 - Server (runs on port 3000)
cd packages/server
npm run dev

# Terminal 2 - Player Client (runs on port 5173)
cd packages/client
npm run dev

# Terminal 3 - Host Control Panel (runs on port 5174)
cd packages/host
npm run dev
```

### Testing

```bash
# Server tests (if implemented)
cd packages/server
npm test

# Client tests (if implemented)
cd packages/client
npm test
```

### Building for Production

```bash
# Client
cd packages/client
npm run build  # Output: dist/

# Host
cd packages/host
npm run build  # Output: dist/
```

## Architecture Overview

### Connection Management (Server)

The server uses a custom `ConnectionManager` class to handle 30+ concurrent WebSocket connections with:
- Reconnection token system for recovering dropped connections
- Heartbeat monitoring (45-second timeout)
- Rate limiting capabilities (currently disabled but available)

Key file: `packages/server/src/connectionManager.js`

### Game Engine (Server)

The `GameEngine` class orchestrates game flow and state transitions:
- Phase management: `lobby → playing → leaderboard → finished`
- Championship mode for sequential games
- Centralized score tracking and leaderboard generation
- Event broadcasting to all connected clients

Key file: `packages/server/src/gameEngine.js`

### Game Modules (Server)

Each game is implemented as a separate module in `packages/server/src/games/`:
- `quiz.js`: Category voting with difficulty-based questions
- `trueFalse.js`: Rapid-fire true/false statements
- `countdown.js`: Word formation with dictionary validation
- `pointless.js`: Additional game mode

Games follow a consistent pattern:
1. Initialize game state
2. Broadcast phase updates
3. Collect player responses
4. Calculate scores
5. Generate results

### Client State Management

The client uses Zustand for state management with a single store (`packages/client/src/stores/gameStore.ts`) that tracks:
- Connection status
- Player identity (ID, name, reconnect token)
- Game phase and current game
- Player list with scores and placements

WebSocket communication is handled via a custom `useSocket` hook that:
- Auto-reconnects using stored tokens
- Listens for all game events
- Updates Zustand store reactively

### Scoring System

Scoring logic is centralized in `packages/server/src/utils/scoring.js`:
- **Quiz**: Base points by difficulty + speed bonus (up to 50% extra)
- **True/False**: Points per correct answer + accuracy bonuses
- **Countdown**: Points by word length + bonus for longest word
- **Leaderboards**: Includes placement-based scoring across multiple games

## Environment Configuration

Create `.env.local` in the project root with:

```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
HOST_URL=http://localhost:5174
HOST_PASSWORD=admin123
```

The server loads `.env.local` from the project root (three levels up from `packages/server/src/`).

## Key Implementation Details

### WebSocket Event Flow

**Player joining:**
1. Client emits `player:join` with name/reconnectToken
2. Server validates and creates/retrieves player
3. Server emits `player:joined` with player data
4. Server broadcasts `players:update` to all clients

**Game start:**
1. Host emits `host:start-[game]` event
2. Server transitions to `playing` phase
3. Server broadcasts game-specific state
4. Clients render appropriate game screen

**Game responses:**
1. Client emits game-specific event (e.g., `quiz:answer`)
2. Server validates and records response
3. Server updates player score
4. Server broadcasts result when appropriate

### File Locations

**Game content data:**
- Questions: `packages/server/src/data/questions.json`, `quizRounds.json`
- Statements: `packages/server/src/data/statements.json`
- Dictionary: Loaded from `an-array-of-english-words` npm package

**React screens:**
- Client: `packages/client/src/screens/`
- Host: `packages/host/src/screens/`

**Socket connection logic:**
- Client hook: `packages/client/src/hooks/useSocket.ts`
- Server setup: `packages/server/src/index.js`

### Color Scheme

The UI uses a Plandek-inspired color scheme defined in Tailwind configs:
- Primary navy: `#1a2332`
- Bright blue: `#0066FF`
- Teal (success): `#00D4AA`
- Purple (special): `#7B61FF`
- Difficulty colors: Teal (easy) → Blue (medium) → Orange (hard) → Red (impossible)

## Common Development Patterns

### Adding a New Game

1. Create game module in `packages/server/src/games/yourGame.js`
2. Export a class with methods: `start()`, `handlePlayerAction()`, `endGame()`
3. Register game in `packages/server/src/index.js`
4. Create client screen in `packages/client/src/screens/YourGame.tsx`
5. Add routing logic in `packages/client/src/App.tsx`
6. Add host control button in `packages/host/src/screens/Dashboard.tsx`

### Adding Socket Event Handlers

**Server side:**
```javascript
socket.on('event:name', (data) => {
  // Validate data with Joi
  // Process logic
  // Broadcast result
  io.emit('event:response', result);
});
```

**Client side:**
```javascript
// In useSocket hook
socket.on('event:response', (data) => {
  // Update Zustand store
  setGameState(data);
});
```

### Accessing Current Player State

**Client:**
```typescript
const { playerId, playerName, players } = useGameStore();
const currentPlayer = players.find(p => p.id === playerId);
```

**Server:**
```javascript
const player = gameState.players.get(playerId);
```

## Deployment Notes

The server is configured for deployment to Railway.app with configuration in `deploy/railway.toml`. The server serves as the central hub while client and host apps should be deployed to static hosting services (Vercel, Netlify, etc.).

Client and host apps need `VITE_SERVER_URL` environment variable set to the deployed server URL.

## Troubleshooting

**Connection issues:**
- Verify all three processes are running
- Check that ports 3000, 5173, and 5174 are available
- Inspect browser console for WebSocket connection errors
- Ensure `.env.local` URLs match your setup

**Game state not updating:**
- Check server logs for event reception
- Verify event names match between client and server
- Ensure Zustand store is being updated in useSocket hook

**Players not reconnecting:**
- Verify reconnect token is stored in localStorage (`phog_reconnect_token`)
- Check ConnectionManager logs for token validation
- Ensure player map persistence on server
