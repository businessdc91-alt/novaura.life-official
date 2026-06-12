import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import fs from 'fs';

const osDevRouter = {
  name: 'os-dev-router',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      // In dev, serve os.html for the OS route — production uses firebase.json rewrites
      if (req.url === '/os/' || req.url === '/os') {
        try {
          let html = fs.readFileSync(
            path.resolve(__dirname, 'os.html'),
            'utf-8'
          );
          // Let Vite transform the HTML (applies base path, injects HMR client, etc.)
          html = await server.transformIndexHtml(req.url, html);
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (e) {
          next(e);
        }
        return;
      }
      next();
    });
  },
};


export default defineConfig(({ mode }) => ({
  base: '/os/',
  plugins: [react(), osDevRouter],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: '/os/',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/os'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Key MUST stay 'os' — Vite derives the output filename from the source
        // filename (os.html → dist/os/os.html). firebase.json points to os.html.
        // DO NOT rename to 'index' or change firebase.json to index.html — it breaks every time.
        os: path.resolve(__dirname, 'os.html'),
      },
      external: [
        'isomorphic-git',
        'isomorphic-git/http/web',
        /^isomorphic-git/,
        '@isomorphic-git/lightning-fs',
        /^@isomorphic-git/,
        /^@tauri-apps/,
        /^@mlc-ai/,
      ],
    },
  },
}));
