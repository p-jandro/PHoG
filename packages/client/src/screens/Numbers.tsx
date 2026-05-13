import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { TilePool, Tile } from '../components/numbers/TilePool';
import { TargetDisplay } from '../components/numbers/TargetDisplay';
import { OperationBuilder } from '../components/numbers/OperationBuilder';
import { RoundResults } from '../components/numbers/RoundResults';
import { HistoryList, OperationEntry } from '../components/numbers/HistoryList';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';

type Phase = 'intro' | 'playing' | 'results';

interface NumbersProps {
  socket: Socket | null;
}

export const Numbers = ({ socket }: NumbersProps) => {
  useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [pool, setPool] = useState<Tile[]>([]);
  const [originalTiles, setOriginalTiles] = useState<Tile[]>([]);
  const [history, setHistory] = useState<OperationEntry[]>([]);
  const [selectedAId, setSelectedAId] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setPool([]);
      setOriginalTiles([]);
      setHistory([]);
      setSelectedAId(null);
      setOp(null);
      setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing');
      setRoundData(d);
      const tiles = d.tiles || [];
      setPool(tiles);
      setOriginalTiles(tiles);
      setHistory([]);
      setSelectedAId(null);
      setOp(null);
      setSolved(false);
    };
    const onAck = (d: any) => {
      if (!d.accepted) {
        setErrorToast(d.error || 'invalid');
        setTimeout(() => setErrorToast(null), 2200);
        return;
      }
      if (Array.isArray(d.pool)) setPool(d.pool);
      // Reset event from server: restore original tile pool.
      if (d.reset && Array.isArray(d.pool)) setOriginalTiles(d.pool);
      if (Array.isArray(d.history)) {
        setHistory(d.history.map((h: any) => ({
          aValue: h.aValue, bValue: h.bValue, op: h.op, result: h.result,
        })));
      }
      setSelectedAId(null);
      setOp(null);
      if (d.solved) setSolved(true);
    };
    const onResults = (d: any) => {
      setPhase('results');
      setResultsData(d);
    };
    socket.on('numbers:intro', onIntro);
    socket.on('numbers:round:start', onStart);
    socket.on('numbers:operation:ack', onAck);
    socket.on('numbers:round:results', onResults);
    return () => {
      socket.off('numbers:intro', onIntro);
      socket.off('numbers:round:start', onStart);
      socket.off('numbers:operation:ack', onAck);
      socket.off('numbers:round:results', onResults);
    };
  }, [socket]);

  const target = roundData?.target;
  const totalMs = roundData?.duration || 60000;
  const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;
  const aTile = pool.find((t) => t.id === selectedAId) || null;

  const handleTileClick = (id: string) => {
    if (solved) return;
    if (!selectedAId) { setSelectedAId(id); setOp(null); return; }
    if (selectedAId === id) { setSelectedAId(null); setOp(null); return; }
    if (!op) { setSelectedAId(id); return; }
    socket?.emit('numbers:operation', { aId: selectedAId, op, bId: id });
  };

  const handleOperator = (newOp: string) => {
    if (!selectedAId || solved) return;
    setOp(newOp);
  };

  const handleCancel = () => { setSelectedAId(null); setOp(null); };
  const handleReset = () => {
    socket?.emit('numbers:reset', {});
    setSelectedAId(null);
    setOp(null);
    setSolved(false);
  };

  // Intro splash
  if (phase === 'intro' && introData) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-6 flex flex-col items-center justify-center sm:px-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-auto w-full max-w-2xl space-y-4 text-center"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">Game starting</p>
          <h1 className="font-serif text-5xl font-extrabold text-ink">{introData.title}</h1>
          <p className="text-xl text-ink-muted">{introData.description}</p>
          {Array.isArray(introData.scoringRules) && (
            <ul className="mx-auto max-w-md space-y-1 text-left text-base">
              {introData.scoringRules.map((r: string) => (
                <li key={r} className="rounded-xl border-2 border-ink bg-bg-surface px-3 py-2 text-ink shadow-ink-sm">
                  {r}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-ink-muted">{introData.totalRounds} rounds · easy → medium → difficult</p>
        </motion.div>
      </div>
    );
  }

  // Results splash
  if (phase === 'results' && resultsData) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-6 flex flex-col items-center justify-center sm:px-6 sm:py-8">
        <RoundResults data={resultsData} />
      </div>
    );
  }

  // Playing
  if (phase === 'playing' && roundData) {
    return (
      <div className="min-h-screen bg-bg-base px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="muted">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds}</Chip>
              <Chip variant="streak">{roundData.difficulty}</Chip>
            </div>
            <p className="font-display text-3xl font-extrabold tabular-nums text-ink">
              {Math.ceil(timerMs / 1000)}s
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
            <div className="h-full bg-action transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>

          <TargetDisplay target={target} />

          <Card eyebrow="Tiles" className="p-4">
            <TilePool
              tiles={pool}
              originalTiles={originalTiles}
              selectedId={selectedAId}
              onTileClick={handleTileClick}
              disabled={solved}
            />
          </Card>

          <OperationBuilder
            aValue={aTile?.value ?? null}
            op={op}
            bValue={null}
            onOperator={handleOperator}
            onCancel={handleCancel}
            onReset={handleReset}
            disabled={solved}
            errorToast={errorToast}
          />

          <HistoryList history={history} />

          {solved && (
            <p className="text-center font-display text-3xl font-extrabold text-action">
              reached {target}!
            </p>
          )}
        </div>
      </div>
    );
  }

  // Loading fallback
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
      <Card className="max-w-md text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-streak">Numbers Round</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">Loading…</h1>
      </Card>
    </div>
  );
};
