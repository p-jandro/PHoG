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

        // ===== EXISTING (kept so old screens keep working until they're migrated) =====
        primary: {
          navy: '#16110f',
          blue: '#d06d45',
          teal: '#6f9a79',
          purple: '#8b5f6b',
        },
        game: {
          correct: '#6f9a79',
          incorrect: '#bf5c43',
          warning: '#d7a348',
          leader: '#e1c372',
        },
        difficulty: {
          easy: '#6f9a79',
          medium: '#7186be',
          hard: '#d7a348',
          impossible: '#bf5c43',
        },
        answer: {
          A: '#7186be',
          B: '#6f9a79',
          C: '#d7a348',
          D: '#8b5f6b',
        },
        medal: {
          gold: '#d8b25a',
          silver: '#b6aea2',
          bronze: '#ad744c',
        },
        ui: {
          background: '#0f0b09',
          card: '#1d1613',
          border: '#4a392f',
          text: '#f5ecdd',
          textMuted: '#c7b59d',
        }
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
