import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/recharts')) return 'recharts'
          if (id.includes('node_modules/zustand')) return 'zustand'
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform') || id.includes('node_modules/zod')) return 'form'
          if (id.includes('node_modules/date-fns')) return 'date-fns'
          if (id.includes('node_modules/@tanstack')) return 'tanstack'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/workbox')) return 'workbox'
          if (id.includes('node_modules/scheduler')) return 'scheduler'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom') || id.includes('/node_modules/react/')) return 'react-core'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 300,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: 'BMS Hospital Portal',
        short_name: 'BMS',
        description: 'Hospital Building Management System',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
})
