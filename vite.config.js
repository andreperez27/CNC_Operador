import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base do deploy: o GitHub Pages serve este app no subpath do repositório
// (https://andreperez27.github.io/CNC_Operador/). O Vite prefixa
// automaticamente os assets do bundle, o registro do SW e o manifest;
// referências a arquivos de public/ (fontes via pipeline, favicon/ícones)
// usam caminhos relativos para acompanhar a mesma base.
const BASE = '/CNC_Operador/';

export default defineConfig({
  base: BASE,
  build: {
    target: 'es2018'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'CNC Operador',
        short_name: 'CNC Op',
        description: 'Aplicativo de apoio para operação CNC - HEIDENHAIN iTNC 530',
        theme_color: '#0a0c0f',
        background_color: '#0a0c0f',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: BASE + 'index.html'
      }
    })
  ]
});
