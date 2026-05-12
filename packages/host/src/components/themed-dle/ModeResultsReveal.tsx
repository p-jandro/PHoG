import { motion } from 'framer-motion';

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
  if (mode === 'grid')      return <p className="text-3xl">All valid answers revealed below</p>;
  if (mode === 'spell')     return (<><p className="text-7xl font-bold text-game-leader">{target.incantation}</p><p className="mt-2 text-2xl text-ui-textMuted">{target.effect}</p></>);
  if (mode === 'silhouette') return (
    <div className="flex items-center gap-6">
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="h-44 w-44 object-contain" />}
      <p className="text-7xl font-bold text-game-leader">{target.name}</p>
    </div>
  );
  return <p className="text-7xl font-bold text-game-leader">{target.name}</p>;
};

export const ModeResultsReveal = ({ data }: ModeResultsRevealProps) => {
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const top = sorted.slice(0, 3);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-8 px-12 text-center">
      <p className="eyebrow text-xl">It was…</p>
      {renderTarget(data.mode, data.target)}

      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-black/40 p-6">
        <p className="eyebrow mb-3">Top of the standings</p>
        <ul className="space-y-2 text-2xl">
          {top.map((r, i) => (
            <li key={r.playerId} className="flex items-baseline justify-between gap-4">
              <span className="font-bold">#{i + 1} · {r.playerName}</span>
              <span className="text-game-leader">{r.cumulativeScore} pts</span>
            </li>
          ))}
        </ul>
      </div>

      {!data.isLastMode && <p className="text-xl text-ui-textMuted">Next mode coming…</p>}
      {data.isLastMode  && <p className="text-xl text-game-leader">Wrapping up…</p>}
    </motion.div>
  );
};
