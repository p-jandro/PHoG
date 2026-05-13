import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GamePromptHeaderProps {
  eyebrow: string;
  meta: string;
  title: ReactNode;
  details?: ReactNode;
  timerMs?: number;
  totalMs?: number;
  /** @deprecated kept for prop-shape compatibility; the redesigned bar picks its own color. */
  timerBarClassName?: string;
  /** @deprecated kept for prop-shape compatibility; the redesigned text picks its own color. */
  timerTextClassName?: string;
}

export const GamePromptHeader = ({
  eyebrow,
  meta,
  title,
  details,
  timerMs,
  totalMs,
}: GamePromptHeaderProps) => {
  const hasTimer = typeof timerMs === 'number' && typeof totalMs === 'number' && totalMs > 0;
  const progress = hasTimer ? Math.max(0, Math.min(100, (timerMs! / totalMs!) * 100)) : 0;

  // Tone of the timer reacts to time remaining, replacing the old caller-supplied class.
  const timerTone =
    progress > 50 ? 'bg-action' :
    progress > 25 ? 'bg-warn' :
                    'bg-danger';
  const timerTextTone =
    progress > 50 ? 'text-action' :
    progress > 25 ? 'text-warn' :
                    'text-danger';

  return (
    <div className="mb-6 text-center sm:mb-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-streak sm:text-sm">
        {eyebrow}
      </p>
      <p className="mt-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-muted sm:text-sm sm:tracking-[0.24em]">
        {meta}
      </p>
      <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:mt-4 sm:text-5xl">
        {title}
      </h1>

      {details ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {details}
        </div>
      ) : null}

      {hasTimer && (
        <div className="mx-auto mt-6 max-w-2xl">
          <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-bg-sunken shadow-ink-sm">
            <motion.div
              className={`h-full ${timerTone}`}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
          <div className={`mt-2 text-right font-display text-sm font-extrabold sm:text-base ${timerTextTone}`}>
            {Math.ceil(timerMs! / 1000)}s
          </div>
        </div>
      )}
    </div>
  );
};
