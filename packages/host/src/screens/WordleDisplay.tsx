import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostBoard } from '../components/wordle/HostBoard';

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
    return <div className="flex h-screen w-screen items-center justify-center text-2xl">Loading…</div>;
  }

  const connected = players.filter((p) => p.connected);
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="flex h-screen w-screen flex-col px-12 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <p className="eyebrow text-xl">Wordle · everyone gets the same word</p>
        <div className="flex items-baseline gap-6">
          <p className="text-2xl text-ui-textMuted">{solvedCount} / {connected.length} solved</p>
          <p className="tabular-nums text-4xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-2 gap-6 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {connected.map((p) => {
          const s = progress[p.id];
          const rows: ('green'|'yellow'|'grey')[][] = s?.colorRows || [];
          return (
            <div key={p.id} className={`rounded-3xl border-2 p-4 ${s?.solved ? 'border-game-correct bg-game-correct/10' : 'border-white/10 bg-black/30'}`}>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="truncate text-xl font-bold">{p.name}</p>
                <p className="text-xs text-ui-textMuted">{s?.guessesUsed ?? 0}/6{s?.solved && ' ✓'}</p>
              </div>
              <HostBoard rows={rows} maxGuesses={6} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
