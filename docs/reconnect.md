# Reconnect contract

How the server handles a player disconnecting and reconnecting mid-session.
Authoritative as of the 2026-05-14 resilience pass.

---

## 1. Identity persistence

Every player record carries a stable `playerId` (UUID v4) generated on first
`player:join`. Identity outlives the socket — the record lives in
`gameState.players` and is not removed on disconnect.

**Reconnect path** (`packages/server/src/index.js` → `player:join`):

1. **Token-based** (HMAC-signed, durable):
   - On every successful `player:join`, the server emits a fresh
     `reconnectToken` back to the client in the `player:joined` payload.
   - Tokens are HMAC-SHA256 signed with `SESSION_SECRET` (see
     `packages/server/src/utils/sessionTokens.js`). Format:
     `base64url(playerId.issuedAt) + "." + base64url(hmac)`.
   - **Stateless**: no server-side map. Tokens survive process restarts and
     are not single-use.
   - TTL: 24 hours, enforced by the signed `issuedAt` claim.
   - Client persists to `localStorage['phog_reconnect_token']` and replays it
     on the next `connect` event (and on hard reload).
   - On hit, the server re-binds the new socket to the existing `playerId`,
     preserving score, placements, currentGameScore, and per-game state.

2. **Fresh-join fallback**:
   - If no token is presented, OR the token is invalid/expired, OR the
     token's `playerId` no longer exists in `gameState.players` (e.g. server
     was restarted since), the client falls through to a fresh join. `name`
     is required in this path.

---

## 2. Duplicate sessions

`ConnectionManager.registerPlayer(socketId, playerId)` returns the previously
mapped socketId when the same identity is held by another live socket.
`index.js`'s `kickDuplicate` helper emits
`player:kicked { reason: 'duplicate_session' }` to the old socket and
disconnects it. The client renders a friendly "you joined from another tab"
message and drops its stored token (the new tab keeps it).

This applies to both fresh joins (rare — a UUID collision) and token-based
reconnects (the common case: two devices share the same persisted token).

---

## 3. Heartbeat

`ConnectionManager.setupHeartbeat`:
- Pings every 10 seconds.
- Disconnects the socket if no pong arrives within **45 seconds**.

The heartbeat owns its own cleanup: on disconnect we clear the ping interval,
the pending timeout, and detach the pong listener from the socket. See
`handleDisconnection`.

---

## 4. Disconnection bookkeeping

On socket disconnect:
- `connectionManager.handleDisconnection(socketId, socket)` drops the
  `connections` mapping and tears down heartbeat resources.
- The player record (`gameState.players`) is **not** removed — they may
  reconnect via token within the 24h TTL.
- `player.connected = false` is set in the `socket.on('disconnect')` handler
  in `index.js`, and a `players:update` broadcast goes out.

If the disconnected socket was the host (`gameState.meta.hostSocketId`), the
host slot is cleared. A new host can rejoin with the password.

---

## 5. Mid-game state replay

When a reconnected socket emits `request:state`, the server replays the
events that would have been live-emitted. See the `request:state` handler in
`index.js`:

- Phase events: `players:update`, `phase:change`, optional `game:start`.
- Per-game resync: each active game module exposes a `getResyncEvents({
  socketId, playerId, isHost })` method that returns an array of
  `{ name, payload }` events. The server emits each to the requesting
  socket. Pointless / quiz / true-false have inline handling for their
  intro/playing/reveal phases (see the request:state handler for the
  full table).

The reconnected client never sees a "you reconnected" code path — it just
receives the same events it would have seen live.

---

## 6. Operations / diagnostics (2026-05-14)

Two ops modules sit alongside the connection layer:

- `packages/server/src/ops/ringBuffer.js` — a fixed-capacity ring buffer
  primitive (`RingBuffer`) plus a per-player variant (`PlayerRingBuffer`).
  Neither is persisted; they exist to make live incidents debuggable.

- `packages/server/src/ops/errorReporter.js` — installs process-level
  `uncaughtException` / `unhandledRejection` handlers, captures into a
  50-entry ring buffer, and optionally forwards to Sentry if `SENTRY_DSN`
  is set AND `@sentry/node` is installed (no hard dependency).

  Wired at the top of `index.js` via `errorReporter.install()`. Exposed via:
  - `GET /health` → includes `errors: { size, capacity }`.
  - `GET /debug/errors` → full snapshot of recent error entries.
  - SIGTERM handler dumps the ring buffer to stdout before shutting down.

---

## 7. Edge cases

- **Laptop closed, returns 60 s later**: socket times out (45s heartbeat),
  client auto-reconnect kicks in (Socket.IO `reconnection: true`), token is
  replayed on the new socket, player rejoins seamlessly.
- **Token expired / unknown**: server returns a fresh join code path; the
  client needs to provide a name. With localStorage's `phog_player_name`
  still set, the lobby can pre-fill it; explicit re-join is a one-click step.
- **Two browsers with the same token**: latest socket wins. Server emits
  `player:kicked { reason: 'duplicate_session' }` to the older socket and
  disconnects it, preventing the duplicate-player ghost-state bug.
- **Server restart mid-game**: token verifies (it's stateless), but
  `gameState.players` is empty — server falls through to fresh-join path
  so the client must re-supply a name. This is intentional: in-memory game
  state has no persistence, so re-joining as a fresh record is the right
  answer.
