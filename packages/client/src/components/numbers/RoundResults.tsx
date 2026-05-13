import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';

interface RoundResultsProps {
  data: {
    roundNumber: number;
    totalRounds: number;
    difficulty: string;
    target: number;
    tiles: number[];
    optimal: { found: boolean; distance: number; value: number | null; expression: string | null };
    results: Array<{
      playerId: string;
      playerName: string;
      roundScore: number;
      cumulativeScore: number;
      solved: boolean;
      operations: number;
      firstSolver: boolean;
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="screen-frame max-w-2xl space-y-5 text-center">
      <p className="eyebrow">Round {data.roundNumber} / {data.totalRounds} · {data.difficulty}</p>
      <p className="text-2xl text-ui-textMuted">Target was</p>
      <p className="text-6xl font-bold text-game-leader">{data.target}</p>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <p className="eyebrow">One optimal solution</p>
        <p className="mt-1 text-2xl font-bold text-game-correct">{data.optimal.expression ?? '—'} = {data.optimal.value ?? '—'}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <p className="eyebrow">Your round</p>
        {me ? (
          <>
            <p className="text-lg">{me.solved ? `✓ solved in ${me.operations} operation${me.operations === 1 ? '' : 's'}` : '✗ not solved'}</p>
            <p className="mt-2 text-3xl font-bold text-game-leader">+{me.roundScore}{me.firstSolver && ' (first!)'}</p>
            <p className="text-sm text-ui-textMuted">cumulative: {me.cumulativeScore}</p>
          </>
        ) : (
          <p className="text-ui-textMuted">No round result.</p>
        )}
      </div>

      <p className="text-sm text-ui-textMuted">{data.isLastRound ? 'Game wrapping up…' : 'Next round coming…'}</p>
    </motion.div>
  );
};
