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
  ]),
  {
    rules: {
      // Tashqi tizimlar bilan sinxronlash (auth sessiya, real-time subscribe,
      // mount holati) uchun effect ichida setState ataylab ishlatiladi.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
