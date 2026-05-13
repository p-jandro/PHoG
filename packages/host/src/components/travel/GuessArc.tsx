import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { arcDrawTransition } from '../../lib/motion';

interface GuessArcProps {
  x1: number; y1: number;
  x2: number; y2: number;
  color: 'green' | 'orange' | 'red';
  delaySec?: number;
}

const STROKE = {
  green:  'var(--action)',
  orange: 'var(--warn)',
  red:    'var(--danger)',
} as const;

/* A quadratic-bezier arc between two screen-space points. The control point
 * is lifted perpendicular to the chord (~20% of chord length) so arcs visibly
 * curve over the map rather than passing under pins. */
function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const lift = len * 0.2;
  // perpendicular unit vector pointing "up" (negative y)
  const px = -dy / (len || 1);
  const py = dx / (len || 1);
  const cx = (x1 + x2) / 2 + px * lift * Math.sign(-py || 1);
  const cy = (y1 + y2) / 2 + py * lift * Math.sign(-py || 1);
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

export function GuessArc({ x1, y1, x2, y2, color, delaySec = 0 }: GuessArcProps) {
  const ref = useRef<SVGPathElement | null>(null);
  const [len, setLen] = useState<number | null>(null);
  const d = arcPath(x1, y1, x2, y2);

  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [d]);

  return (
    <motion.path
      ref={ref}
      d={d}
      fill="none"
      stroke={STROKE[color]}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeDasharray={len ?? undefined}
      initial={{ strokeDashoffset: len ?? 0 }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ ...arcDrawTransition, delay: delaySec }}
    />
  );
}
