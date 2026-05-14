import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { HostTarget } from '../components/numbers/HostTarget';
import { HostTilePool } from '../components/numbers/HostTilePool';
import { NumbersProgressPanel } from '../components/numbers/NumbersProgressPanel';
import { DigitRoll } from '../components/numbers/DigitRoll';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';

interface Player { id: string; name: string; connected: boolean; }

interface NumbersDisplayProps {
  socket: Socket | null;
  players: Player[];
}

type Phase = 'intro' | 'playing' | 'results';

const TimeLeft = ({ ms, dim = false }: { ms: number; dim?: boolean }) => (
  <div className="flex flex-col items-end">
    <span className="text-base font-extrabold uppercase tracking-[0.18em] text-ink-muted">Time left</span>
    <span
      className={[
        'font-display text-6xl font-extrabold tabular-nums leading-none',
        dim ? 'text-ink-muted/50' : 'text-ink',
      ].join(' ')}
    >
      {dim ? '—:—' : `${Math.ceil(ms / 1000)}s`}
    </span>
  </div>
);

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

  /** Shared skeleton. Centre + bottom slots are filled per-phase. */
  const Skeleton = ({
    location,
    timeLeftDim = false,
    centre,
    bottom,
  }: {
    location: string;
    timeLeftDim?: boolean;
    centre: ReactNode;
    bottom: ReactNode;
  }) => (
    <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-10">
      <header className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[0.14em] text-ink">{location}</h1>
        <TimeLeft ms={timerMs} dim={timeLeftDim} />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-10">
        {centre}
      </main>
      <footer className="mt-8">{bottom}</footer>
    </div>
  );

  // Intro splash — keep it simple, no need for the full skeleton on the briefing.
  if (phase === 'intro' && introData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base px-16 py-20 text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-4xl space-y-6">
          <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-streak">Numbers Round</p>
          <h1 className="font-serif text-8xl font-extrabold text-ink">{introData.title}</h1>
          <p className="text-3xl text-ink-muted">{introData.description}</p>
          <p className="text-xl text-ink-muted">
            {introData.totalRounds} rounds · {Math.round((introData.duration || 8000) / 1000)}s briefing
          </p>
        </motion.div>
      </div>
    );
  }

  // Results — apply the skeleton; time-left dimmed per spec.
  if (phase === 'results' && resultsData) {
    const sorted = [...(resultsData.results || [])].sort((a: any, b: any) => b.cumulativeScore - a.cumulativeScore);
    const top = sorted.slice(0, 5);
    return (
      <Skeleton
        location={`Numbers Round · Round ${resultsData.roundNumber} of ${resultsData.totalRounds} — Reveal`}
        timeLeftDim
        centre={
          <div className="flex w-full max-w-3xl flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-2xl font-extrabold uppercase tracking-[0.18em] text-ink-muted">Target was</p>
              <p className="font-display text-[10rem] font-extrabold leading-none tabular-nums text-ink">
                {resultsData.target}
              </p>
            </div>
            <Card eyebrow="One optimal solution" className="w-full text-center">
              <p className="font-display text-5xl font-extrabold text-action">
                {resultsData.optimal?.expression ?? '—'}
              </p>
              <p className="mt-1 text-xl text-ink-muted">
                = {resultsData.optimal?.value ?? '—'} (distance {resultsData.optimal?.distance})
              </p>
            </Card>
            <Card eyebrow="Top of the standings" className="w-full">
              <ul className="space-y-2 text-2xl">
                {top.map((r: any, i: number) => (
                  <li key={r.playerId} className="flex items-baseline justify-between gap-4">
                    <span className="font-extrabold text-ink">#{i + 1} · {r.playerName}</span>
                    <span className="font-display font-extrabold text-action">
                      <DigitRoll value={r.cumulativeScore} digitHeightPx={32} /> pts
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        }
        bottom={
          <p className="text-center text-lg text-ink-muted">
            {resultsData.isLastRound ? 'Wrapping up…' : 'Next round coming…'}
          </p>
        }
      />
    );
  }

  if (phase !== 'playing' || !roundData) {
    // Per bug-report 2026-05-14 §A5: never show a bare "Loading…" mid-game.
    // Fall back to a player-tracker holding view if the host display
    // re-mounts before the next round-start event arrives.
    const connected = players.filter((p) => p.connected);
    return (
      <Skeleton
        location="Numbers Round · In progress"
        timeLeftDim
        centre={
          <p className="text-2xl font-semibold text-ink-muted">
            Waiting for the next round event…
          </p>
        }
        bottom={
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Players</p>
              <Chip variant="info">{connected.length} connected</Chip>
            </div>
            {connected.length === 0 ? (
              <Card><p className="text-center text-ink-muted">No players connected.</p></Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {connected.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border-2 border-ink bg-bg-surface px-5 py-4 text-ink shadow-ink-sm"
                  >
                    <p className="truncate text-xl font-extrabold">{p.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />
    );
  }

  return (
    <Skeleton
      location={`Numbers Round · Round ${roundData.roundNumber} of ${roundData.totalRounds}`}
      centre={
        <>
          <Chip variant="streak" className="text-base">{roundData.difficulty}</Chip>
          <HostTarget target={roundData.target} />
          <HostTilePool tiles={(roundData.tiles || []).map((t: any) => t.value)} />
        </>
      }
      bottom={<NumbersProgressPanel players={players} progress={progress} />}
    />
  );
};
