import { motion, AnimatePresence } from 'framer-motion';

export interface OperationEntry {
  aValue: number;
  bValue: number;
  op: string;             // '+' | '-' | '*' | '/'
  result: number;
}

interface HistoryListProps {
  history: OperationEntry[];
}

const symbol = (op: string) =>
  op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;

export const HistoryList = ({ history }: HistoryListProps) => (
  <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
    <p className="eyebrow mb-2">History</p>
    {history.length === 0 ? (
      <p className="py-2 text-center text-sm italic text-ui-textMuted">Your history will appear here…</p>
    ) : (
      <ol className="space-y-1">
        <AnimatePresence initial={false}>
          {history.map((h, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-baseline justify-between gap-3 rounded-lg bg-white/5 px-3 py-1.5 text-base tabular-nums"
            >
              <span className="text-white">
                <span className="font-bold">{h.aValue}</span>
                <span className="mx-2 text-ui-textMuted">{symbol(h.op)}</span>
                <span className="font-bold">{h.bValue}</span>
              </span>
              <span className="text-game-leader">= <span className="font-bold">{h.result}</span></span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    )}
  </div>
);
