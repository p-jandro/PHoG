import { motion } from 'framer-motion';
import type { TileState } from '../../ui/Tile';

type ServerColor = 'green' | 'yellow' | 'grey';

interface KeyboardProps {
  states: Record<string, ServerColor>;
  onLetter: (l: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

const ROW1 = 'qwertyuiop'.split('');
const ROW2 = 'asdfghjkl'.split('');
const ROW3 = 'zxcvbnm'.split('');

// Server color → Tile state palette (matches WordleBoard).
const COLOR_TO_STATE: Record<ServerColor, TileState> = {
  green: 'correct',
  yellow: 'partial',
  grey: 'wrong',
};

const KEY_BG: Record<TileState | 'unused', string> = {
  unused:  'bg-bg-surface text-ink',
  idle:    'bg-bg-surface text-ink', // shouldn't appear, kept for completeness
  correct: 'bg-action text-on-action',
  partial: 'bg-now text-on-now',
  wrong:   'bg-danger text-on-danger',
};

export const Keyboard = ({ states, onLetter, onBackspace, onEnter, disabled }: KeyboardProps) => {
  const letterButton = (l: string) => {
    const serverState = states[l];
    const state: TileState | 'unused' = serverState ? COLOR_TO_STATE[serverState] : 'unused';
    return (
      <motion.button
        key={l}
        type="button"
        disabled={disabled}
        onClick={() => onLetter(l)}
        // Pop the key when it first gets a non-unused state. framer-motion
        // re-runs `animate` whenever the dependency-deduped value changes;
        // when a fresh row colours a key, `state` flips from "unused" to
        // correct/partial/wrong and the scale keyframes play once.
        initial={false}
        animate={{ scale: state === 'unused' ? 1 : [1, 1.06, 1] }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        whileTap={!disabled ? { scale: 0.94 } : undefined}
        className={[
          'h-12 min-w-[2rem] flex-1 rounded-lg border-2 border-ink px-1 text-sm font-extrabold uppercase shadow-ink-sm',
          'disabled:opacity-50',
          'sm:h-14 sm:text-base',
          KEY_BG[state],
        ].join(' ')}
      >
        {l}
      </motion.button>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-center gap-1.5">{ROW1.map(letterButton)}</div>
      <div className="flex justify-center gap-1.5">{ROW2.map(letterButton)}</div>
      <div className="flex justify-center gap-1.5">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onEnter}
          whileTap={!disabled ? { scale: 0.94 } : undefined}
          className="h-12 rounded-lg border-2 border-ink bg-action px-3 text-xs font-extrabold uppercase text-on-action shadow-ink-sm disabled:opacity-50 sm:h-14 sm:text-sm"
        >
          Enter
        </motion.button>
        {ROW3.map(letterButton)}
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          whileTap={!disabled ? { scale: 0.94 } : undefined}
          className="h-12 rounded-lg border-2 border-ink bg-bg-sunken px-3 text-xs font-extrabold uppercase text-ink shadow-ink-sm disabled:opacity-50 sm:h-14 sm:text-sm"
        >
          ⌫
        </motion.button>
      </div>
    </div>
  );
};
