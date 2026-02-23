import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 超過 2MB 的 asset 改為警告不中斷建置（icon 過大時仍可 deploy）
      showMaximumFileSizeToCacheInBytesWarning: true,
      manifest: {
        name: '台越翻譯機',
        short_name: '台越翻譯',
        description: '越南語（南越）↔ 中文翻譯，支援男女用語',
        theme_color: '#047857',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6291456 // 6 MiB，讓 4.74 MB 的 icon 可 precache
      }
    })
  ]
})
