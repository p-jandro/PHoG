import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { TilePool } from '../components/numbers/TilePool';
import { TargetDisplay } from '../components/numbers/TargetDisplay';
import { ExpressionInput } from '../components/numbers/ExpressionInput';
import { RoundResults } from '../components/numbers/RoundResults';

type Phase = 'intro' | 'playing' | 'results';

interface NumbersProps {
  socket: Socket | null;
}

// Derive which tile slots are consumed by the current expression string.
// We tokenize the expression for numeric literals and greedy-match against tile values.
function deriveUsedIndexes(expression: string, tiles: number[]): Set<number> {
  const literals: number[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < expression.length && expression[j] >= '0' && expression[j] <= '9') j++;
      literals.push(Number(expression.slice(i, j)));
      i = j;
    } else {
      i++;
    }
  }
  const remaining = tiles.map((v, idx) => ({ v, idx }));
  const used = new Set<number>();
  for (const lit of literals) {
    const slot = remaining.findIndex((t) => t.v === lit && !used.has(t.idx));
    if (slot !== -1) used.add(remaining[slot].idx);
  }
  return used;
}

export const Numbers = ({ socket }: NumbersProps) => {
  const { playerId } = useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [introData, setIntroData] = useState<any>(null);
  const [roundData, setRoundData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any>(null);
  const [expression, setExpression] = useState('');
  const [ackToast, setAckToast] = useState<string | null>(null);
  const [timerMs, setTimerMs] = useState(0);

  // Timer for the playing phase
  useEffect(() => {
    if (phase !== 'playing' || !roundData?.endsAt) return;
    const tick = () => setTimerMs(Math.max(0, roundData.endsAt - Date.now()));
    tick();
    const i = setInterval(tick, 100);
    return () => clearInterval(i);
  }, [phase, roundData]);

  useEffect(() => {
    if (!socket) return;
    const onIntro = (d: any) => { setPhase('intro'); setIntroData(d); setExpression(''); };
    const onStart = (d: any) => { setPhase('playing'); setRoundData(d); setExpression(''); };
    const onAck = (d: any) => {
      if (d.accepted) setAckToast(`✓ submitted: ${d.value}`);
      else setAckToast(`✗ ${d.error || 'invalid'}`);
      setTimeout(() => setAckToast(null), 2500);
    };
    const onResults = (d: any) => { setPhase('results'); setResultsData(d); };

    socket.on('numbers:intro', onIntro);
    socket.on('numbers:round:start', onStart);
    socket.on('numbers:submit:ack', onAck);
    socket.on('numbers:round:results', onResults);

    return () => {
      socket.off('numbers:intro', onIntro);
      socket.off('numbers:round:start', onStart);
      socket.off('numbers:submit:ack', onAck);
      socket.off('numbers:round:results', onResults);
    };
  }, [socket, playerId]);

  const tiles: number[] = roundData?.tiles || [];
  const usedIndexes = useMemo(() => deriveUsedIndexes(expression, tiles), [expression, tiles]);

  const appendTile = (_idx: number, value: number) => {
    setExpression((e) => e + String(value));
  };
  const appendOp = (op: string) => {
    setExpression((e) => e + op);
  };
  const backspace = () => {
    setExpression((e) => {
      if (!e) return e;
      // If the last char is a digit, peel off the whole literal in one step
      const lastChar = e[e.length - 1];
      if (lastChar >= '0' && lastChar <= '9') {
        let i = e.length - 1;
        while (i > 0 && e[i - 1] >= '0' && e[i - 1] <= '9') i--;
        return e.slice(0, i);
      }
      return e.slice(0, -1);
    });
  };
  const clearExpr = () => setExpression('');
  const submit = () => {
    if (!socket || !expression) return;
    socket.emit('numbers:submit', { expression });
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
          <p className="text-sm text-ui-textMuted">{introData.totalRounds} rounds total</p>
        </motion.div>
      </div>
    );
  }

  // Results
  if (phase === 'results' && resultsData) {
    return (
      <div className="screen-shell flex flex-col items-center justify-center">
        <RoundResults data={resultsData} />
      </div>
    );
  }

  // Playing — show the build pad
  if (phase === 'playing' && roundData) {
    const totalMs = roundData.duration || 45000;
    const progress = totalMs > 0 ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;

    return (
      <div className="screen-shell py-4">
        <div className="screen-frame max-w-3xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Numbers · Round {roundData.roundNumber}/{roundData.totalRounds}</p>
            <p className="tabular-nums text-2xl font-bold text-white">{Math.ceil(timerMs / 1000)}s</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
          </div>

          <TargetDisplay target={roundData.target} />
          <TilePool tiles={tiles} usedIndexes={usedIndexes} onTileClick={appendTile} />
          <ExpressionInput
            expression={expression}
            onOperator={appendOp}
            onBackspace={backspace}
            onClear={clearExpr}
            onSubmit={submit}
            canSubmit={expression.length > 0}
          />
          {ackToast && (
            <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-center text-sm">{ackToast}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <div className="screen-frame max-w-md text-center">
        <p className="eyebrow">Numbers Round</p>
        <h1 className="text-3xl font-bold">Loading…</h1>
      </div>
    </div>
  );
};
