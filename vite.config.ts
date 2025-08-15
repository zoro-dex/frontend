import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
build: {
    rollupOptions: {
      // Don't let Rollup try to parse this worker file
      external: [
        '@demox-labs/miden-sdk/dist/workers/web-client-methods-worker.js'
      ]
    }
  },
  optimizeDeps: {
    exclude: [
      '@demox-labs/miden-sdk/dist/workers/web-client-methods-worker.js'
    ]
  },
  assetsInclude: ['**/*.masm'] // Include .masm files as assets
})
