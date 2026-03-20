import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      ".vite",
      "coverage",
      "build",
      "android",
      "ios",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Fast Refresh: util em dev; misturar hooks/utilitários no mesmo ficheiro é comum nesta base.
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // tsc continua a validar tipos; reduzir `any` é melhoria incremental (milhares de ocorrências).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "warn",
      "no-case-declarations": "warn",
      "prefer-const": "warn",
      "no-shadow-restricted-names": "warn",
      "no-useless-escape": "warn",
      "no-empty": "warn",
      "react-hooks/rules-of-hooks": "error",
      // Base grande: dependências de efeito são frequentemente omitidas de propósito; reativar gradualmente se quiser.
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
);
