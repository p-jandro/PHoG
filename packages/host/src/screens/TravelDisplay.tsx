import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostTravelMap } from '../components/travel/HostTravelMap';

type ChainColor = 'green' | 'orange' | 'red';
const EMPTY_VISITED: Record<ChainColor, Set<string>> = {
  green: new Set(),
  orange: new Set(),
  red: new Set()
};

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

  // ── Results splash: keep the map (with optimal path overlay) — that IS the spectacle.
  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.score - a.score);
    const top = sorted.slice(0, 5);
    const solvedCount = (resultsData.results || []).filter((r: any) => r.solved).length;
    const totalPlayers = (resultsData.results || []).length;

    return (
      <div className="flex h-screen w-screen gap-8 px-12 py-10">
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <p className="eyebrow text-xl">Travel — Reveal</p>
            <p className="mt-1 text-3xl font-bold">{resultsData.start} <span className="text-ui-textMuted">→</span> {resultsData.end}</p>
            <p className="text-sm text-ui-textMuted">{resultsData.optimalDistance} hops · gold = optimal path</p>
          </div>
          <HostTravelMap
            startName={resultsData.start}
            endName={resultsData.end}
            relevantNames={resultsData.optimalChain || []}
            visitedNamesByColor={EMPTY_VISITED}
            optimalChainNames={resultsData.optimalChain}
          />
          <p className="break-words text-lg font-bold text-game-leader">
            {(resultsData.optimalChain || []).join(' → ')}
          </p>
        </div>

        <div className="flex w-80 flex-col justify-center gap-4">
          <p className="text-center text-lg text-ui-textMuted">{solvedCount} of {totalPlayers} solved</p>
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
            <p className="eyebrow mb-3">Top scorers</p>
            <ul className="space-y-2 text-xl">
              {top.map((r: any, i: number) => (
                <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                  <span className="font-bold">#{i + 1} · {r.playerName} {r.firstSolver && '⭐'}</span>
                  <span className="text-game-leader">{r.score} pts{r.solved ? '' : ' (no solve)'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (phase !== 'playing' || !roundData) {
    return <div className="flex h-screen w-screen items-center justify-center text-2xl">Loading…</div>;
  }

  // ── Playing phase: phone-only experience, host just shows the challenge + a tracker.
  const connected = players.filter((p) => p.connected);
  const maxGuesses = roundData.maxGuesses;
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;

  return (
    <div className="flex h-screen w-screen flex-col items-center px-10 py-10">
      {/* Challenge banner */}
      <header className="w-full text-center">
        <p className="eyebrow text-xl">Travel — round in progress</p>
        <p className="mt-3 break-words text-7xl font-bold leading-tight">
          {roundData.start} <span className="text-ui-textMuted">→</span> {roundData.end}
        </p>
        <p className="mt-3 text-2xl text-ui-textMuted">
          optimal <span className="text-white">{roundData.optimalDistance}</span> hops · budget <span className="text-white">{maxGuesses}</span>
        </p>
      </header>

      <div className="my-6 tabular-nums text-7xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</div>

      {/* Player tracker — main content */}
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
              const guessesUsed = s?.guessesUsed ?? 0;
              const isSolved = s?.solved ?? false;
              const outOfBudget = !isSolved && guessesUsed >= maxGuesses;
              let statusLabel = `${guessesUsed}/${maxGuesses} guesses`;
              if (isSolved) statusLabel = `✓ solved in ${guessesUsed}`;
              else if (outOfBudget) statusLabel = '✗ out of guesses';
              const tone = isSolved
                ? 'border-game-correct bg-game-correct/10 text-game-correct'
                : outOfBudget
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
