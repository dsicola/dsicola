import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
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
