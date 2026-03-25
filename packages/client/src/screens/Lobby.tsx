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
  const { connected, connectionError, playerId, playerName, players } = useGameStore();

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
    // Sort players by total placement (lower is better)
    const sortedPlayers = [...players].sort((a, b) => {
        if ((a.totalPlacementScore || 0) === 0 && (b.totalPlacementScore || 0) === 0) return 0;
        if ((a.totalPlacementScore || 0) === 0) return 1;
        if ((b.totalPlacementScore || 0) === 0) return -1;
        return (a.totalPlacementScore || 0) - (b.totalPlacementScore || 0);
    });

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card max-w-2xl w-full"
        >
          <h1 className="text-4xl font-bold text-center mb-2 text-white">
            Welcome, {playerName}!
          </h1>
          <p className="text-ui-textMuted text-center mb-8">
            Waiting for the host to start the game...
          </p>

          {/* Tournament Standings */}
          <div className="space-y-2">
            <div className="flex justify-between items-end mb-4">
                <h2 className="text-xl font-bold">Tournament Standings</h2>
                <span className="text-sm text-ui-textMuted">Lower score is better!</span>
            </div>
            
            <div className="grid gap-2 max-h-96 overflow-y-auto">
              {sortedPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-3 rounded-lg border ${
                    player.connected
                      ? 'bg-ui-card border-ui-border'
                      : 'bg-ui-background border-ui-border opacity-50'
                  } ${player.id === playerId ? 'border-primary-teal bg-primary-teal/10' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-bold text-ui-textMuted w-6">
                        {(player.totalPlacementScore || 0) > 0 ? `#${index + 1}` : '-'}
                      </div>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          player.connected ? 'bg-game-correct' : 'bg-ui-textMuted'
                        }`}
                      />
                      <span className={`font-medium ${player.id === playerId ? 'text-primary-teal' : ''}`}>
                        {player.name} {player.id === playerId && '(You)'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="font-bold text-lg">{player.totalPlacementScore || 0} pts</span>
                        {/* Optional: Show breakdown of last game if available, or just total */}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Pulsing indicator */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-8 text-center text-ui-textMuted"
          >
            Waiting for host...
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Join screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="card max-w-md w-full"
      >
        {/* Title */}
        <h1 className="text-5xl font-bold text-center mb-2 text-white">
          PHoG
        </h1>
        <p className="text-xl text-center text-ui-textMuted mb-8">
          Peter's House of Games
        </p>

        {/* Connection status */}
        <div className="mb-6 p-3 rounded-lg bg-ui-background border border-ui-border">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-game-correct' : 'bg-game-incorrect'
              }`}
            />
            <span className="text-sm">
              {connected ? 'Connected to server' : 'Connecting...'}
            </span>
          </div>
          {connectionError && (
            <p className="text-game-incorrect text-sm mt-2">{connectionError}</p>
          )}
        </div>

        {/* Join form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Your Name
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
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
        </form>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-ui-textMuted">
          <p>Get ready for three exciting games!</p>
          <p className="mt-2">
            <span className="text-primary-blue">Quiz</span> •{' '}
            <span className="text-primary-teal">True/False</span> •{' '}
            <span className="text-primary-purple">Countdown</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

