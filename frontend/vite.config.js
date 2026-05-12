
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      // any request starting with /ask or /upload
      // gets forwarded to our backend automatically
      '/ask': 'http://localhost:3000',
      '/upload': 'http://localhost:3000'
    }
  }
})