import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostChainCard } from '../components/travel/HostChainCard';

interface Player { id: string; name: string; connected: boolean; }

interface TravelDisplayProps {
  socket: Socket | null;
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';

export const TravelDisplay = ({ socket, players }: TravelDisplayProps) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setProgress({}); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); setProgress({}); };
    const onProgress = (d: any) => setProgress(d.playerProgress || {});
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };
    socket.on('travel:intro', onIntro);
    socket.on('travel:round:start', onStart);
    socket.on('travel:progress', onProgress);
    socket.on('travel:round:results', onResults);
    return () => {
      socket.off('travel:intro', onIntro);
      socket.off('travel:round:start', onStart);
      socket.off('travel:progress', onProgress);
      socket.off('travel:round:results', onResults);
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
          <p className="eyebrow text-2xl">Travel</p>
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
        <p className="eyebrow text-2xl">Travel — Reveal</p>
        <div>
          <p className="text-3xl text-ui-textMuted">A shortest path:</p>
          <p className="mt-2 max-w-5xl break-words text-4xl font-bold text-game-leader">{(resultsData.optimalChain || []).join(' → ')}</p>
          <p className="mt-2 text-xl text-ui-textMuted">{resultsData.optimalDistance} hops</p>
        </div>
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="eyebrow mb-3">Top scorers</p>
          <ul className="space-y-2 text-2xl">
            {top.map((r: any, i: number) => (
              <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                <span className="font-bold">#{i + 1} · {r.playerName} {r.firstSolver && '⭐'}</span>
                <span className="text-game-leader">{r.score} pts{r.solved ? '' : ' (didn\'t solve)'}</span>
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
  const maxGuesses = roundData.maxGuesses;

  return (
    <div className="flex h-screen w-screen flex-col px-12 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <p className="eyebrow text-xl">Travel</p>
          <p className="mt-1 text-4xl font-bold">{roundData.start} <span className="text-ui-textMuted">→</span> {roundData.end}</p>
          <p className="text-sm text-ui-textMuted">optimal {roundData.optimalDistance} hops · budget {maxGuesses}</p>
        </div>
        <p className="tabular-nums text-4xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
      </header>
      <div className="grid flex-1 grid-cols-2 gap-6 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
        {connected.map((p) => {
          const s = progress[p.id];
          return (
            <HostChainCard
              key={p.id}
              playerName={p.name}
              frontHead={s?.frontHead ?? roundData.start}
              backHead={s?.backHead ?? roundData.end}
              chainTotal={s?.chainTotal ?? 2}
              colors={s?.colors ?? []}
              solved={s?.solved ?? false}
              maxGuesses={maxGuesses}
            />
          );
        })}
      </div>
    </div>
  );
};
