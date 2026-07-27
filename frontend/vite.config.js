import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ask': {
        target:       'http://localhost:3000',
        changeOrigin: true,
        secure:       false,
      },
      '/upload': {
        target:       'http://localhost:3000',
        changeOrigin: true,
        secure:       false,
      },
      // ← NEW: forwards all /auth/* requests to backend
      '/auth': {
        target:       'http://localhost:3000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },
})

