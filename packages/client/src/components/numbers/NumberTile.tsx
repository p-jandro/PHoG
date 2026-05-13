import { motion } from 'framer-motion';

export type NumberTileState = 'idle' | 'selected' | 'used';

interface NumberTileProps {
  value: number;
  state?: NumberTileState;
  disabled?: boolean;
  onClick?: () => void;
}

const STATE_CLS: Record<NumberTileState, string> = {
  // Idle: cream surface, ink ink-shadow — chunky and tappable.
  idle:     'bg-bg-surface text-ink hover:-translate-y-px',
  // Selected: sun-yellow, indicates it's the A-operand awaiting an operator.
  selected: 'bg-now text-on-now ring-4 ring-info/40',
  // Used: dimmed sunken background — visible but clearly out of the pool.
  used:     'bg-bg-sunken text-ink-muted opacity-40 pointer-events-none',
};

export function NumberTile({
  value, state = 'idle', disabled = false, onClick,
}: NumberTileProps) {
  return (
    <motion.button
      type="button"
      whileTap={!disabled && state !== 'used' ? { x: 4, y: 4 } : undefined}
      transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
      disabled={disabled || state === 'used'}
      onClick={onClick}
      className={[
        'inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center',
        'rounded-2xl border-2 border-ink shadow-ink',
        'font-display text-3xl sm:text-4xl font-extrabold tabular-nums',
        'focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-[3px]',
        'disabled:cursor-not-allowed',
        STATE_CLS[state],
      ].join(' ')}
    >
      {value}
    </motion.button>
  );
}
