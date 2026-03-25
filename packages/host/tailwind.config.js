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
        ui: {
          background: '#0f0b09',
          card: '#1d1613',
          border: '#4a392f',
          text: '#f5ecdd',
          textMuted: '#c7b59d',
        }
      }
    },
  },
  plugins: [],
}
