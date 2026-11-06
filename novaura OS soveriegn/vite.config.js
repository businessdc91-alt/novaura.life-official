import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// One version for the app and its installer: the one in tauri.conf.json (see src/config/buildInfo.js).
const tauriConf = JSON.parse(readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {},
    __APP_VERSION__: JSON.stringify(tauriConf.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
