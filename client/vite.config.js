import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icone/apple-touch-icon.png', 'brand/logo.png', 'brand/logo-chiaro.png'],
      manifest: {
        name: 'Handmade Club',
        short_name: 'Handmade Club',
        description: 'Tessera fedeltà digitale Handmade Café',
        theme_color: '#80321A',
        background_color: '#FAF4EC',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icone/icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone/icona-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icone/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
