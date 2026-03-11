import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  base: '/admin/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'studio-sdk': ['@grapesjs/studio-sdk'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  }
})
