import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';

interface ModeResultsProps {
  data: {
    mode: string;
    modeIndex: number;
    totalModes: number;
    target: any;
    results: Array<{
      playerId: string;
      playerName: string;
      modeScore: number;
      cumulativeScore: number;
    }>;
    cumulativeScores: Record<string, number>;
    isLastMode: boolean;
    duration: number;
    endsAt: number;
  };
}

const MODE_LABELS: Record<string, string> = {
  classic: 'Classic', emoji: 'Emoji', silhouette: 'Silhouette', spell: 'Spell', grid: '3×3 Grid'
};

const renderTarget = (mode: string, target: any) => {
  if (!target) return null;
  if (mode === 'grid') return <p className="text-lg">Grid revealed</p>;
  if (mode === 'spell') return (
    <>
      <p className="text-3xl font-bold text-game-leader">{target.incantation}</p>
      <p className="text-base text-ui-textMuted mt-1">{target.effect}</p>
    </>
  );
  if (mode === 'silhouette') return (
    <>
      <p className="text-3xl font-bold text-game-leader">{target.name}</p>
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="mx-auto mt-3 h-40 w-40 object-contain" />}
    </>
  );
  return <p className="text-3xl font-bold text-game-leader">{target.name}</p>;
};

export const ModeResults = ({ data }: ModeResultsProps) => {
  const { playerId } = useGameStore();
  const [remaining, setRemaining] = useState(Math.max(0, data.endsAt - Date.now()));

  useEffect(() => {
    const i = setInterval(() => setRemaining(Math.max(0, data.endsAt - Date.now())), 100);
    return () => clearInterval(i);
  }, [data.endsAt]);

  const me = data.results.find((r) => r.playerId === playerId);
  const sorted = [...data.results].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  const myRank = sorted.findIndex((r) => r.playerId === playerId) + 1;

  return (
    <div className="screen-shell flex flex-col items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="screen-frame max-w-3xl text-center space-y-5">
        <p className="eyebrow">{MODE_LABELS[data.mode]} — Mode {data.modeIndex + 1}/{data.totalModes}</p>
        <h1 className="text-3xl font-bold">It was…</h1>
        {renderTarget(data.mode, data.target)}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <p className="text-base text-ui-textMuted">You scored</p>
          <p className="text-4xl font-bold text-game-leader">+{me?.modeScore ?? 0}</p>
          <p className="mt-2 text-base">
            Cumulative: <span className="font-bold text-white">{me?.cumulativeScore ?? 0}</span>
            {myRank > 0 && <> · Rank <span className="font-bold">#{myRank}</span></>}
          </p>
        </div>

        <p className="text-sm text-ui-textMuted">
          {data.isLastMode ? 'Game wrapping up…' : 'Next mode in '}
          {!data.isLastMode && `${Math.ceil(remaining / 1000)}s`}
        </p>
      </motion.div>
    </div>
  );
};
