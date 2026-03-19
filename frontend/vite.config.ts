import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

const useSentrySourceMaps =
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT;

/** Build para Capacitor (iOS/Android): sem Service Worker PWA — evita conflitos na WebView. */
const capacitorWebBuild = process.env.CAPACITOR_WEB_BUILD === "true";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'],
  },
  server: {
    // E2E_HOST=127.0.0.1 evita erro uv_interface_addresses em ambientes restritos (sandbox, CI)
    host: process.env.E2E_HOST || "::",
    port: 8080,
  },
  plugins: [
    react({
      // IMPORTANTE: O plugin @vitejs/plugin-react-swc NÃO adiciona StrictMode automaticamente
      // StrictMode foi removido do projeto para evitar double-mount que causa erros Node.removeChild
      // StrictMode não existe em produção, então esta alteração é segura
      jsxRuntime: 'automatic',
    }),
    // PWA apenas no build web normal — não no bundle Capacitor (WebView)
    ...(capacitorWebBuild
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            // Desativar minificação do service worker para evitar erro do terser
            minify: false,
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              navigateFallback: '/index.html',
              navigateFallbackDenylist: [/^\/api\//],
            },
            manifest: {
              name: 'DSICOLA - Sistema de Gestão Escolar',
              short_name: 'DSICOLA',
              description: 'Sistema de gestão escolar completo para gestão de alunos, professores, cursos, notas e frequência.',
              theme_color: '#1e40af',
              background_color: '#ffffff',
              display: 'standalone',
              start_url: '/',
              lang: 'pt-BR',
              icons: [
                { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
          }),
        ]),
    // Sentry: upload de source maps apenas quando SENTRY_AUTH_TOKEN, SENTRY_ORG e SENTRY_PROJECT estão definidos
    ...(useSentrySourceMaps
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG!,
          project: process.env.SENTRY_PROJECT!,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            filesToDeleteAfterUpload: ["./dist/**/*.map", "./dist/**/**/*.map"],
          },
        })
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    ...(useSentrySourceMaps ? { sourcemap: "hidden" as const } : {}),
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignore warnings from browser extensions (content.js, build.js)
        if (
          warning.code === "EVAL" ||
          warning.message?.includes("content.js") ||
          warning.message?.includes("build.js") ||
          warning.id?.includes("content.js") ||
          warning.id?.includes("build.js")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
