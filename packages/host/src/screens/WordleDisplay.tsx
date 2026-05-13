import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { Chip } from '../ui/Chip';
import { Tile } from '../ui/Tile';

interface Player { id: string; name: string; connected: boolean; }

interface WordleDisplayProps {
  socket: Socket | null;
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';

export const WordleDisplay = ({ socket, players }: WordleDisplayProps) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setProgress({}); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); };
    const onProgress = (d: any) => setProgress(d.playerProgress || {});
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };
    socket.on('wordle:intro', onIntro);
    socket.on('wordle:round:start', onStart);
    socket.on('wordle:progress', onProgress);
    socket.on('wordle:round:results', onResults);
    return () => {
      socket.off('wordle:intro', onIntro);
      socket.off('wordle:round:start', onStart);
      socket.off('wordle:progress', onProgress);
      socket.off('wordle:round:results', onResults);
    };
  }, [socket]);

  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  if (phase === 'intro' && introData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center px-16 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-6">
          <p className="eyebrow text-2xl">Wordle</p>
          <h1 className="text-8xl font-bold text-game-leader">{introData.title}</h1>
          <p className="text-3xl text-white">{introData.description}</p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.score - a.score);
    const top = sorted.slice(0, 5);
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 px-16 py-12 text-center">
        <p className="eyebrow text-2xl">Wordle — Reveal</p>
        <p className="text-3xl text-ui-textMuted">The word was</p>
        <p className="text-9xl font-bold uppercase tracking-widest text-game-leader">{resultsData.answer}</p>
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="eyebrow mb-3">Top scorers</p>
          <ul className="space-y-2 text-2xl">
            {top.map((r: any, i: number) => (
              <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                <span className="font-bold">#{i + 1} · {r.playerName} {r.firstSolver && '⭐'}</span>
                <span className="text-game-leader">{r.score} pts{r.solved ? ` (${r.guessesUsed} guesses)` : ' (didn\'t solve)'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (phase !== 'playing' || !roundData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-ink">
        <p className="font-display text-3xl font-extrabold">Loading…</p>
      </div>
    );
  }

  const connected = players.filter((p) => p.connected);
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
      {/* Top row: location top-left, time-left top-right */}
      <header className="flex items-start justify-between">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          Wordle — round in progress
        </div>
        <div className="text-right">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            Time left
          </p>
          <p className="font-display text-5xl font-extrabold tabular-nums">
            {Math.ceil(timerMs / 1000)}s
          </p>
        </div>
      </header>

      {/* Centre: play-phase banner (server keeps the answer secret until results) */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Chip variant="info">Find the 5-letter word</Chip>
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Tile key={i} state="idle" className="aspect-square w-24 text-5xl">
              {''}
            </Tile>
          ))}
        </div>
        <p className="text-lg text-ink-muted">
          {solvedCount} of {connected.length} solved
        </p>
      </section>

      {/* Bottom: player tracker */}
      <footer className="w-full">
        {connected.length === 0 ? (
          <p className="text-center text-ink-muted">No players connected.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {connected.map((p) => {
              const s = progress[p.id];
              const guessesUsed = s?.guessesUsed ?? 0;
              const isSolved = s?.solved ?? false;
              const isFailed = !isSolved && guessesUsed >= 6;
              let statusLabel = `${guessesUsed} of 6 guesses`;
              if (isSolved) statusLabel = `Solved in ${guessesUsed}`;
              else if (isFailed) statusLabel = 'Did not solve';
              const tone = isSolved
                ? 'border-action bg-action text-on-action'
                : isFailed
                  ? 'border-danger bg-danger text-on-danger'
                  : 'border-ink bg-bg-surface text-ink';
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border-2 px-4 py-3 shadow-ink-sm ${tone}`}
                >
                  <p className="truncate font-display text-xl font-extrabold">{p.name}</p>
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
