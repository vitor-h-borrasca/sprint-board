import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/azure-api': {
        target: 'https://dev.azure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/azure-api/, ''),
        secure: true,
      },
      '/anthropic-api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic-api/, ''),
        secure: true,
      },
    },
  },
})
