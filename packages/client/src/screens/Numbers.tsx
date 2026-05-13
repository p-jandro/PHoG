import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { TilePool, Tile } from '../components/numbers/TilePool';
import { TargetDisplay } from '../components/numbers/TargetDisplay';
import { OperationBuilder } from '../components/numbers/OperationBuilder';
import { RoundResults } from '../components/numbers/RoundResults';
import { HistoryList, OperationEntry } from '../components/numbers/HistoryList';

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
  const [history, setHistory] = useState<OperationEntry[]>([]);
  const [selectedAId, setSelectedAId] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  // Playing-phase timer
  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  // Socket subscriptions
  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => {
      setPhase('intro');
      setIntroData(d);
      setPool([]);
      setHistory([]);
      setSelectedAId(null);
      setOp(null);
      setSolved(false);
    };
    const onStart = (d: any) => {
      setPhase('playing');
      setRoundData(d);
      setPool(d.tiles || []);
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
      if (Array.isArray(d.history)) {
        setHistory(d.history.map((h: any) => ({
          aValue: h.aValue,
          bValue: h.bValue,
          op: h.op,
          result: h.result
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
    if (!selectedAId) {
      // First selection: pick A
      setSelectedAId(id);
      setOp(null);
      return;
    }
    if (selectedAId === id) {
      // Tapping the same tile again deselects
      setSelectedAId(null);
      setOp(null);
      return;
    }
    if (!op) {
      // A is selected but no op yet — treat as "switch A"
      setSelectedAId(id);
      return;
    }
    // We have A + op; this tile is B → execute
    socket?.emit('numbers:operation', { aId: selectedAId, op, bId: id });
    // Optimistic clear; will be overwritten by ack
    // (We don't clear selectedAId here — the ack will. Keeps the highlight visible during the round-trip.)
  };

  const handleOperator = (newOp: string) => {
    if (!selectedAId || solved) return;
    setOp(newOp);
  };

  const handleCancel = () => {
    setSelectedAId(null);
    setOp(null);
  };

  const handleReset = () => {
    socket?.emit('numbers:reset', {});
    setSelectedAId(null);
    setOp(null);
    setSolved(false);
  };

  // Intro splash
  if (phase === 'intro' && introData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen-frame max-w-2xl space-y-4 text-center">
          <p className="eyebrow">Game starting</p>
          <h1 className="text-5xl font-bold text-game-leader">{introData.title}</h1>
          <p className="text-xl text-ui-textMuted">{introData.description}</p>
          {Array.isArray(introData.scoringRules) && (
            <ul className="mx-auto max-w-md space-y-1 text-left text-base">
              {introData.scoringRules.map((r: string) => (
                <li key={r} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">{r}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-ui-textMuted">{introData.totalRounds} rounds · easy → medium → difficult</p>
        </motion.div>
      </div>
    );
  }

  // Results splash
  if (phase === 'results' && resultsData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <RoundResults data={resultsData} />
      </div>
    );
  }

  // Playing
  if (phase === 'playing' && roundData) {
    return (
      <div className="screen-shell py-4">
        <div className="screen-frame max-w-2xl space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="eyebrow">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds}</p>
              <p className="text-xs uppercase tracking-wider text-game-leader">{roundData.difficulty}</p>
            </div>
            <p className="tabular-nums text-2xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
          </div>

          <TargetDisplay target={target} />

          <TilePool tiles={pool} selectedId={selectedAId} onTileClick={handleTileClick} disabled={solved} />

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
            <p className="text-center text-2xl font-bold text-game-correct">🎉 reached {target}!</p>
          )}
        </div>
      </div>
    );
  }

  // Loading fallback
  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <div className="screen-frame max-w-md text-center">
        <p className="eyebrow">Numbers Round</p>
        <h1 className="text-3xl font-bold">Loading…</h1>
      </div>
    </div>
  );
};
