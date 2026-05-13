import { motion } from 'framer-motion';

interface ExpressionInputProps {
  expression: string;
  onOperator: (op: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}

const OP_BUTTONS = ['+', '-', '*', '/', '(', ')'];

export const ExpressionInput = ({ expression, onOperator, onBackspace, onClear, onSubmit, canSubmit }: ExpressionInputProps) => (
  <div className="space-y-3">
    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-right">
      <p className="eyebrow">Your expression</p>
      <p className="mt-1 min-h-[2.5rem] break-all text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {expression || <span className="text-ui-textMuted">…</span>}
      </p>
    </div>
    <div className="grid grid-cols-6 gap-2">
      {OP_BUTTONS.map((op) => (
        <motion.button
          key={op}
          whileTap={{ scale: 0.92 }}
          onClick={() => onOperator(op)}
          className="aspect-square rounded-2xl border border-white/15 bg-white/5 text-2xl font-bold text-white hover:bg-white/15 sm:text-3xl"
        >
          {op === '*' ? '×' : op === '/' ? '÷' : op}
        </motion.button>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-2">
      <motion.button whileTap={{ scale: 0.95 }} onClick={onBackspace} className="rounded-2xl border border-white/15 bg-white/5 py-3 text-lg font-medium text-white hover:bg-white/15">⌫ Back</motion.button>
      <motion.button whileTap={{ scale: 0.95 }} onClick={onClear} className="rounded-2xl border border-game-incorrect/40 bg-game-incorrect/10 py-3 text-lg font-medium text-game-incorrect hover:bg-game-incorrect/20">Clear</motion.button>
      <motion.button
        whileTap={{ scale: canSubmit ? 0.95 : 1 }}
        disabled={!canSubmit}
        onClick={onSubmit}
        className={`rounded-2xl py-3 text-lg font-bold ${canSubmit ? 'bg-game-correct text-black hover:brightness-110' : 'bg-game-correct/30 text-game-correct/60'}`}
      >
        Submit
      </motion.button>
    </div>
  </div>
);
