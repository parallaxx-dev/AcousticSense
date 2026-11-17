import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: the React app talks to FastAPI through the /api proxy (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:8000', changeOrigin: true } },
  },
})
