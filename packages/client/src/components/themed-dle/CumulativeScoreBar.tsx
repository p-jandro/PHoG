interface CumulativeScoreBarProps {
  theme: 'pokemon' | 'hp';
  mode: 'classic' | 'emoji' | 'silhouette' | 'spell' | 'grid';
  cumulative: number;
  timerMs?: number;
  totalMs?: number;
}

const MODE_LABELS: Record<string, string> = {
  classic: 'Classic',
  emoji: 'Emoji',
  silhouette: 'Silhouette',
  spell: 'Spell',
  grid: '3×3 Grid'
};

const THEME_LABEL: Record<string, string> = {
  pokemon: 'Pokédle',
  hp: 'HP-dle'
};

export const CumulativeScoreBar = ({
  theme, mode, cumulative, timerMs, totalMs
}: CumulativeScoreBarProps) => {
  const hasTimer = typeof timerMs === 'number' && typeof totalMs === 'number' && totalMs > 0;
  const progress = hasTimer ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : null;

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">{THEME_LABEL[theme]}</p>
          <h2 className="text-2xl font-bold">{MODE_LABELS[mode]}</h2>
        </div>
        <div className="text-right">
          <p className="eyebrow">Score</p>
          <p className="text-3xl font-bold text-game-leader">{cumulative}</p>
        </div>
      </div>
      {progress !== null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-game-leader" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};
