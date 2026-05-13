import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  optimizeDeps: {
    include: ['react-simple-maps', 'prop-types']
  },
  build: {
    rollupOptions: {
      // react-simple-maps references prop-types as a peer dep; treat as external to avoid
      // Rollup resolution errors in production build. It's only used for runtime prop checking.
      external: ['prop-types']
    }
  }
})
