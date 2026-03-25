import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GamePromptHeaderProps {
  eyebrow: string;
  meta: string;
  title: ReactNode;
  details?: ReactNode;
  timerMs?: number;
  totalMs?: number;
  timerBarClassName?: string;
  timerTextClassName?: string;
}

export const GamePromptHeader = ({
  eyebrow,
  meta,
  title,
  details,
  timerMs,
  totalMs,
  timerBarClassName = 'bg-primary-teal',
  timerTextClassName = 'text-primary-teal'
}: GamePromptHeaderProps) => {
  const hasTimer = typeof timerMs === 'number' && typeof totalMs === 'number' && totalMs > 0;
  const progress = hasTimer ? Math.max(0, Math.min(100, (timerMs / totalMs) * 100)) : 0;

  return (
    <div className="mb-6 text-center sm:mb-8">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <p className="text-[0.72rem] uppercase tracking-[0.2em] text-ui-textMuted sm:text-sm sm:tracking-[0.24em]">{meta}</p>
      <h1 className="mt-3 text-2xl font-bold leading-tight sm:mt-4 sm:text-5xl">{title}</h1>

      {details ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {details}
        </div>
      ) : null}

      {hasTimer && (
        <div className="mx-auto mt-6 max-w-2xl">
          <div className="h-2 overflow-hidden rounded-full bg-ui-border/90">
            <motion.div
              className={`h-full ${timerBarClassName}`}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
          <div className={`mt-2 text-right font-mono text-sm sm:text-base ${timerTextClassName}`}>
            {Math.ceil(timerMs / 1000)}s
          </div>
        </div>
      )}
    </div>
  );
};
