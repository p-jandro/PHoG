/* Motion tokens and reusable framer-motion variants.
 * One file so timings can be tuned globally. §4.2 in the spec. */
import type { Variants, Transition } from 'framer-motion';

export const duration = {
  tap: 0.08,
  hover: 0.12,
  toggle: 0.18,
  enter: 0.22,
  reveal: 0.28,
  celebrate: 0.6,
} as const;

export const easing = {
  easeOut: [0.0, 0.0, 0.2, 1] as const,
  backOut: [0.34, 1.56, 0.64, 1] as const,
  springToggle: { type: 'spring', stiffness: 280, damping: 22 } satisfies Transition,
} as const;

export const stagger = {
  short: 0.08,
  tile: 0.18,
  rank: 0.6,
} as const;

/* ---------- Variants ---------- */

export const tap: Variants = {
  rest:    { y: 0, x: 0 },
  pressed: { y: 4, x: 4, transition: { duration: duration.tap, ease: easing.easeOut } },
};

export const hoverLift: Variants = {
  rest:  { y: 0, x: 0 },
  hover: { y: -1, x: -1, transition: { duration: duration.hover, ease: easing.easeOut } },
};

export const popIn: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: duration.reveal, ease: easing.backOut } },
};

export const tileFlip: Variants = {
  idle:     { rotateX: 0 },
  flipping: { rotateX: [0, 90, 0], transition: { duration: 0.25, times: [0, 0.5, 1], ease: 'easeInOut' } },
};

export const letterDrop: Variants = {
  hidden:  { y: -12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: duration.reveal, ease: easing.easeOut } },
};

export const screenEnter: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.enter, ease: easing.easeOut } },
};

/* Reduced-motion substitute: crossfade only. */
export const reducedFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.toggle } },
};

/* ---------- Pointless score-drop timing (§3.9) ---------- */
export const pointlessDrop = {
  baseMs: 4000,
  msPerPoint: 90,
  landingPauseMs: 1800,
  landingPauseAtZeroMs: 2800,
} as const;

export function pointlessDropDurationMs(dropFromHundred: number): number {
  return pointlessDrop.baseMs + dropFromHundred * pointlessDrop.msPerPoint;
}
