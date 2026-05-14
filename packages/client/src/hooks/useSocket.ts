import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'http://localhost:3000'
);

const TOKEN_KEY = 'phog_reconnect_token';
const NAME_KEY = 'phog_player_name';
const PLAYER_ID_KEY = 'phog_player_id';

const readStorage = (key: string): string | null => {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string | null) => {
  try {
    if (typeof window === 'undefined') return;
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    /* ignore quota / private-mode errors */
  }
};

/**
 * Emit player:join with everything we know. Server resolves identity in
 * priority order: valid token → fall through to fresh join (name required).
 * Safe to call repeatedly — server treats a successful token reconnect as
 * idempotent.
 */
const emitJoin = (socket: Socket, opts: { name?: string | null; token?: string | null }) => {
  const payload: { name?: string; reconnectToken?: string } = {};
  if (opts.name && opts.name.trim()) payload.name = opts.name.trim();
  if (opts.token) payload.reconnectToken = opts.token;
  if (!payload.name && !payload.reconnectToken) return; // nothing to send
  socket.emit('player:join', payload);
};

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const {
    setConnected,
    setConnectionError,
    setPlayer,
    setPhase,
    setCurrentGame,
    setPlayers,
    setPaused
  } = useGameStore();

  useEffect(() => {
    // Initialize socket connection
    const socket = io(SERVER_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket']
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setConnected(true);
      setConnectionError(null);
      socket.emit('request:state');

      // Auto-reconnect: replay the stored HMAC-signed reconnect token so the
      // server re-binds this new socket to the existing player record
      // (preserves score / placements / current-game state).
      const token = readStorage(TOKEN_KEY);
      if (token) {
        console.log('[Socket] Attempting auto-reconnect with token');
        emitJoin(socket, { token });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
      setConnectionError(`Disconnected: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setConnectionError(`Connection error: ${error.message}`);
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Player events
    socket.on('player:joined', ({ playerId, player, reconnectToken: token, isReconnect }) => {
      console.log('[Socket] Player joined:', playerId, isReconnect ? '(reconnected)' : '(new)');
      setPlayer(playerId, player.name, token);

      // Persist token + name + playerId so the next page load / next
      // reconnect can re-attach the same identity.
      if (token) writeStorage(TOKEN_KEY, token);
      if (player?.name) writeStorage(NAME_KEY, player.name);
      if (playerId) writeStorage(PLAYER_ID_KEY, playerId);
    });

    socket.on('player:kicked', ({ reason }) => {
      console.log('[Socket] Kicked:', reason);
      // Friendly copy for the duplicate-session case (server emits
      // reason: 'duplicate_session' when the same token shows up on two
      // sockets — newest wins).
      const message =
        reason === 'duplicate_session'
          ? 'You joined from another tab or device. This tab is now signed out.'
          : reason || 'You were disconnected.';
      setConnectionError(message);
      // Kicked = this identity is no longer ours. Drop the token + playerId
      // so the next load starts fresh; keep the name (lobby pre-fill).
      writeStorage(TOKEN_KEY, null);
      writeStorage(PLAYER_ID_KEY, null);
      socket.disconnect();
    });

    socket.on('players:update', (players) => {
      console.log('[Socket] Players updated:', players.length);
      setPlayers(players);
    });

    // Game state events
    socket.on('phase:change', ({ phase }) => {
      console.log('[Socket] Phase changed:', phase);
      setPhase(phase);
    });

    socket.on('game:start', ({ game }) => {
      console.log('[Socket] Game started:', game);
      setCurrentGame(game);
      setPhase('playing');
    });

    socket.on('game:end', ({ game }) => {
      console.log('[Socket] Game ended:', game);
    });

    socket.on('game:paused', () => {
      console.log('[Socket] Game paused');
      setPaused(true);
    });

    socket.on('game:resumed', () => {
      console.log('[Socket] Game resumed');
      setPaused(false);
    });

    socket.on('lobby:return', () => {
      console.log('[Socket] Returned to lobby');
      setPhase('lobby');
      setCurrentGame(null);
    });

    socket.on('session:end', () => {
      console.log('[Socket] Session ended');
      setPhase('finished');
    });

    socket.on('game:reset', () => {
      console.log('[Socket] Game reset');
      setPhase('lobby');
      setCurrentGame(null);
    });

    // Error handling
    socket.on('error', ({ message }) => {
      console.error('[Socket] Error:', message);
      setConnectionError(message);
    });

    // Cleanup on unmount
    return () => {
      console.log('[Socket] Cleaning up...');
      socket.off();
      socket.disconnect();
    };
  }, [setConnected, setConnectionError, setPlayer, setPhase, setCurrentGame, setPlayers, setPaused]);

  // Return socket for emitting events
  return socketRef.current;
};

export const joinGame = (socket: Socket | null, name: string) => {
  if (!socket) {
    console.error('[Socket] Cannot join: socket not initialized');
    return;
  }

  const trimmed = name.trim();
  if (trimmed) {
    // Persist name immediately so visibility-resync / reload paths can use
    // it even before the server replies with player:joined.
    writeStorage(NAME_KEY, trimmed);
  }

  const reconnectToken = readStorage(TOKEN_KEY);
  emitJoin(socket, { name: trimmed, token: reconnectToken });
};
