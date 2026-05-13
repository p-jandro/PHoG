import { Chip } from '../../ui';

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
  const progress = hasTimer ? Math.max(0, Math.min(100, (timerMs! / totalMs!) * 100)) : null;

  return (
    <div className="mb-4 rounded-2xl border-2 border-ink bg-bg-surface px-4 py-3 shadow-ink-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <Chip variant="info">{THEME_LABEL[theme]}</Chip>
          <h2 className="text-2xl font-extrabold text-ink">{MODE_LABELS[mode]}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Score</p>
          <p className="font-display text-3xl font-extrabold text-premium">{cumulative}</p>
        </div>
      </div>
      {progress !== null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full border-2 border-ink bg-bg-sunken">
          <div className="h-full bg-now" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};
