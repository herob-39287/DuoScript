import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
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
              src: "/icon.svg",
              sizes: "any",
              type: "image/svg+xml"
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        }
      })
    ],
    define: {
      // コード内の process.env.API_KEY を、.env ファイルの API_KEY (または VITE_API_KEY) に置換
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
