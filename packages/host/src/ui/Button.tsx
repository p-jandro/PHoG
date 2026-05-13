import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'action' | 'info' | 'streak' | 'premium' | 'danger' | 'now' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  action:  'bg-action text-on-action',
  info:    'bg-info text-on-info',
  streak:  'bg-streak text-on-streak',
  premium: 'bg-premium text-on-premium',
  danger:  'bg-danger text-on-danger',
  now:     'bg-now text-on-now',
  ghost:   'bg-transparent text-ink',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg shadow-ink-sm',
  md: 'px-5 py-2.5 text-base rounded-xl shadow-ink',
  lg: 'px-6 py-3.5 text-lg rounded-2xl shadow-ink-lg',
};

export function Button({
  variant = 'action',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={!disabled && !loading ? { x: -1, y: -1 } : undefined}
      whileTap={!disabled && !loading ? { x: 4, y: 4 } : undefined}
      transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 border-2 border-ink font-extrabold tracking-wide',
        'focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-[3px]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(' ')}
      {...(rest as any)}
    >
      {children}
      {loading && <span aria-hidden="true" className="ml-1 animate-pulse tracking-[0.15em]">● ● ●</span>}
    </motion.button>
  );
}
