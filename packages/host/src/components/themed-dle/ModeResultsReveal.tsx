import { motion } from 'framer-motion';
import { Card, LeaderboardRow, Chip } from '../../ui';

interface ModeResultsRevealProps {
  data: {
    mode: string;
    modeIndex: number;
    totalModes: number;
    target: any;
    results: Array<{ playerId: string; playerName: string; modeScore: number; cumulativeScore: number }>;
    cumulativeScores: Record<string, number>;
    isLastMode: boolean;
  };
}

const renderTarget = (mode: string, target: any) => {
  if (!target) return null;
  if (mode === 'grid') return <p className="text-3xl font-extrabold text-ink">Grid revealed below</p>;
  if (mode === 'spell') return (
    <>
      <p className="font-serif text-7xl font-bold text-premium">{target.incantation}</p>
      <p className="mt-2 text-2xl text-ink-muted">{target.effect}</p>
    </>
  );
  if (mode === 'silhouette') return (
    <div className="flex items-center gap-6">
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="h-44 w-44 object-contain" />}
      <p className="font-serif text-7xl font-bold text-premium">{target.name}</p>
    </div>
  );
  return <p className="font-serif text-7xl font-bold text-premium">{target.name}</p>;
};

export const ModeResultsReveal = ({ data }: ModeResultsRevealProps) => {
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const top = sorted.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-10 px-12 text-center"
    >
      <Chip variant="streak">It was…</Chip>
      {renderTarget(data.mode, data.target)}

      <Card className="w-full max-w-3xl" eyebrow="Top of the standings">
        <ol className="space-y-2">
          {top.map((r, i) => (
            <LeaderboardRow
              key={r.playerId}
              rank={i + 1}
              name={r.playerName}
              score={r.cumulativeScore}
            />
          ))}
        </ol>
      </Card>

      {!data.isLastMode && <Chip variant="info">Next mode coming up</Chip>}
      {data.isLastMode  && <Chip variant="streak">Wrapping up</Chip>}
    </motion.div>
  );
};
