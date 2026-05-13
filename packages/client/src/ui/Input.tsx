import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={(helper || error) ? `${inputId}-msg` : undefined}
        className={[
          'w-full rounded-xl border-2 bg-bg-surface px-4 py-2.5 font-semibold text-ink',
          'placeholder:font-medium placeholder:text-ink-muted/60',
          'focus:outline-none',
          hasError
            ? 'border-danger shadow-[3px_3px_0_var(--danger)] focus:shadow-[3px_3px_0_var(--danger)]'
            : 'border-ink shadow-ink focus:border-info focus:shadow-[3px_3px_0_var(--info)]',
          className,
        ].join(' ')}
        {...rest}
      />
      {(helper || error) && (
        <span
          id={`${inputId}-msg`}
          className={hasError ? 'text-xs font-bold text-danger' : 'text-xs text-ink-muted'}
        >
          {error ?? helper}
        </span>
      )}
    </div>
  );
});
