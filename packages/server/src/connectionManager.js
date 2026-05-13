/**
 * ConnectionManager - Handles WebSocket connections for 30+ concurrent players
 * Features: Rate limiting, reconnection tokens, heartbeat monitoring
 */

import { randomUUID } from 'crypto';

export class ConnectionManager {
  constructor() {
    this.connections = new Map(); // socketId -> playerId
    this.playerSockets = new Map(); // playerId -> socketId
    this.reconnectTokens = new Map(); // token -> playerId
    this.rateLimiter = new Map(); // socketId -> timestamp
    this.heartbeatIntervals = new Map(); // socketId -> interval
  }

  /**
   * Handle new socket connection
   * @param {Socket} socket - Socket.io socket instance
   * @returns {boolean} - Success status
   */
  handleConnection(socket) {
    // Rate limiting disabled by user request
    /*
    const lastAction = this.rateLimiter.get(socket.id) || 0;
    if (Date.now() - lastAction < 50) {
      console.log(`[RATE_LIMIT] Socket ${socket.id} throttled`);
      return false;
    }
    this.rateLimiter.set(socket.id, Date.now());
    */

    console.log(`[CONNECT] Socket ${socket.id} connected`);

    // Setup heartbeat for connection health
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
      }, 45000); // Increased to 45 second timeout for stability
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
   * Register a player to a socket
   * @param {string} socketId - Socket ID
   * @param {string} playerId - Player ID
   */
  registerPlayer(socketId, playerId) {
    // Remove any existing connection for this player
    const existingSocketId = this.playerSockets.get(playerId);
    if (existingSocketId) {
      this.connections.delete(existingSocketId);
    }

    this.connections.set(socketId, playerId);
    this.playerSockets.set(playerId, socketId);

    console.log(`[REGISTER] Player ${playerId} registered to socket ${socketId}`);
  }

  /**
   * Generate a reconnection token for a player
   * @param {string} playerId - Player ID
   * @returns {string} - Reconnection token
   */
  generateReconnectToken(playerId) {
    const token = randomUUID();
    this.reconnectTokens.set(token, playerId);

    // Token expires in 5 minutes
    setTimeout(() => {
      this.reconnectTokens.delete(token);
    }, 5 * 60 * 1000);

    console.log(`[TOKEN] Generated reconnect token for player ${playerId}`);
    return token;
  }

  /**
   * Reconnect a player using a token
   * @param {string} socketId - New socket ID
   * @param {string} token - Reconnection token
   * @returns {string|null} - Player ID if successful, null otherwise
   */
  reconnectPlayer(socketId, token) {
    const playerId = this.reconnectTokens.get(token);
    if (!playerId) {
      console.log(`[RECONNECT] Invalid token: ${token}`);
      return null;
    }

    this.registerPlayer(socketId, playerId);
    this.reconnectTokens.delete(token);

    console.log(`[RECONNECT] Player ${playerId} reconnected with socket ${socketId}`);
    return playerId;
  }

  /**
   * Handle socket disconnection
   * @param {string} socketId - Socket ID
   * @returns {string|null} - Player ID if found, null otherwise
   */
  handleDisconnection(socketId, socket) {
    // Clear heartbeat interval, timeout, and pong listener
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
    // Don't remove from playerSockets - allow reconnection

    console.log(`[DISCONNECT] Player ${playerId} disconnected (socket ${socketId})`);
    return playerId;
  }

  /**
   * Get player ID for a socket
   * @param {string} socketId - Socket ID
   * @returns {string|undefined} - Player ID
   */
  getPlayerId(socketId) {
    return this.connections.get(socketId);
  }

  /**
   * Get socket ID for a player
   * @param {string} playerId - Player ID
   * @returns {string|undefined} - Socket ID
   */
  getSocketId(playerId) {
    return this.playerSockets.get(playerId);
  }

  /**
   * Check if a player is connected
   * @param {string} playerId - Player ID
   * @returns {boolean}
   */
  isPlayerConnected(playerId) {
    const socketId = this.playerSockets.get(playerId);
    return socketId && this.connections.has(socketId);
  }

  /**
   * Get all connected players
   * @returns {string[]} - Array of player IDs
   */
  getConnectedPlayers() {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection stats
   * @returns {Object} - Connection statistics
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      registeredPlayers: this.playerSockets.size,
      activeTokens: this.reconnectTokens.size
    };
  }
}

