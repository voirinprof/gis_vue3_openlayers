import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 4000, // Changer le port ici
    open: true // Ouvre automatiquement le navigateur (optionnel)
  }
})