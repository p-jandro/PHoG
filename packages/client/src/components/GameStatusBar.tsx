import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Chip } from '../ui/Chip';

interface GameStatusBarProps {
  gameLabel: string;
  progressLabel: string;
  score: number | string;
  scoreUnit?: string;
  placement?: number | null;
  placementContext?: string;
  /** @deprecated kept for prop-shape compatibility; redesigned bar picks its own color. */
  accentClassName?: string;
  extra?: ReactNode;
}

const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

export const GameStatusBar = ({
  gameLabel,
  progressLabel,
  score,
  scoreUnit = 'pts',
  placement,
  placementContext,
  extra,
}: GameStatusBarProps) => (
  <motion.div
    initial={{ y: -48, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="fixed inset-x-0 top-0 z-20 border-b-2 border-ink bg-bg-surface px-3 py-3 shadow-ink-sm sm:px-4"
  >
    <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak">{gameLabel}</p>
        <p className="truncate text-xs font-semibold text-ink-muted sm:text-sm">{progressLabel}</p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
        <Chip variant="info">
          <span className="font-display text-base font-black">{score}</span>
          <span className="text-[0.65rem] tracking-[0.18em]">{scoreUnit.toUpperCase()}</span>
        </Chip>

        {extra}

        {placement !== null && placement !== undefined && placement > 0 && (
          <Chip>
            <span className="font-display text-base font-black">
              {placement}{getOrdinalSuffix(placement)}
            </span>
            {placementContext && <span className="text-[0.65rem] tracking-[0.18em] uppercase">{placementContext}</span>}
          </Chip>
        )}
      </div>
    </div>
  </motion.div>
);
