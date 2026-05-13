import { motion } from 'framer-motion';
import { pinDrop } from '../../lib/motion';

interface GuessPinProps {
  cx: number;
  cy: number;
  color: 'green' | 'orange' | 'red';
  delaySec?: number;
}

const FILL = {
  green:  'var(--action)',
  orange: 'var(--warn)',
  red:    'var(--danger)',
} as const;

export function GuessPin({ cx, cy, color, delaySec = 0 }: GuessPinProps) {
  return (
    <motion.g
      variants={pinDrop}
      initial="hidden"
      animate="visible"
      transition={{ delay: delaySec }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {/* Hard offset shadow drop — matches the ink-shadow language of the rest of the kit. */}
      <circle cx={cx + 1.5} cy={cy + 1.5} r={7} fill="var(--shadow)" />
      <circle cx={cx} cy={cy} r={7} fill={FILL[color]} stroke="var(--ink)" strokeWidth={2} />
    </motion.g>
  );
}
