import { motion } from 'framer-motion';
import { popIn } from '../../lib/motion';

export type ChainColor = 'green' | 'orange' | 'red';

interface ChainPillProps {
  name: string;
  color?: ChainColor;
  role?: 'start' | 'end' | 'mid';
}

/* Map color → token-based Tailwind classes.
 * green = on optimal path (valid border + reaches goal)
 * orange = "stretch" — reaches the goal but not optimal
 * red = invalid / dead end (still consumes a guess; shown for history) */
const TONE: Record<ChainColor, string> = {
  green:  'border-ink bg-action text-on-action',
  orange: 'border-ink bg-warn text-ink',
  red:    'border-ink bg-danger text-on-danger',
};

const ROLE_TONE = {
  start: 'border-ink bg-now text-on-now',
  end:   'border-ink bg-now text-on-now',
  mid:   'border-ink bg-bg-surface text-ink',
} as const;

export function ChainPill({ name, color, role = 'mid' }: ChainPillProps) {
  const cls =
    role === 'start' || role === 'end'
      ? ROLE_TONE[role]
      : color
        ? TONE[color]
        : ROLE_TONE.mid;

  return (
    <motion.span
      variants={popIn}
      initial="hidden"
      animate="visible"
      className={[
        'inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5',
        'text-sm font-extrabold shadow-ink-sm whitespace-nowrap',
        cls,
      ].join(' ')}
    >
      {role === 'start' && (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">Start</span>
      )}
      {role === 'end' && (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">End</span>
      )}
      <span>{name}</span>
    </motion.span>
  );
}
