import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { Card, Chip, Countdown, LeaderboardRow } from '../ui';
import { HostTravelMap, HostMapGuess } from '../components/travel/HostTravelMap';

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

  // ── INTRO ──────────────────────────────────────────────────────────────
  if (phase === 'intro' && introData) {
    return (
      <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
        <header className="flex items-start justify-between">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            Travel
          </div>
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
              Time left
            </p>
            <p className="font-display text-5xl font-extrabold tabular-nums text-ink-muted">
              —:—
            </p>
          </div>
        </header>
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
        >
          <Chip variant="info">Game starting</Chip>
          <h1 className="font-serif text-7xl font-extrabold tracking-tight sm:text-8xl">
            {introData.title}
          </h1>
          <p className="text-2xl text-ink-muted sm:text-3xl">{introData.description}</p>
        </motion.section>
        <footer />
      </div>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.score - a.score);
    const top = sorted.slice(0, 5);
    const solvedCount = (resultsData.results || []).filter((r: any) => r.solved).length;
    const totalPlayers = (resultsData.results || []).length;

    const playerGuesses: HostMapGuess[] = (resultsData.results || []).flatMap((r: any) =>
      (r.history || [])
        .filter((h: any) => h.color !== 'red')
        .map((h: any) => ({
          playerId: r.playerId,
          guess: h.name,
          answer: h.side === 'front' ? resultsData.start : resultsData.end,
          color: h.color,
        }))
    );

    return (
      <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
        {/* Top row */}
        <header className="flex items-start justify-between">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            Travel — Reveal
          </div>
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
              Time left
            </p>
            <p className="font-display text-5xl font-extrabold tabular-nums text-ink-muted">
              —:—
            </p>
          </div>
        </header>

        {/* Centre: map + top-scorers */}
        <section className="flex flex-1 gap-8 overflow-hidden pt-4">
          {/* Left: map */}
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-extrabold text-ink">
                {resultsData.start} <span className="text-ink-muted">→</span> {resultsData.end}
              </p>
              <Chip variant="muted">{resultsData.optimalDistance} hops optimal</Chip>
            </div>
            <HostTravelMap
              startName={resultsData.start}
              endName={resultsData.end}
              relevantNames={resultsData.optimalChain || []}
              visitedNamesByColor={EMPTY_VISITED}
              optimalChainNames={resultsData.optimalChain}
              playerGuesses={playerGuesses}
            />
            <p className="break-words text-lg font-extrabold text-streak">
              {(resultsData.optimalChain || []).join(' → ')}
            </p>
          </div>

          {/* Right: top scorers */}
          <div className="flex w-80 flex-col justify-center gap-3">
            <p className="text-center text-sm font-extrabold uppercase tracking-[0.14em] text-ink-muted">
              {solvedCount} of {totalPlayers} solved
            </p>
            <Card>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">Top scorers</p>
              <div className="space-y-2">
                {top.map((r: any, i: number) => (
                  <LeaderboardRow
                    key={r.playerId}
                    rank={i + 1}
                    name={r.playerName + (r.firstSolver ? ' ⭐' : '')}
                    score={r.score}
                  />
                ))}
              </div>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (phase !== 'playing' || !roundData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-ink">
        <p className="font-display text-3xl font-extrabold">Loading…</p>
      </div>
    );
  }

  // ── PLAYING (map hidden!) ──────────────────────────────────────────────
  const connected = players.filter((p) => p.connected);
  const maxGuesses = roundData.maxGuesses;
  const solvedCount = connected.filter((p) => progress[p.id]?.solved).length;
  const seconds = Math.ceil(timerMs / 1000);
  const totalSec = Math.max(1, Math.ceil((roundData.duration || 90000) / 1000));

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
      {/* Top row: location top-left, countdown top-right */}
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Travel · Round in progress</p>
          <p className="mt-1 break-words font-display text-5xl font-black leading-tight tracking-tight">
            {roundData.start} <span className="text-ink-muted">→ ??? →</span> {roundData.end}
          </p>
        </div>
        <div className="shrink-0">
          <Countdown seconds={seconds} total={totalSec} size={160} />
        </div>
      </header>

      {/* Centre: challenge info chips */}
      <section className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex flex-wrap justify-center gap-3">
          <Chip variant="info" className="text-base px-4 py-2">Optimal {roundData.optimalDistance} hops</Chip>
          <Chip variant="muted" className="text-base px-4 py-2">Budget {maxGuesses} guesses</Chip>
        </div>
        <p className="text-xl text-ink-muted">
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
              const outOfBudget = !isSolved && guessesUsed >= maxGuesses;
              let statusLabel = `${guessesUsed}/${maxGuesses} guesses`;
              if (isSolved) statusLabel = `Solved in ${guessesUsed}`;
              else if (outOfBudget) statusLabel = 'Out of guesses';
              const tone = isSolved
                ? 'border-action bg-action text-on-action'
                : outOfBudget
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
