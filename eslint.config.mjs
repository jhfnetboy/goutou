import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The new react-hooks `set-state-in-effect` rule fires on several
      // legitimate, pre-existing patterns across the UI (mount flags, syncing
      // local state when a prop/`open` changes). None of these loop or are real
      // bugs, and `next build` is unaffected. Keep it a visible warning rather
      // than a hard error so it doesn't block CI / every PR that touches these
      // files; the follow-up is to migrate them to derived state.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated deployment/build artifacts:
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
