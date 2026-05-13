import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { joinGame } from '../hooks/useSocket';
import { Button, Input, Card, Pill, ThemeToggle } from '../ui';
import { screenEnter } from '../lib/motion';

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
      setTimeout(() => setIsJoining(false), 2000);
    }
  };

  // Post-join branch — still uses legacy classes; migrated in Task 2.
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

  // Pre-join branch — new design.
  const status: 'connected' | 'connecting' | 'offline' = connected
    ? 'connected'
    : connectionError
      ? 'offline'
      : 'connecting';
  const statusLabel = connected
    ? 'Connected to game server'
    : connectionError
      ? 'Offline'
      : 'Connecting to game server';

  return (
    <div className="min-h-screen bg-bg-base text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 sm:px-6">
        <header className="flex items-center justify-end">
          <ThemeToggle />
        </header>

        <motion.div
          variants={screenEnter}
          initial="hidden"
          animate="visible"
        >
          <Card eyebrow="Player Entry" title="Join the Room">
            <div className="mt-2 mb-5 flex flex-wrap items-center gap-2">
              <Pill status={status}>{statusLabel}</Pill>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-5">
              <Input
                label="Display Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                required
                disabled={!connected || isJoining}
                error={connectionError ?? undefined}
              />
              <Button
                type="submit"
                variant="action"
                size="lg"
                disabled={!connected || !name.trim() || isJoining}
                loading={isJoining}
                className="w-full"
              >
                {isJoining ? 'Joining Room' : 'Join Game'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
