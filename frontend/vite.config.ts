import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const useSentrySourceMaps =
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT;

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react({
      // IMPORTANTE: O plugin @vitejs/plugin-react-swc NÃO adiciona StrictMode automaticamente
      // StrictMode foi removido do projeto para evitar double-mount que causa erros Node.removeChild
      // StrictMode não existe em produção, então esta alteração é segura
      jsxRuntime: 'automatic',
    }),
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
