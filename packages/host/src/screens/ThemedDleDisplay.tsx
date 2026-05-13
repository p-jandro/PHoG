import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { ModeIntroSplash } from '../components/themed-dle/ModeIntroSplash';
import { ModeResultsReveal } from '../components/themed-dle/ModeResultsReveal';

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
    <div className="h-screen w-screen px-16 py-20">
      <ModeIntroSplash data={introData} />
    </div>
  );

  if (phase === 'results' && resultsData) return (
    <div className="h-screen w-screen px-16 py-20">
      <ModeResultsReveal data={resultsData} />
    </div>
  );

  if (phase !== 'playing' || !playData) {
    return <div className="flex h-screen w-screen items-center justify-center text-2xl">Loading…</div>;
  }

  const connected = players.filter((p) => p.connected);
  const themeName = theme === 'pokemon' ? 'Pokédle' : 'HP-dle';
  const maxGuesses: number = playData.maxGuesses ?? 6;
  const solvedCount = mode === 'grid'
    ? 0
    : connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="flex h-screen w-screen flex-col items-center px-10 py-10">
      <header className="w-full text-center">
        <p className="eyebrow text-xl">{themeName} · {MODE_LABELS[mode]}</p>
      </header>

      <div className="my-6 tabular-nums text-7xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</div>

      <div className="w-full max-w-5xl flex-1 overflow-y-auto">
        {mode !== 'grid' && (
          <p className="mb-3 text-center text-lg text-ui-textMuted">
            {solvedCount} of {connected.length} solved
          </p>
        )}
        {connected.length === 0 ? (
          <p className="text-center text-ui-textMuted">No players connected.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {connected.map((p) => {
              const s = progress[p.id];
              let isSolved = false;
              let isFailed = false;
              let statusLabel: string;
              if (mode === 'grid') {
                const filled = s?.filledCells ?? 0;
                statusLabel = `${filled}/9 filled`;
              } else {
                const guessCount = s?.guessCount ?? 0;
                isSolved = s?.solved ?? false;
                isFailed = !isSolved && guessCount >= maxGuesses;
                if (isSolved) statusLabel = `✓ solved in ${guessCount}`;
                else if (isFailed) statusLabel = '✗ out of guesses';
                else statusLabel = `${guessCount}/${maxGuesses} guesses`;
              }
              const tone = isSolved
                ? 'border-game-correct bg-game-correct/10 text-game-correct'
                : isFailed
                  ? 'border-game-incorrect bg-game-incorrect/10 text-game-incorrect'
                  : 'border-white/10 bg-black/30 text-white';
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-3xl border-2 px-5 py-4 ${tone}`}
                >
                  <p className="truncate text-2xl font-bold">{p.name}</p>
                  <p className="mt-1 text-sm">{statusLabel}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
