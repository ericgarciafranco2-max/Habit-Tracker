import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// En GitHub Pages la app cuelga de /<repositorio>/, no de la raiz. El flujo de
// publicacion pasa VITE_BASE; en local se queda en '/'.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      // Usamos el codigo fuente del core para tener recarga en caliente.
      '@habit/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173, host: true },
  build: { outDir: 'dist', sourcemap: false },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Habit Tracker — Disciplina',
        short_name: 'Habitos',
        description: 'Tracker de habitos con sistema de presion y planificador universitario',
        lang: 'es',
        theme_color: '#f5f5f7',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        id: base,
        scope: base,
        start_url: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
