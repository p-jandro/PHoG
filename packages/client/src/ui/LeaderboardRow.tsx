import { motion, useReducedMotion } from 'framer-motion';

interface LeaderboardRowProps {
  rank: number;
  name: string;
  score: number;
  delta?: number; // +N or -N points change since last update
  isYou?: boolean;
  className?: string;
}

function medalCls(rank: number): string {
  if (rank === 1) return 'bg-medal-gold text-ink';
  if (rank === 2) return 'bg-medal-silver text-ink';
  if (rank === 3) return 'bg-medal-bronze text-white';
  return 'bg-bg-surface text-ink';
}

export function LeaderboardRow({
  rank,
  name,
  score,
  delta,
  isYou = false,
  className = '',
}: LeaderboardRowProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout={!reduce}
      transition={reduce ? { duration: 0.18 } : { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      className={[
        'grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 rounded-2xl border-2 border-ink px-4 py-2.5 shadow-ink font-extrabold',
        isYou ? 'bg-now text-on-now' : 'bg-bg-surface text-ink',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink shadow-ink-sm text-sm',
          medalCls(rank),
        ].join(' ')}
      >
        {rank}
      </span>
      <span className="text-base">{name}</span>
      <span className="font-display text-lg leading-none tracking-tight">{score}</span>
      {typeof delta === 'number' && delta !== 0 && (
        <span
          className={[
            'rounded-md border-2 border-ink px-2 py-0.5 text-xs font-extrabold',
            delta > 0 ? 'bg-action text-on-action' : 'bg-danger text-on-danger',
          ].join(' ')}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </motion.div>
  );
}
