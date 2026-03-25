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
          navy: '#1a2332',
          blue: '#0066FF',
          teal: '#00D4AA',
          purple: '#7B61FF',
        },
        game: {
          correct: '#00D4AA',
          incorrect: '#FF4757',
          warning: '#FFA502',
          leader: '#FFD700',
        },
        ui: {
          background: '#131518',
          card: '#1c1f26',
          border: '#2d3039',
          text: '#FFFFFF',
          textMuted: '#8B92A1',
        }
      }
    },
  },
  plugins: [],
}

