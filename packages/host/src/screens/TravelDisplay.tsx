import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostChainCard } from '../components/travel/HostChainCard';
import { HostTravelMap, HostChainEntry } from '../components/travel/HostTravelMap';

type ChainColor = 'green' | 'orange' | 'red';

function buildVisitedByColor(entries: HostChainEntry[]): Record<ChainColor, Set<string>> {
  const green = new Set<string>();
  const orange = new Set<string>();
  const red = new Set<string>();
  for (const e of entries) {
    if (!e.name || !e.color) continue;
    if (e.color === 'green') green.add(e.name);
    else if (e.color === 'orange') orange.add(e.name);
    else if (e.color === 'red') red.add(e.name);
  }
  return { green, orange, red };
}

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

  // Aggregate all player chain entries for the map coloring during playing phase
  const allChainEntries = useMemo<HostChainEntry[]>(() => {
    const entries: HostChainEntry[] = [];
    for (const s of Object.values(progress) as any[]) {
      if (Array.isArray(s.frontChain)) {
        for (const e of s.frontChain) entries.push(e);
      }
      if (Array.isArray(s.backChain)) {
        for (const e of s.backChain) entries.push(e);
      }
    }
    return entries;
  }, [progress]);

  // Aggregate all player chains from results for the map (also used in results phase)
  const resultsChainEntries = useMemo<HostChainEntry[]>(() => {
    if (!resultsData) return [];
    const entries: HostChainEntry[] = [];
    for (const r of (resultsData.results || []) as any[]) {
      if (Array.isArray(r.frontChain)) for (const e of r.frontChain) entries.push(e);
      if (Array.isArray(r.backChain)) for (const e of r.backChain) entries.push(e);
    }
    return entries;
  }, [resultsData]);

  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.score - a.score);
    const top = sorted.slice(0, 5);

    return (
      <div className="flex h-screen w-screen gap-8 px-12 py-10">
        {/* Map — left, takes most of the width */}
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
            visitedNamesByColor={buildVisitedByColor(resultsChainEntries)}
            optimalChainNames={resultsData.optimalChain}
          />
          <p className="break-words text-lg font-bold text-game-leader">
            {(resultsData.optimalChain || []).join(' → ')}
          </p>
        </div>

        {/* Scoreboard — right, compact */}
        <div className="flex w-80 flex-col justify-center">
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

  const connected = players.filter((p) => p.connected);
  const maxGuesses = roundData.maxGuesses;

  return (
    <div className="flex h-screen w-screen gap-6 px-10 py-8">
      {/* Map — left, 60% width */}
      <div className="flex flex-[3] flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow text-xl">Travel</p>
            <p className="mt-1 text-4xl font-bold">{roundData.start} <span className="text-ui-textMuted">→</span> {roundData.end}</p>
            <p className="text-sm text-ui-textMuted">optimal {roundData.optimalDistance} hops · budget {maxGuesses}</p>
          </div>
          <p className="tabular-nums text-4xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
        </header>
        <HostTravelMap
          startName={roundData.start}
          endName={roundData.end}
          relevantNames={roundData.relevantNames || []}
          visitedNamesByColor={buildVisitedByColor(allChainEntries)}
        />
      </div>

      {/* Player cards — right, scrollable */}
      <div className="flex flex-[2] flex-col gap-4 overflow-y-auto">
        <p className="text-lg font-semibold text-ui-textMuted">Players</p>
        <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
};
