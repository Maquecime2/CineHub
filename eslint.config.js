import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  /* `.claude` holds the working copies background tasks open inside the
     repository itself. They are whole repositories: without this
     exclusion, `npm run lint` starts rereading the entire project a
     second time as soon as a task is running, and returns hundreds of
     errors that belong to no code we wrote. */
  /* `server/` is a second package, with its own TypeScript, its own
     checks and Node's globals — which this configuration, set for a
     browser, does not know: it saw undefined `process` and `Buffer`
     there. It is checked at home, by
     `cd server && npm test && npm run typecheck`. */
  { ignores: ["dist", "coverage", "shelf.html", ".claude", "server"] },

  /* TypeScript arrives file by file during the migration: the two
     languages live together in src/ and share the same React rules. */
  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ["**/*.{ts,tsx}"] })),

  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      /* The project's real guard rail: the shelf concentrates hundreds of
         lines of hooks, and a forgotten dependency goes unnoticed
         there. */
      "react-hooks/exhaustive-deps": "warn",

      /* Set to "error" by the v7 plugin. The existing code uses it to
         reset derived state when a prop changes (`setDraft` when the
         divider is renamed, `setBroken` when the poster changes): that is
         correct, just not the shape React recommends today. We keep the
         warning as visible debt rather than a blockage in CI. */
      "react-hooks/set-state-in-effect": "warn",

      /* A file that exports something other than components breaks hot
         reloading — useful in dev, never blocking. */
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      /* Unused variables are noise, except deliberate captures (`_`) and
         caught errors nobody looks at. */
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      /* console.log left in production: flagged, not forbidden. */
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  /* In TypeScript the base rule wrongly flags imported types and generic
     parameters: the typed version is the one that has authority. */
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },

  {
    files: ["**/*.test.{js,jsx,ts,tsx}", "src/setupTests.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },

  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
];
