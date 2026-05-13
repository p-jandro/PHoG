import { motion } from 'framer-motion';

interface OperationBuilderProps {
  aValue: number | null;
  op: string | null;            // '+' | '-' | '*' | '/' | null
  bValue: number | null;        // usually null — set briefly during the auto-complete animation
  onOperator: (op: string) => void;
  onCancel: () => void;         // clears the in-progress selection (deselects A)
  onReset: () => void;          // restores the original tile pool (server round-trip)
  disabled?: boolean;
  errorToast?: string | null;
}

const OP_BUTTONS: Array<{ value: string; label: string }> = [
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' }
];

const Slot = ({ value, highlight }: { value: number | null | string; highlight?: boolean }) => (
  <div className={`flex h-16 flex-1 items-center justify-center rounded-xl border-2 text-2xl font-bold ${
    value !== null && value !== ''
      ? (highlight ? 'border-game-leader bg-game-leader/20 text-game-leader' : 'border-white/20 bg-white/10 text-white')
      : 'border-dashed border-white/15 text-ui-textMuted'
  }`}>
    {value !== null && value !== '' ? value : '…'}
  </div>
);

export const OperationBuilder = ({
  aValue, op, bValue, onOperator, onCancel, onReset, disabled, errorToast
}: OperationBuilderProps) => {
  const aSet = aValue !== null;
  const opSet = op !== null;
  const opLabel = op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Slot value={aValue} highlight={aSet && !opSet} />
        <Slot value={opLabel ?? null} />
        <Slot value={bValue} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {OP_BUTTONS.map((o) => (
          <motion.button
            key={o.value}
            disabled={disabled || !aSet}
            whileTap={{ scale: 0.92 }}
            onClick={() => onOperator(o.value)}
            className={`rounded-xl border py-3 text-2xl font-bold ${
              op === o.value
                ? 'border-game-leader bg-game-leader text-black'
                : 'border-white/15 bg-white/5 text-white hover:bg-white/15'
            } disabled:opacity-40`}
          >
            {o.label}
          </motion.button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          whileTap={{ scale: aSet ? 0.95 : 1 }}
          onClick={onCancel}
          disabled={disabled || !aSet}
          className="rounded-xl border border-white/15 bg-white/5 py-3 text-lg font-medium text-white disabled:opacity-40"
        >
          Deselect
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          disabled={disabled}
          className="rounded-xl border border-game-incorrect/40 bg-game-incorrect/10 py-3 text-lg font-medium text-game-incorrect hover:bg-game-incorrect/20 disabled:opacity-40"
        >
          Reset tiles
        </motion.button>
      </div>
      {errorToast && (
        <div className="rounded-xl border border-game-incorrect/40 bg-game-incorrect/10 px-3 py-2 text-center text-sm text-game-incorrect">
          {errorToast}
        </div>
      )}
    </div>
  );
};
