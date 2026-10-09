import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@foodhelp/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts') },
  },
  server: {
    host: true,
    allowedHosts: true,
    strictPort: false,
    proxy: { '/api': { target: 'http://localhost:3000' } },
  },
});