import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { ModeIntroSplash } from '../components/themed-dle/ModeIntroSplash';
import { ModeResultsReveal } from '../components/themed-dle/ModeResultsReveal';
import { Card, Chip, Countdown } from '../ui';

interface Player { id: string; name: string; connected: boolean; }

interface ThemedDleDisplayProps {
  socket: Socket | null;
  currentGame: 'pokedle' | 'hpdle';
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';
type Mode = 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';

const MODE_LABELS: Record<Mode, string> = {
  classic: 'Classic',
  emoji: 'Emoji',
  silhouette: 'Silhouette',
  spell: 'Spell',
  grid: '3×3 Grid'
};

export const ThemedDleDisplay = ({ socket, currentGame, players }: ThemedDleDisplayProps) => {
  const theme: 'pokemon' | 'hp' = currentGame === 'pokedle' ? 'pokemon' : 'hp';
  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('classic');
  const [introData, setIntroData] = useState<any>(null);
  const [playData, setPlayData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const prefix = currentGame;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setMode(d.mode); setProgress({}); };
    const onPlay  = (d: any) => { setPhase('playing'); setPlayData(d); setMode(d.mode); };
    const onProg  = (d: any) => { setProgress(d.playerProgress || {}); };
    const onRes   = (d: any) => { setPhase('results'); setResultsData(d); };

    socket.on(`${prefix}:intro`, onIntro);
    socket.on(`${prefix}:playing:start`, onPlay);
    socket.on(`${prefix}:progress`, onProg);
    socket.on(`${prefix}:mode:results`, onRes);

    return () => {
      socket.off(`${prefix}:intro`, onIntro);
      socket.off(`${prefix}:playing:start`, onPlay);
      socket.off(`${prefix}:progress`, onProg);
      socket.off(`${prefix}:mode:results`, onRes);
    };
  }, [socket, currentGame]);

  useEffect(() => {
    if (phase !== 'playing' || !playData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, playData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, playData]);

  if (phase === 'intro' && introData) return (
    <div className="h-screen w-screen bg-bg-base px-16 py-20">
      <ModeIntroSplash data={introData} />
    </div>
  );

  if (phase === 'results' && resultsData) return (
    <div className="h-screen w-screen bg-bg-base px-16 py-20">
      <ModeResultsReveal data={resultsData} />
    </div>
  );

  if (phase !== 'playing' || !playData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-2xl text-ink">
        <Card><p>Loading…</p></Card>
      </div>
    );
  }

  const connected = players.filter((p) => p.connected);
  const themeName = theme === 'pokemon' ? 'Pokédle' : 'HP-dle';
  const maxGuesses: number = playData.maxGuesses ?? 6;
  const solvedCount = mode === 'grid'
    ? 0
    : connected.filter((p) => progress[p.id]?.solved).length;

  const totalDurationMs: number = playData.duration ?? 0;
  const timerSeconds = Math.ceil(timerMs / 1000);
  const totalSeconds = Math.ceil(totalDurationMs / 1000);

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
            {themeName} · Mode {playData.modeIndex !== undefined ? playData.modeIndex + 1 : '—'} of {playData.totalModes ?? '—'}
          </p>
          <h1 className="font-serif text-5xl font-bold text-ink">{MODE_LABELS[mode]}</h1>
        </div>
        <Countdown seconds={timerSeconds} total={totalSeconds > 0 ? totalSeconds : 1} size={140} />
      </header>

      <div className="my-6 flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-3xl rounded-3xl border-2 border-ink bg-premium px-10 py-8 text-center shadow-ink-lg">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-on-premium/80">Now playing</p>
          <h2 className="mt-2 font-serif text-6xl font-bold text-on-premium">{MODE_LABELS[mode]}</h2>
          {playData.maxGuesses && mode !== 'grid' && (
            <p className="mt-3 text-xl text-on-premium/85">
              {playData.maxGuesses} guesses each
            </p>
          )}
          {mode === 'grid' && (
            <p className="mt-3 text-xl text-on-premium/85">Fill all 9 cells before time runs out</p>
          )}
        </div>
      </div>

      <footer className="w-full">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Players</p>
          {mode !== 'grid' ? (
            <Chip variant="info">{solvedCount} of {connected.length} solved</Chip>
          ) : (
            <Chip variant="info">{connected.length} player{connected.length === 1 ? '' : 's'} placing</Chip>
          )}
        </div>

        {connected.length === 0 ? (
          <Card><p className="text-center text-ink-muted">No players connected.</p></Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {connected.map((p) => {
              const s = progress[p.id];
              let isSolved = false;
              let isFailed = false;
              let statusLabel: string;
              if (mode === 'grid') {
                const filled = s?.filledCells ?? 0;
                statusLabel = `${filled} of 9 cells placed`;
              } else {
                const guessCount = s?.guessCount ?? 0;
                isSolved = s?.solved ?? false;
                isFailed = !isSolved && guessCount >= maxGuesses;
                if (isSolved) statusLabel = `Solved in ${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`;
                else if (isFailed) statusLabel = 'Out of guesses';
                else statusLabel = `${guessCount} of ${maxGuesses} guesses, in progress`;
              }
              const tone = isSolved
                ? 'border-ink bg-action text-on-action'
                : isFailed
                  ? 'border-ink bg-danger text-on-danger'
                  : 'border-ink bg-bg-surface text-ink';
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border-2 px-5 py-4 shadow-ink-sm ${tone}`}
                >
                  <p className="truncate text-2xl font-extrabold">{p.name}</p>
                  <p className="mt-1 text-sm font-semibold">{statusLabel}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </footer>
    </div>
  );
};
