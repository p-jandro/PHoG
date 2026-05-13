import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';

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

  const connected = players.filter((p) => p.connected);
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="flex h-screen w-screen flex-col items-center px-10 py-10">
      <header className="w-full text-center">
        <p className="eyebrow text-xl">Numbers Round</p>
        <p className="mt-1 text-2xl text-ui-textMuted">
          Round {roundData.roundNumber}/{roundData.totalRounds} · {roundData.difficulty}
        </p>
      </header>

      <div className="my-6 tabular-nums text-7xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</div>

      <div className="w-full max-w-5xl flex-1 overflow-y-auto">
        <p className="mb-3 text-center text-lg text-ui-textMuted">
          {solvedCount} of {connected.length} solved
        </p>
        {connected.length === 0 ? (
          <p className="text-center text-ui-textMuted">No players connected.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {connected.map((p) => {
              const s = progress[p.id];
              const isSolved = s?.solved ?? false;
              const ops = s?.operations ?? 0;
              let statusLabel = ops === 0 ? '⏳ thinking…' : `${ops} operation${ops === 1 ? '' : 's'}`;
              if (isSolved) statusLabel = '✓ solved';
              const tone = isSolved
                ? 'border-game-correct bg-game-correct/10 text-game-correct'
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
