import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { DigitRoll } from './DigitRoll';

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-2xl space-y-5"
    >
      <div className="flex items-center justify-center gap-2">
        <Chip variant="muted">Round {data.roundNumber} / {data.totalRounds}</Chip>
        <Chip variant="streak">{data.difficulty}</Chip>
      </div>

      <Card className="text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Target was</p>
        <p className="mt-1 font-display text-7xl font-extrabold leading-none tabular-nums text-ink">
          {data.target}
        </p>
      </Card>

      <Card eyebrow="One optimal solution" className="text-center">
        <p className="mt-1 font-display text-3xl font-extrabold text-action">
          {data.optimal.expression ?? '—'} = {data.optimal.value ?? '—'}
        </p>
      </Card>

      <Card eyebrow="Your round" className="text-center">
        {me ? (
          <>
            <p className="text-lg text-ink">
              {me.solved ? `✓ solved in ${me.operations} operation${me.operations === 1 ? '' : 's'}` : '✗ not solved'}
            </p>
            <p className="mt-2 font-display text-4xl font-extrabold text-ink">
              +<DigitRoll value={me.roundScore} digitHeightPx={40} />
              {me.firstSolver && <span className="ml-2 text-xl text-streak">first!</span>}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              cumulative: <DigitRoll value={me.cumulativeScore} digitHeightPx={16} />
            </p>
          </>
        ) : (
          <p className="text-ink-muted">No round result.</p>
        )}
      </Card>

      <p className="text-center text-sm text-ink-muted">
        {data.isLastRound ? 'Game wrapping up…' : 'Next round coming…'}
      </p>
    </motion.div>
  );
};
