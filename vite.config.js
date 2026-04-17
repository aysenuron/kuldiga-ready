import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api to vercel dev (port 3000) when running vite dev alongside vercel dev
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
