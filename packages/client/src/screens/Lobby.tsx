import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { joinGame } from '../hooks/useSocket';
import { Socket } from 'socket.io-client';

interface LobbyProps {
  socket: Socket | null;
}

export const Lobby = ({ socket }: LobbyProps) => {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { connected, connectionError, playerId, playerName } = useGameStore();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && socket && connected) {
      setIsJoining(true);
      joinGame(socket, name.trim());
      
      // Reset after a delay
      setTimeout(() => setIsJoining(false), 2000);
    }
  };

  // If player has joined, show waiting room
  if (playerId && playerName) {
    return (
      <div className="screen-shell flex items-center">
        <div className="screen-frame max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card flex flex-col justify-between gap-8 p-8 text-center sm:p-10"
          >
            <div className="space-y-5">
              <span className="eyebrow">Checked In</span>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold sm:text-5xl">
                  You are in, {playerName}.
                </h1>
                <p className="mx-auto max-w-xl text-lg leading-relaxed text-ui-textMuted">
                  Keep this screen open. The host will move everyone from the lounge into each round automatically.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5">
              <p className="text-lg font-semibold text-game-correct">Ready</p>
              <p className="mt-2 text-sm text-ui-textMuted">Waiting for the host.</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-shell flex items-center">
      <div className="screen-frame max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-7 sm:p-8"
        >
          <div className="mb-6">
            <span className="eyebrow">Player Entry</span>
            <h2 className="mt-2 text-3xl font-bold">Join the Room</h2>
          </div>

          <div className="mb-6 rounded-[1.35rem] border border-ui-border/80 bg-black/20 p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? 'bg-game-correct' : 'bg-game-incorrect'
                }`}
              />
              <span className="font-medium">
                {connected ? 'Connected to game server' : 'Connecting to game server'}
              </span>
            </div>
            {connectionError && (
              <p className="mt-3 text-sm text-game-incorrect">{connectionError}</p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="name" className="section-label mb-2 block">
                Display Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="input-field"
                maxLength={30}
                required
                disabled={!connected || isJoining}
              />
            </div>

            <button
              type="submit"
              disabled={!connected || !name.trim() || isJoining}
              className="btn-primary w-full"
            >
              {isJoining ? 'Joining Room...' : 'Join Game'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};
