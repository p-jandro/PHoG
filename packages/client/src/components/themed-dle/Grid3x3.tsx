import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';

type GridCellResult = {
  row: number;
  col: number;
  name: string;
  valid: boolean;
  cellAnswers: Record<string, string | null>;
};

interface Grid3x3Props {
  data: {
    rows: string[];
    cols: string[];
    roster: RosterEntry[];
  };
  cellEvents: GridCellResult[];
  onGuess: (payload: { row: number; col: number; name: string }) => void;
}

export const Grid3x3 = ({ data, cellEvents, onGuess }: Grid3x3Props) => {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  const cellState = useMemo(() => {
    const latest: Record<string, { name: string; valid: boolean }> = {};
    for (const ev of cellEvents) {
      for (const [k, name] of Object.entries(ev.cellAnswers)) {
        if (!name) continue;
        latest[k] = { name, valid: latest[k]?.valid ?? true };
      }
      const key = `${ev.row},${ev.col}`;
      if (ev.valid) latest[key] = { name: ev.name, valid: true };
      else if (!ev.cellAnswers[key]) {
        latest[key] = { name: ev.name, valid: false };
      }
    }
    return latest;
  }, [cellEvents]);

  const filledCount = Object.values(cellState).filter((c) => c.valid).length;

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-ui-textMuted">{filledCount}/9 filled</p>

      <div className="overflow-x-auto">
        <table className="mx-auto table-fixed border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {data.cols.map((c) => (
                <th key={c} className="px-2 py-2 text-center text-xs font-semibold text-ui-textMuted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((rowLabel, r) => (
              <tr key={rowLabel}>
                <th className="pr-2 text-right text-xs font-semibold text-ui-textMuted">{rowLabel}</th>
                {data.cols.map((_, c) => {
                  const cell = cellState[`${r},${c}`];
                  const tone = !cell
                    ? 'border-dashed border-white/20 text-ui-textMuted'
                    : cell.valid
                      ? 'border-game-correct bg-game-correct/15 text-white'
                      : 'border-game-incorrect bg-game-incorrect/10 text-ui-textMuted';
                  return (
                    <td key={c} className="h-24 w-24">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setActiveCell({ row: r, col: c })}
                        className={`h-full w-full rounded-2xl border-2 px-1 text-center text-xs font-medium leading-tight ${tone}`}
                      >
                        {cell?.name ?? '+'}
                      </motion.button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {activeCell && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
            onMouseDown={() => setActiveCell(null)}
          >
            <motion.div
              initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 10 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-ui-card p-5"
            >
              <p className="eyebrow mb-2">{data.rows[activeCell.row]} × {data.cols[activeCell.col]}</p>
              <AutocompletePicker
                roster={data.roster}
                onSubmit={(name) => {
                  onGuess({ row: activeCell.row, col: activeCell.col, name });
                  setActiveCell(null);
                }}
                placeholder="Pick a name…"
              />
              <button
                onClick={() => setActiveCell(null)}
                className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-ui-textMuted hover:bg-white/5"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
