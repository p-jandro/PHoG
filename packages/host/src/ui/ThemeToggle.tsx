import { motion } from 'framer-motion';
import { useTheme } from '../lib/theme';
import { easing } from '../lib/motion';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
      className={
        'relative inline-flex h-9 w-16 items-center rounded-full border-2 border-ink bg-bg-base p-[3px] shadow-ink-sm ' +
        className
      }
    >
      <motion.span
        layout
        transition={easing.springToggle}
        className={
          'flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink text-sm ' +
          (isDark ? 'bg-info text-on-info' : 'bg-now text-on-now')
        }
        style={{ marginLeft: isDark ? 'auto' : 0 }}
      >
        {isDark ? '☾' : '☀'}
      </motion.span>
    </button>
  );
}
