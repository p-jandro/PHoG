import type { ReactNode } from 'react';

export type ChipVariant = 'default' | 'now' | 'info' | 'streak' | 'muted';

const STYLES: Record<ChipVariant, string> = {
  default: 'bg-bg-surface text-ink',
  now:     'bg-now text-on-now',
  info:    'bg-info text-on-info',
  streak:  'bg-streak text-on-streak',
  muted:   'bg-bg-sunken text-ink',
};

export function Chip({
  variant = 'default',
  children,
  className = '',
}: {
  variant?: ChipVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-extrabold shadow-ink-sm',
        STYLES[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
