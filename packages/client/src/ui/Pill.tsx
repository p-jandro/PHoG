import type { ReactNode } from 'react';

export function Pill({
  status,
  children,
  className = '',
}: {
  status?: 'connected' | 'connecting' | 'offline';
  children: ReactNode;
  className?: string;
}) {
  const dotColor =
    status === 'connected'  ? 'bg-action' :
    status === 'offline'    ? 'bg-danger' :
                              'bg-warn';
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border-2 border-ink bg-bg-surface px-3 py-1.5 text-sm font-bold text-ink shadow-ink-sm',
        className,
      ].join(' ')}
    >
      {status && <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
