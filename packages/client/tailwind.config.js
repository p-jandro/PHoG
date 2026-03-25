/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}
