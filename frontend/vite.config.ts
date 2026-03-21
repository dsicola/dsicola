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
    // "::" sozinho pode fazer o servidor escutar só IPv6; Chrome/Firefox em muitos PCs ligam a
    // localhost → 127.0.0.1 (IPv4) e a página não abre. Safari costuma preferir IPv6.
    // true = 0.0.0.0 (IPv4) + acessível na LAN. E2E_HOST=127.0.0.1 para sandbox/CI.
    host: process.env.E2E_HOST || true,
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
              // Não precachear *.html: após cada deploy, index antigo no precache fazia o Chrome
              // pedir chunks JS com hash antigo (404 / ecrã branco). Safari por vezes não tinha o SW
              // na mesma versão. JS/CSS com hash continuam no precache.
              globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
              // Bundle principal >6 MiB (ex. exceljs + app); precache exige limite explícito
              maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
              navigateFallback: '/index.html',
              navigateFallbackDenylist: [/^\/api\//],
              cleanupOutdatedCaches: true,
              skipWaiting: true,
              clientsClaim: true,
              runtimeCaching: [
                {
                  urlPattern: ({ request }) => request.mode === 'navigate',
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'pages',
                    networkTimeoutSeconds: 5,
                    expiration: {
                      maxEntries: 32,
                      maxAgeSeconds: 24 * 60 * 60,
                    },
                  },
                },
              ],
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
