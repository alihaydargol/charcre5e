import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages proje sitesi https://alihaydargol.github.io/charcre5e/ altında
// yayınlandığı için tüm varlık yolları bu alt dizine göre üretilmeli.
export default defineConfig({
  base: '/charcre5e/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Kural motoru (Aşama 3) gelene kadar tests/ boş; CI bu yüzden düşmesin.
    passWithNoTests: true,
  },
})
