import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../ui/Card';

export interface OperationEntry {
  aValue: number;
  bValue: number;
  op: string;
  result: number;
}

interface HistoryListProps {
  history: OperationEntry[];
}

const symbol = (op: string) =>
  op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;

export const HistoryList = ({ history }: HistoryListProps) => (
  <Card eyebrow="History" className="p-3">
    {history.length === 0 ? (
      <p className="py-2 text-center text-sm italic text-ink-muted">Your history will appear here…</p>
    ) : (
      <ol className="space-y-1">
        <AnimatePresence initial={false}>
          {history.map((h, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-baseline justify-between gap-3 rounded-lg border-2 border-ink bg-bg-surface px-3 py-1.5 text-base tabular-nums shadow-ink-sm"
            >
              <span className="text-ink">
                <span className="font-extrabold">{h.aValue}</span>
                <span className="mx-2 text-ink-muted">{symbol(h.op)}</span>
                <span className="font-extrabold">{h.bValue}</span>
              </span>
              <span className="text-action">= <span className="font-extrabold">{h.result}</span></span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    )}
  </Card>
);
