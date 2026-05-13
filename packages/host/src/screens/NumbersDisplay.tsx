import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostTilePool } from '../components/numbers/HostTilePool';
import { HostTarget } from '../components/numbers/HostTarget';
import { NumbersProgressPanel } from '../components/numbers/NumbersProgressPanel';

interface Player { id: string; name: string; connected: boolean; }

interface NumbersDisplayProps {
  socket: Socket | null;
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';

export const NumbersDisplay = ({ socket, players }: NumbersDisplayProps) => {
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

    socket.on('numbers:intro', onIntro);
    socket.on('numbers:round:start', onStart);
    socket.on('numbers:progress', onProgress);
    socket.on('numbers:round:results', onResults);

    return () => {
      socket.off('numbers:intro', onIntro);
      socket.off('numbers:round:start', onStart);
      socket.off('numbers:progress', onProgress);
      socket.off('numbers:round:results', onResults);
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
      <div className="flex h-screen w-screen items-center justify-center px-16 py-20 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-6">
          <p className="eyebrow text-2xl">Numbers Round</p>
          <h1 className="text-8xl font-bold text-game-leader">{introData.title}</h1>
          <p className="text-3xl text-white">{introData.description}</p>
          <p className="text-xl text-ui-textMuted">{introData.totalRounds} rounds · {Math.round((introData.duration || 8000) / 1000)}s briefing</p>
        </motion.div>
      </div>
    );
  }

  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.cumulativeScore - a.cumulativeScore);
    const top = sorted.slice(0, 5);
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 px-16 py-12 text-center">
        <p className="eyebrow text-2xl">Round {resultsData.roundNumber} / {resultsData.totalRounds} · {resultsData.difficulty} — Reveal</p>
        <div>
          <p className="text-2xl text-ui-textMuted">Target</p>
          <p className="text-8xl font-bold text-game-leader">{resultsData.target}</p>
        </div>
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="eyebrow">Optimal</p>
          <p className="mt-1 text-4xl font-bold text-game-correct">{resultsData.optimal?.expression ?? '—'}</p>
          <p className="text-lg text-ui-textMuted">= {resultsData.optimal?.value ?? '—'} (distance {resultsData.optimal?.distance})</p>
        </div>
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/40 p-6">
          <p className="eyebrow mb-3">Top of the standings</p>
          <ul className="space-y-2 text-2xl">
            {top.map((r: any, i: number) => (
              <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                <span className="font-bold">#{i + 1} · {r.playerName}</span>
                <span className="text-game-leader">{r.cumulativeScore} pts</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-lg text-ui-textMuted">{resultsData.isLastRound ? 'Wrapping up…' : 'Next round coming…'}</p>
      </div>
    );
  }

  if (phase !== 'playing' || !roundData) {
    return <div className="flex h-screen w-screen items-center justify-center text-2xl">Loading…</div>;
  }

  return (
    <div className="flex h-screen w-screen gap-8 px-12 py-8">
      <main className="flex flex-1 flex-col items-center justify-center gap-10">
        <div className="flex w-full items-baseline justify-between">
          <p className="eyebrow text-xl">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds} · {roundData.difficulty}</p>
          <p className="tabular-nums text-4xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
        </div>
        <HostTarget target={roundData.target} />
        <HostTilePool tiles={roundData.tiles || []} />
      </main>
      <NumbersProgressPanel players={players} progress={progress} />
    </div>
  );
};
