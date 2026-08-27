import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { scoreRendererPlugin } from './src/score-renderer/vite-plugin'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), scoreRendererPlugin()],
  optimizeDeps: {
    exclude: ['verovio', 'alignmenttool']
  },
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['/Users'],
    },
  },
  test: {
    testTimeout: 30000,
  },
})
