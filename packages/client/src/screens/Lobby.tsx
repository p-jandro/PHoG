import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { joinGame } from '../hooks/useSocket';
import { Avatar, Button, Card, Chip, Input, Pill, ThemeToggle } from '../ui';
import { screenEnter, popIn, stagger } from '../lib/motion';

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
      setTimeout(() => setIsJoining(false), 2000);
    }
  };

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

  const connectedPlayers = (players ?? []).filter((p) => p.connected);

  // ---------- Post-join (waiting room) ----------
  if (playerId && playerName) {
    return (
      <div className="min-h-screen bg-bg-base text-ink">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 sm:px-6">
          <header className="flex items-center justify-between">
            <Pill status={status}>{statusLabel}</Pill>
            <ThemeToggle />
          </header>

          <motion.div variants={screenEnter} initial="hidden" animate="visible">
            <Card eyebrow="Checked In">
              <div className="flex flex-col items-center gap-4 text-center">
                <Avatar name={playerName} size="lg" />
                <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                  You are in, {playerName}.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-ink-muted">
                  Keep this screen open. The host will move everyone from the lounge into each round automatically.
                </p>
                <div className="mt-2">
                  <Chip variant="now">Ready · waiting for the host</Chip>
                </div>
              </div>
            </Card>
          </motion.div>

          {connectedPlayers.length > 0 && (
            <Card
              eyebrow={`In the room · ${connectedPlayers.length} ${connectedPlayers.length === 1 ? 'player' : 'players'}`}
            >
              <motion.div
                className="flex flex-wrap gap-3"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: stagger.short } },
                }}
              >
                {connectedPlayers.map((p) => (
                  <motion.div
                    key={p.id}
                    variants={popIn}
                    className="flex flex-col items-center gap-1"
                  >
                    <Avatar name={p.name} size="md" />
                    <span className="max-w-[5rem] truncate text-xs font-bold text-ink-muted">
                      {p.id === playerId ? 'You' : p.name}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ---------- Pre-join (join form) — already migrated in Task 1 ----------
  return (
    <div className="min-h-screen bg-bg-base text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 sm:px-6">
        <header className="flex items-center justify-end">
          <ThemeToggle />
        </header>

        <motion.div variants={screenEnter} initial="hidden" animate="visible">
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
