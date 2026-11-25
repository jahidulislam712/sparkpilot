import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      ".pnpm-store/**",
      ".turbo/**",
      "dist/**",
      "**/dist/**",
      ".next/**",
      "**/.next/**",
      ".next/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.{js,cjs,mjs,jsx,ts,mts,cts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  prettier,
]);
