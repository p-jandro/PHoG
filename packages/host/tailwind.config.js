/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== NEW: redesign tokens (consume CSS variables) =====
        'bg-base':    'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-sunken':  'var(--bg-sunken)',
        ink:          'var(--ink)',
        'ink-muted':  'var(--ink-muted)',
        action:       'var(--action)',
        now:          'var(--now)',
        info:         'var(--info)',
        streak:       'var(--streak)',
        premium:      'var(--premium)',
        danger:       'var(--danger)',
        warn:         'var(--warn)',
        'on-action':  'var(--on-action)',
        'on-now':     'var(--on-now)',
        'on-info':    'var(--on-info)',
        'on-streak':  'var(--on-streak)',
        'on-premium': 'var(--on-premium)',
        'on-danger':  'var(--on-danger)',
        'answer-a':   'var(--answer-a)',
        'answer-b':   'var(--answer-b)',
        'answer-c':   'var(--answer-c)',
        'answer-d':   'var(--answer-d)',
        'medal-gold':   'var(--medal-gold)',
        'medal-silver': 'var(--medal-silver)',
        'medal-bronze': 'var(--medal-bronze)',

      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'sans-serif'],
        serif:   ['Fraunces', '"Iowan Old Style"', 'serif'],
      },
      boxShadow: {
        'ink-sm': '2px 2px 0 var(--shadow)',
        'ink':    '4px 4px 0 var(--shadow)',
        'ink-lg': '6px 6px 0 var(--shadow)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}
