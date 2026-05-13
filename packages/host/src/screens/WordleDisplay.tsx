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
  // Target received early from the host-only event; used to pre-layout reveal tiles.
  // NEVER rendered until the 'results' phase — purely infrastructure.
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setProgress({}); setPendingTarget(null); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); };
    // Host-only event: server sends the target early so the host can prepare reveal
    // infrastructure. This event is NEVER emitted to player sockets.
    const onStartHost = (d: any) => { setPendingTarget(d.target ?? null); };
    const onProgress = (d: any) => setProgress(d.playerProgress || {});
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };
    socket.on('wordle:intro', onIntro);
    socket.on('wordle:round:start', onStart);
    socket.on('wordle:round:start:host', onStartHost);
    socket.on('wordle:progress', onProgress);
    socket.on('wordle:round:results', onResults);
    return () => {
      socket.off('wordle:intro', onIntro);
      socket.off('wordle:round:start', onStart);
      socket.off('wordle:round:start:host', onStartHost);
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
      <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
        <header className="flex items-start justify-between">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            Wordle
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

  if (phase === 'results' && resultsData) {
    // Prefer pendingTarget (received early from wordle:round:start:host) so the host
    // already had the word in state before results arrived — avoids any flash of
    // empty tiles.  Falls back to resultsData.answer for safety.
    const answer = String(pendingTarget ?? resultsData.answer ?? '').toUpperCase().padEnd(5, ' ').slice(0, 5);
    const byPlayer = new Map<string, any>();
    for (const r of resultsData.results || []) byPlayer.set(r.playerId, r);

    return (
      <div className="flex h-screen w-screen flex-col bg-bg-base px-10 py-8 text-ink">
        {/* Top row: location top-left, time dimmed top-right (results phase) */}
        <header className="flex items-start justify-between">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            Wordle — Reveal
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

        {/* Centre: TV-sized word reveal */}
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Chip variant="streak">The word was</Chip>
          <div className="flex gap-3">
            {answer.split('').map((ch, i) => (
              <Tile
                key={i}
                state="correct"
                flipping
                flipDelaySec={i * 0.18}
                className="aspect-square w-32 text-7xl"
              >
                {ch.trim()}
              </Tile>
            ))}
          </div>
        </section>

        {/* Bottom: player tracker — per-player guess counts (spec §7.3) */}
        <footer className="w-full">
          {players.length === 0 ? (
            <p className="text-center text-ink-muted">No players this round.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {players.map((p) => {
                const r = byPlayer.get(p.id);
                const solved = r?.solved ?? false;
                const guessesUsed = r?.guessesUsed ?? 0;
                let label = 'No submission';
                if (r) {
                  label = solved
                    ? `Solved in ${guessesUsed} guess${guessesUsed === 1 ? '' : 'es'}`
                    : `Did not solve (${guessesUsed} guesses)`;
                }
                const tone = solved
                  ? 'border-action bg-action text-on-action'
                  : r
                    ? 'border-danger bg-danger text-on-danger'
                    : 'border-ink bg-bg-surface text-ink';
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border-2 px-4 py-3 shadow-ink-sm ${tone}`}
                  >
                    <p className="truncate font-display text-xl font-extrabold">
                      {p.name}
                      {r?.firstSolver && (
                        <span className="ml-2 align-middle text-sm">⭐ first</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </footer>
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
