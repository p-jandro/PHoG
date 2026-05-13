import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export type TileState = 'idle' | 'correct' | 'partial' | 'wrong';

interface TileProps {
  state?: TileState;
  flipping?: boolean;
  flipDelaySec?: number;
  children?: ReactNode;
  className?: string;
}

const STATE_CLS: Record<TileState, string> = {
  idle:    'bg-bg-surface text-ink',
  correct: 'bg-action text-on-action',
  partial: 'bg-now text-on-now',
  wrong:   'bg-danger text-on-danger',
};

export function Tile({
  state = 'idle',
  flipping = false,
  flipDelaySec = 0,
  children,
  className = '',
}: TileProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="img"
      aria-label={`Tile ${state}`}
      initial={false}
      animate={flipping && !reduce ? { rotateX: [0, 90, 0] } : { rotateX: 0 }}
      transition={
        flipping && !reduce
          ? { duration: 0.25, times: [0, 0.5, 1], ease: 'easeInOut', delay: flipDelaySec }
          : { duration: 0.18 }
      }
      style={{ transformStyle: 'preserve-3d' }}
      className={[
        'inline-flex items-center justify-center rounded-lg border-2 border-ink shadow-ink-sm font-extrabold uppercase',
        STATE_CLS[state],
        className,
      ].join(' ')}
    >
      {children}
    </motion.div>
  );
}
