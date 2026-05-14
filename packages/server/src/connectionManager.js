/**
 * ConnectionManager - Handles WebSocket connections for 30+ concurrent players
 *
 * Features:
 *   - HMAC-signed durable reconnect tokens (see utils/sessionTokens.js).
 *     Tokens survive process restarts, are not single-use, and expire by
 *     signed timestamp (24h) rather than setTimeout.
 *   - Heartbeat monitoring (ping/pong, 45s timeout).
 *   - Duplicate-session detection: registerPlayer returns the previously
 *     mapped socketId so the caller can kick the old session.
 */

import { signToken, verifyToken } from './utils/sessionTokens.js';

export class ConnectionManager {
  constructor() {
    this.connections = new Map();         // socketId -> playerId
    this.playerSockets = new Map();       // playerId -> socketId
    this.heartbeatIntervals = new Map();  // socketId -> { pingInterval, pingTimeout, pongHandler }
  }

  /**
   * Handle new socket connection
   * @param {Socket} socket - Socket.io socket instance
   * @returns {boolean} - Success status
   */
  handleConnection(socket) {
    console.log(`[CONNECT] Socket ${socket.id} connected`);
    this.setupHeartbeat(socket);
    return true;
  }

  /**
   * Setup heartbeat monitoring for a socket
   * @param {Socket} socket - Socket.io socket instance
   */
  setupHeartbeat(socket) {
    let pingTimeout;

    const resetPingTimeout = () => {
      clearTimeout(pingTimeout);
      pingTimeout = setTimeout(() => {
        console.log(`[HEARTBEAT] Socket ${socket.id} timed out`);
        socket.disconnect();
      }, 45000); // 45 second timeout for stability
    };

    // Initial ping timeout
    resetPingTimeout();

    // Listen for pong responses
    const pongHandler = () => {
      resetPingTimeout();
    };
    socket.on('pong', pongHandler);

    // Send ping every 10 seconds
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      } else {
        clearInterval(pingInterval);
        clearTimeout(pingTimeout);
      }
    }, 10000);

    this.heartbeatIntervals.set(socket.id, { pingInterval, pingTimeout, pongHandler });
  }

  /**
   * Register a player to a socket.
   *
   * If the same playerId is already mapped to a different live socket (i.e.
   * another tab/device is holding this identity), this returns the displaced
   * socketId so the caller can emit a kick + disconnect on it. The caller
   * has the `io` reference; this class deliberately doesn't.
   *
   * @param {string} socketId - Socket ID
   * @param {string} playerId - Player ID
   * @returns {string|null} - Previously-mapped socketId if a duplicate
   *   session was displaced, else null.
   */
  registerPlayer(socketId, playerId) {
    let displacedSocketId = null;
    const existingSocketId = this.playerSockets.get(playerId);
    if (existingSocketId && existingSocketId !== socketId) {
      this.connections.delete(existingSocketId);
      displacedSocketId = existingSocketId;
    }

    this.connections.set(socketId, playerId);
    this.playerSockets.set(playerId, socketId);

    console.log(
      `[REGISTER] Player ${playerId} registered to socket ${socketId}` +
      (displacedSocketId ? ` (displaced ${displacedSocketId})` : '')
    );
    return displacedSocketId;
  }

  /**
   * Issue a reconnect token for a player. Tokens are HMAC-signed and
   * stateless — see utils/sessionTokens.js.
   * @param {string} playerId
   * @returns {string} token
   */
  generateReconnectToken(playerId) {
    const token = signToken(playerId);
    console.log(`[TOKEN] Issued reconnect token for player ${playerId}`);
    return token;
  }

  /**
   * Verify a reconnect token and re-attach the player record to a new socket.
   * Tokens are NOT consumed on use — the same token stays valid until it
   * expires.
   *
   * @param {string} socketId - The new socket ID
   * @param {string} token - The token presented by the client
   * @returns {{ playerId: string|null, displacedSocketId: string|null }}
   *   playerId is null when the token is invalid/expired. displacedSocketId
   *   non-null means a different live socket was holding this identity and
   *   the caller should kick it.
   */
  reconnectPlayer(socketId, token) {
    const claims = verifyToken(token);
    if (!claims) {
      console.log(`[RECONNECT] Invalid or expired token`);
      return { playerId: null, displacedSocketId: null };
    }

    const displacedSocketId = this.registerPlayer(socketId, claims.playerId);
    console.log(`[RECONNECT_TOKEN] Player ${claims.playerId} reconnected with socket ${socketId}`);
    return { playerId: claims.playerId, displacedSocketId };
  }

  /**
   * Handle socket disconnection. The player record itself is kept alive
   * (in `gameState.players`) so a reconnect can re-attach it; we just drop
   * the socket↔player mapping here.
   *
   * @param {string} socketId - Socket ID
   * @param {Socket} [socket] - The socket instance, used to detach the pong listener
   * @returns {string|null} - Player ID if found, null otherwise
   */
  handleDisconnection(socketId, socket) {
    const heartbeat = this.heartbeatIntervals.get(socketId);
    if (heartbeat) {
      clearInterval(heartbeat.pingInterval);
      clearTimeout(heartbeat.pingTimeout);
      if (socket && heartbeat.pongHandler) {
        socket.off('pong', heartbeat.pongHandler);
      }
      this.heartbeatIntervals.delete(socketId);
    }

    const playerId = this.connections.get(socketId);
    if (!playerId) {
      console.log(`[DISCONNECT] Socket ${socketId} disconnected (no player)`);
      return null;
    }

    this.connections.delete(socketId);

    // Only clear playerSockets if THIS socket was the one holding the
    // mapping. If a newer socket already displaced this one (duplicate
    // session), don't yank the active mapping out from under it.
    if (this.playerSockets.get(playerId) === socketId) {
      // Keep the mapping so a token reconnect can find the prior socket
      // slot; the next registerPlayer call will overwrite it. We do NOT
      // delete here to match the prior behaviour ("Don't remove from
      // playerSockets - allow reconnection").
    }

    console.log(`[DISCONNECT] Player ${playerId} disconnected (socket ${socketId})`);
    return playerId;
  }

  /** @returns {string|undefined} */
  getPlayerId(socketId) {
    return this.connections.get(socketId);
  }

  /** @returns {string|undefined} */
  getSocketId(playerId) {
    return this.playerSockets.get(playerId);
  }

  /** @returns {boolean} */
  isPlayerConnected(playerId) {
    const socketId = this.playerSockets.get(playerId);
    return Boolean(socketId) && this.connections.has(socketId);
  }

  /** @returns {string[]} */
  getConnectedPlayers() {
    return Array.from(this.connections.values());
  }

  /** Connection stats for /health. */
  getStats() {
    return {
      activeConnections: this.connections.size,
      registeredPlayers: this.playerSockets.size
      // No activeTokens count: tokens are stateless (HMAC-signed) and
      // not tracked server-side.
    };
  }
}
