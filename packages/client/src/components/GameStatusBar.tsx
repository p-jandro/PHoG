import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GameStatusBarProps {
  gameLabel: string;
  progressLabel: string;
  score: number | string;
  scoreUnit?: string;
  placement?: number | null;
  placementContext?: string;
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
  accentClassName = 'text-primary-teal',
  extra
}: GameStatusBarProps) => (
  <motion.div
    initial={{ y: -48, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="fixed inset-x-0 top-0 z-20 border-b border-ui-border/80 bg-ui-card/95 px-3 py-3 backdrop-blur-md sm:px-4"
  >
    <div className="screen-frame flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow mb-1">{gameLabel}</p>
        <p className="truncate text-xs text-ui-textMuted sm:text-sm">{progressLabel}</p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
        <div className="status-pill">
          <span className={`text-xl font-bold ${accentClassName}`}>{score}</span>
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ui-textMuted">
            {scoreUnit}
          </span>
        </div>

        {extra}

        {placement !== null && placement !== undefined && placement > 0 && (
          <div className="status-pill">
            <span className="font-bold text-white">
              {placement}
              {getOrdinalSuffix(placement)}
            </span>
            {placementContext && <span>{placementContext}</span>}
          </div>
        )}
      </div>
    </div>
  </motion.div>
);
