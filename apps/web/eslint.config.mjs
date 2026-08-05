import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output:
    "playwright-report/**",
    "test-results/**",
    // Exclude auto-generated Soroban contract bindings from linting.
    // The Soroban binding generator emits patterns such as `any`, declaration
    // merging, and TypeScript suppression comments that are intentional in
    // generated output but would otherwise trigger lint errors. Handwritten
    // application source under src/ remains fully linted.
    "src/lib/bindings/community-nft/**",
    "src/lib/bindings/community-governor/**",
  ]),
]);

export default eslintConfig;
