import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  base: mode === 'landing' ? '/' : '/os/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/os'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'os.html'),
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
}));
