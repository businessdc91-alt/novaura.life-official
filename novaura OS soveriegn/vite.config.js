import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {},
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
