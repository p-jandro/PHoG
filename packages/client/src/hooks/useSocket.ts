import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'http://localhost:3000'
);

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

      // Auto-reconnect if token exists
      const token = localStorage.getItem('phog_reconnect_token');
      if (token) {
        console.log('[Socket] Attempting auto-reconnect with token');
        socket.emit('player:join', { reconnectToken: token });
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

      // Store reconnect token in localStorage
      if (token) {
        localStorage.setItem('phog_reconnect_token', token);
      }
    });

    socket.on('player:kicked', ({ reason }) => {
      console.log('[Socket] Kicked:', reason);
      setConnectionError(reason);
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

  const reconnectToken = localStorage.getItem('phog_reconnect_token');

  socket.emit('player:join', { name, reconnectToken });
};
