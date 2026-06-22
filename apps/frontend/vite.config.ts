import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
    alias: {
      '@': srcDir,
    },
  },
  optimizeDeps: {
    include: ['@azure/msal-browser'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/agents': {
        target: process.env.VITE_TRACKMIND_AGENTS_URL ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/agents/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
