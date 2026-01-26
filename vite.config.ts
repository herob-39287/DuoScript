import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  const isLocalBuild = process.env.BUILD_MODE === 'local';

  return {
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          if (isLocalBuild) {
            // Local Build: Remove CDN dependencies and import map
            // Use regex to strip the tags identified by IDs or content
            return html
              .replace(/<script[^>]*id="tailwind-cdn"[^>]*>[\s\S]*?<\/script>/, '')
              .replace(/<script[^>]*id="tailwind-config"[^>]*>[\s\S]*?<\/script>/, '')
              .replace(/<script[^>]*id="import-map"[^>]*>[\s\S]*?<\/script>/, '');
          }
          return html;
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: "DuoScript - 物語のアトリエ",
          short_name: "DuoScript",
          start_url: "/",
          display: "standalone",
          background_color: "#1c1917",
          theme_color: "#1c1917",
          description: "AIと共に物語を紡ぐ、執筆のためのアトリエ。",
          icons: [
            {
              src: "https://cdn-icons-png.flaticon.com/512/2921/2921222.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "https://cdn-icons-png.flaticon.com/512/2921/2921222.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: isLocalBuild ? 'dist-local' : 'dist',
      sourcemap: false,
      rollupOptions: {
        // CDNモードの場合は主要ライブラリをバンドルから除外し、HTMLのimportmapに任せる
        // Localモードの場合は全てバンドルする
        external: isLocalBuild ? [] : [
          'react', 'react-dom', 'lucide-react', 'recharts', 'jszip', 
          'zod', 'immer', '@google/genai', 'clsx', 'tailwind-merge', 
          'class-variance-authority', 'vite-plugin-pwa', 'vite',
          '@vitejs/plugin-react'
        ]
      }
    }
  };
});