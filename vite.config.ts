import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // WebAssembly packages are loaded as they are: the prebundler mangles the glue
    // code they ship. See vendor/verovio for the toolkit.
    exclude: ['verovio', 'onnxruntime-web']
  },
  test: {
    testTimeout: 30000,
  },
})
