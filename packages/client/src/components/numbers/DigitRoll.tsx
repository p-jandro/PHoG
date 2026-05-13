import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { easing } from '../../lib/motion';

/**
 * DigitRoll — animates each digit independently from 0 → final digit.
 * Spec §4.4: each digit cycles 0–9 and lands with a small overshoot, 300ms ease-out.
 * We use `easing.backOut` (cubic-bezier .34, 1.56, .64, 1) to get the overshoot.
 *
 * Reading order: left → right (later digits land later, 80ms stagger).
 */
interface DigitRollProps {
  value: number;
  /** Optional className for the wrapping flex container (digits + sign). */
  className?: string;
  /** How tall is one digit. Match this to the surrounding text size in px. */
  digitHeightPx?: number;
  /** Extra stagger per digit position (ms). */
  staggerMs?: number;
}

export function DigitRoll({
  value,
  className = '',
  digitHeightPx = 64,
  staggerMs = 80,
}: DigitRollProps) {
  // Render only the digits — sign is handled separately so negatives still roll.
  const display = useMemo(() => Math.abs(Math.round(value)).toString(), [value]);
  const negative = value < 0;
  const digits = display.split('').map((c) => parseInt(c, 10));

  return (
    <span className={['inline-flex items-baseline tabular-nums', className].join(' ')}>
      {negative && <span aria-hidden="true">−</span>}
      <span className="sr-only">{value}</span>
      {digits.map((d, i) => (
        <span
          key={`${i}-${d}`}
          aria-hidden="true"
          className="inline-block overflow-hidden"
          style={{ height: digitHeightPx, lineHeight: `${digitHeightPx}px` }}
        >
          <motion.span
            className="block"
            initial={{ y: 0 }}
            animate={{ y: -d * digitHeightPx }}
            transition={{
              duration: 0.3,
              ease: easing.backOut,
              delay: (i * staggerMs) / 1000,
            }}
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block" style={{ height: digitHeightPx }}>{n}</span>
            ))}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
