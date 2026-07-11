import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // The MVP fetches data with plain useEffect + supabase-js (no data-fetching
      // library / Suspense cache yet), the same fetch-on-mount convention already
      // used throughout the sibling AgroLex app. This rule flags that pattern
      // unconditionally, including when the actual setState only runs after an
      // internal await.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
