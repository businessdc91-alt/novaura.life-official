import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: false, // CRITICAL: don't wipe dist/os and dist/platform
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
      },
      external: [
        'isomorphic-git',
        'isomorphic-git/http/web',
        /^isomorphic-git/,
        '@isomorphic-git/lightning-fs',
        /^@isomorphic-git/
      ],
    },
  },
});
