import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    exclude: ['@demox-labs/miden-sdk'],
    include: ['buffer'],
  },
  assetsInclude: ['**/*.masm'], // Include .masm files as assets
  server: { allowedHosts: ['zoroswap.com'] },
});
