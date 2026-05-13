import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { Card, Chip } from '../../ui';

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

const renderTarget = (mode: string, target: any) => {
  if (!target) return null;
  if (mode === 'grid') return (
    <>
      <p className="text-2xl font-extrabold text-ink">Grid revealed</p>
      <div className="flex justify-center mt-1"><Chip variant="muted">see grid below on host</Chip></div>
    </>
  );
  if (mode === 'spell') return (
    <>
      <p className="font-serif text-5xl font-bold text-premium">{target.incantation}</p>
      <p className="mt-2 text-base text-ink-muted">{target.effect}</p>
    </>
  );
  if (mode === 'silhouette') return (
    <>
      {target.spriteUrl && <img src={target.spriteUrl} alt={target.name} className="mx-auto mt-3 h-40 w-40 object-contain" />}
      <p className="font-serif text-4xl font-bold text-premium">{target.name}</p>
    </>
  );
  return <p className="font-serif text-4xl font-bold text-premium">{target.name}</p>;
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
  const cumulative = me?.cumulativeScore ?? 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base px-4 py-6">
      <div className="w-full max-w-3xl space-y-4">
        <Card eyebrow="It was…" className="text-center space-y-3">
          {renderTarget(data.mode, data.target)}
        </Card>

        <Card className="mt-4 text-center space-y-2">
          <div className="flex justify-center"><Chip variant="muted">You scored</Chip></div>
          <p className="text-5xl font-extrabold text-action font-display">+{me?.modeScore ?? 0}</p>
          <p className="text-base text-ink">
            Cumulative: <span className="font-extrabold text-ink">{cumulative}</span>
            {myRank > 0 && <> · Rank <Chip variant="now">#{myRank}</Chip></>}
          </p>
        </Card>

        <p className="text-sm text-ink-muted text-center">
          {data.isLastMode ? 'Game wrapping up…' : `Next mode in ${Math.ceil(remaining / 1000)}s`}
        </p>
      </div>
    </div>
  );
};
