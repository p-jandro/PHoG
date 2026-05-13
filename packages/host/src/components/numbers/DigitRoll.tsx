import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { easing } from '../../lib/motion';

interface DigitRollProps {
  value: number;
  className?: string;
  digitHeightPx?: number;
  staggerMs?: number;
}

export function DigitRoll({
  value,
  className = '',
  digitHeightPx = 128,
  staggerMs = 80,
}: DigitRollProps) {
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
