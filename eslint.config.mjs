import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/purity": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/immutability": "off",
      "react-hooks/exhaustive-deps": "off"
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_BACKUP_AGROLEX_ANTES_ROLLBACK_SPRINT2/**",
    "_BACKUP_AGROLEX_ANTES_ROLLBACK_TOTAL_PRE_SPRINTS/**",
    "_BACKUP_PRE_ROLLBACK_AGROLEX/**",
    "artifacts/**",
    "remove_prohibited.js",
    "tests/**",
    "coverage/**"
  ]),
]);

export default eslintConfig;
