import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';

interface RoundResultsProps {
  data: {
    roundNumber: number;
    totalRounds: number;
    target: number;
    tiles: number[];
    optimal: { found: boolean; distance: number; value: number | null; expression: string | null };
    results: Array<{
      playerId: string;
      playerName: string;
      expression: string | null;
      value: number | null;
      distance: number | null;
      roundScore: number;
      cumulativeScore: number;
      valid: boolean;
      firstExactBonus: boolean;
    }>;
    isLastRound: boolean;
    duration: number;
    endsAt: number;
  };
}

export const RoundResults = ({ data }: RoundResultsProps) => {
  const { playerId } = useGameStore();
  const me = data.results.find((r) => r.playerId === playerId);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="screen-frame max-w-3xl space-y-5 text-center">
      <p className="eyebrow">Round {data.roundNumber} / {data.totalRounds} — Reveal</p>
      <p className="text-2xl text-ui-textMuted">Target was</p>
      <p className="text-6xl font-bold text-game-leader">{data.target}</p>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <p className="eyebrow">Optimal solution</p>
        <p className="mt-1 text-3xl font-bold text-game-correct">{data.optimal.expression ?? '—'}</p>
        <p className="text-sm text-ui-textMuted">= {data.optimal.value ?? '—'} (distance {data.optimal.distance})</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left">
        <p className="eyebrow mb-3 text-center">Your round</p>
        {me ? (
          <>
            <p className="text-lg"><span className="font-bold">{me.expression || 'no submission'}</span></p>
            <p className="text-sm text-ui-textMuted">value: {me.value ?? '—'} · distance: {me.distance ?? '—'}</p>
            <p className="mt-2 text-center text-3xl font-bold text-game-leader">+{me.roundScore} pts{me.firstExactBonus && ' (first exact!)'}</p>
            <p className="text-center text-sm text-ui-textMuted">cumulative: {me.cumulativeScore}</p>
          </>
        ) : (
          <p className="text-center text-ui-textMuted">No submission this round.</p>
        )}
      </div>

      <p className="text-sm text-ui-textMuted">{data.isLastRound ? 'Game wrapping up…' : 'Next round coming…'}</p>
    </motion.div>
  );
};
