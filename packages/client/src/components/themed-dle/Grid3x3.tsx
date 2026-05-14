import { Fragment, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AutocompletePicker, RosterEntry } from './AutocompletePicker';
import { Button, Chip } from '../../ui';
import { cellScalePop, reducedFade, stagger } from '../../lib/motion';

type GridCellResult = {
  row: number;
  col: number;
  name: string;
  valid: boolean;
  cellAnswers: Record<string, string | null>;
};

type CellEntry = { name: string; valid: boolean; emoji?: string };

interface Grid3x3Props {
  data: {
    rows: string[];
    cols: string[];
    roster: (RosterEntry & { emoji?: string })[];
  };
  cellEvents: GridCellResult[];
  onGuess: (payload: { row: number; col: number; name: string }) => void;
}

export const Grid3x3 = ({ data, cellEvents, onGuess }: Grid3x3Props) => {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const reduce = useReducedMotion();

  const cellState = useMemo<Record<string, CellEntry>>(() => {
    if (cellEvents.length === 0) return {};
    const lastEv = cellEvents[cellEvents.length - 1];
    const state: Record<string, CellEntry> = {};
    for (const [k, name] of Object.entries(lastEv.cellAnswers)) {
      if (name) {
        const rosterEntry = data.roster.find((e) => e.name === name) as (RosterEntry & { emoji?: string }) | undefined;
        state[k] = { name, valid: true, emoji: rosterEntry?.emoji };
      }
    }
    // Surface the most-recent invalid pick so the player sees their red attempt
    if (!lastEv.valid) {
      const key = `${lastEv.row},${lastEv.col}`;
      if (!state[key]) {
        const rosterEntry = data.roster.find((e) => e.name === lastEv.name) as (RosterEntry & { emoji?: string }) | undefined;
        state[key] = { name: lastEv.name, valid: false, emoji: rosterEntry?.emoji };
      }
    }
    return state;
  }, [cellEvents, data.roster]);

  const filledCount = Object.values(cellState).filter((c) => c.valid).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Chip variant="muted">{filledCount} of 9 cells placed</Chip>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(7rem, 1fr) repeat(3, minmax(0, 1fr))' }}>
        {/* Row 0: corner + 3 column headers */}
        <div /> {/* empty corner */}
        {data.cols.map((c) => (
          <div
            key={c}
            className="rounded-2xl border-2 border-ink bg-ink px-2 py-2 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-bg-surface shadow-[3px_3px_0_var(--streak)]"
          >
            {c}
          </div>
        ))}

        {/* Rows 1-3: row header + 3 cells */}
        {data.rows.map((rowLabel, r) => (
          <Fragment key={rowLabel}>
            <div
              className="flex items-center justify-end rounded-2xl border-2 border-ink bg-premium px-3 py-2 text-right text-sm font-extrabold uppercase tracking-[0.10em] text-on-premium shadow-ink-sm"
            >
              {rowLabel}
            </div>
            {data.cols.map((_, c) => {
              const cell = cellState[`${r},${c}`];
              const isPlaced = !!cell?.valid;
              const isInvalid = !!cell && !cell.valid;
              const cellIndex = r * 3 + c;

              return (
                <motion.button
                  key={c}
                  onClick={() => setActiveCell({ row: r, col: c })}
                  variants={reduce ? reducedFade : cellScalePop}
                  initial={isPlaced ? 'hidden' : false}
                  animate={isPlaced ? 'visible' : false}
                  transition={isPlaced ? { delay: cellIndex * stagger.cell } : undefined}
                  whileTap={{ scale: 0.96 }}
                  className={[
                    'aspect-square w-full rounded-2xl border-2 border-ink p-2 text-center shadow-ink-sm',
                    isPlaced ? 'bg-action text-on-action' : isInvalid ? 'bg-danger text-on-danger' : 'bg-bg-surface text-ink',
                  ].join(' ')}
                >
                  {isPlaced ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1">
                      <span className="text-2xl leading-none">{cell.emoji ?? ''}</span>
                      <span className="text-[11px] font-extrabold leading-tight">{cell.name}</span>
                    </div>
                  ) : isInvalid ? (
                    <span className="text-[11px] font-extrabold leading-tight">{cell.name}</span>
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">tap to place</span>
                  )}
                </motion.button>
              );
            })}
          </Fragment>
        ))}
      </div>

      <AnimatePresence>
        {activeCell && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
            onMouseDown={() => setActiveCell(null)}
          >
            <motion.div
              initial={reduce ? { opacity: 0 } : { y: 20 }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: 10 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              {/* Inline card replacement — must NOT clip overflow so the
                  AutocompletePicker dropdown can extend past the modal box.
                  (The ui/Card uses overflow-hidden which truncates dropdowns.) */}
              <div className="relative rounded-3xl border-2 border-ink bg-bg-surface p-6 shadow-ink-lg">
                <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
                  {`${data.rows[activeCell.row]} × ${data.cols[activeCell.col]}`}
                </div>
                <AutocompletePicker
                  roster={data.roster}
                  onSubmit={(name) => {
                    onGuess({ row: activeCell.row, col: activeCell.col, name });
                    setActiveCell(null);
                  }}
                  placeholder="Pick a character…"
                />
                <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => setActiveCell(null)}>Cancel</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
