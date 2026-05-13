import type { ReactNode } from 'react';

interface CardProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Card({ eyebrow, title, children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-3xl border-2 border-ink bg-bg-surface p-6 shadow-ink-lg',
        className,
      ].join(' ')}
    >
      {eyebrow && (
        <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
          {eyebrow}
        </div>
      )}
      {title && (
        <div className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-ink">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
