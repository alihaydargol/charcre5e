import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Favicon'u data URI olarak gömer.
 *
 * `viteSingleFile` JS ve CSS'i gömüyor ama `public/` altındaki varlıklar
 * dışarıda kalıyor. "Tek dosya" sözünün karşılığı olsun diye ikon da içeri
 * alınıyor; kullanıcı yalnızca index.html'i kopyalasa da sekme ikonu çalışır.
 */
function inlineFavicon() {
  return {
    name: 'inline-favicon',
    transformIndexHtml(html: string) {
      const svg = readFileSync(fileURLToPath(new URL('./public/favicon.svg', import.meta.url)))
      const uri = `data:image/svg+xml;base64,${svg.toString('base64')}`
      return html.replace('href="./favicon.svg"', `href="${uri}"`)
    },
  }
}

/**
 * İki derleme hedefi var:
 *
 *  - Varsayılan: GitHub Pages'e giden, kod bölmeli, kurulabilir PWA.
 *  - `BUILD_TARGET=single`: her şeyi tek bir HTML dosyasına gömen arşiv
 *    çıktısı. `file://` altında, sunucusuz ve internetsiz açılır.
 *
 * Tek dosya hedefinde PWA kapalı: service worker `file://` protokolünde
 * çalışmaz ve zaten gereksiz — dosyanın kendisi çevrimdışı.
 */
const singleFile = process.env.BUILD_TARGET === 'single'

export default defineConfig({
  // GitHub Pages proje sitesi https://alihaydargol.github.io/charcre5e/ altında
  // yayınlandığı için tüm varlık yolları bu alt dizine göre üretilmeli.
  // Tek dosya çıktısında ise sayfa herhangi bir klasörden açılabilmeli.
  base: singleFile ? './' : '/charcre5e/',
  plugins: [
    react(),
    tailwindcss(),
    ...(singleFile
      ? [viteSingleFile(), inlineFavicon()]
      : [
          VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.svg'],
            manifest: {
              name: 'D&D 5e Karakter Oluşturucu',
              short_name: 'D&D 5e',
              description:
                'SRD 5.1 kurallarına göre seviye 1-20 D&D 5e karakteri oluştur. ' +
                'Tarayıcıda çalışır, karakterlerin cihazında kalır.',
              lang: 'tr',
              start_url: '/charcre5e/',
              scope: '/charcre5e/',
              display: 'standalone',
              background_color: '#f8f4ea',
              theme_color: '#f8f4ea',
              icons: [
                {
                  src: 'favicon.svg',
                  sizes: 'any',
                  type: 'image/svg+xml',
                  purpose: 'any',
                },
              ],
            },
            workbox: {
              /*
               * Uygulama kabuğu ve SRD verisi önbelleğe alınır. JSON chunk'lar
               * büyük (büyüler 392 kB, sihirli eşyalar 314 kB) ama çevrimdışı
               * çalışmanın anlamı onlar; varsayılan 2 MB sınırı yetmiyor.
               */
              globPatterns: ['**/*.{js,css,html,svg,woff2}'],
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              cleanupOutdatedCaches: true,
            },
            devOptions: {
              // Geliştirme sunucusunda service worker kayıt hatası vermesin.
              enabled: false,
            },
          }),
        ]),
  ],
  build: singleFile ? { outDir: 'dist-single' } : {},
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Tek dosya derlemesinde PWA eklentisi yok, dolayısıyla sanal modülü de
      // yok; bileşeni derlemeden çıkarmak yerine boş bir uygulamaya bağlanır.
      ...(singleFile
        ? {
            'virtual:pwa-register/react': fileURLToPath(
              new URL('./src/components/pwaRegisterStub.ts', import.meta.url),
            ),
          }
        : {}),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
