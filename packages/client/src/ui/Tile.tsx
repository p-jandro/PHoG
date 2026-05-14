import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
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

// Total flip duration in seconds — must match the framer-motion `transition.duration` below.
const FLIP_DURATION_SEC = 0.5;

export function Tile({
  state = 'idle',
  flipping = false,
  flipDelaySec = 0,
  children,
  className = '',
}: TileProps) {
  const reduce = useReducedMotion();

  // Displayed state lags the prop while a flip is in progress so the new color
  // resolves at the flip midpoint (per spec §4.4). When not flipping (or when
  // reduced motion is on) the displayed state mirrors the prop immediately.
  const [displayState, setDisplayState] = useState<TileState>(state);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (swapTimer.current) {
      clearTimeout(swapTimer.current);
      swapTimer.current = null;
    }
    if (!flipping || reduce) {
      setDisplayState(state);
      return;
    }
    // Swap the visible color at the flip midpoint: (delay + duration/2) * 1000 ms.
    const swapMs = Math.max(0, (flipDelaySec + FLIP_DURATION_SEC / 2) * 1000);
    swapTimer.current = setTimeout(() => setDisplayState(state), swapMs);
    return () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    };
  }, [flipping, reduce, state, flipDelaySec]);

  return (
    <motion.div
      role="img"
      aria-label={`Tile ${state}`}
      initial={false}
      animate={flipping && !reduce ? { rotateX: [0, 90, 0] } : { rotateX: 0 }}
      transition={
        flipping && !reduce
          ? { duration: FLIP_DURATION_SEC, times: [0, 0.5, 1], ease: 'easeInOut', delay: flipDelaySec }
          : { duration: 0.18 }
      }
      style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
      className={[
        'inline-flex items-center justify-center rounded-lg border-2 border-ink shadow-ink-sm font-extrabold uppercase',
        STATE_CLS[displayState],
        className,
      ].join(' ')}
    >
      {children}
    </motion.div>
  );
}
