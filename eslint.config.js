import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "coverage", "etagere.html"] },

  {
    files: ["**/*.{js,jsx}"],
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

      /* Le vrai garde-fou du projet : cine-hub.jsx concentre des milliers de
         lignes de hooks, et une dépendance oubliée y passe inaperçue. */
      "react-hooks/exhaustive-deps": "warn",

      /* Réglée sur « error » par le plugin v7. Le code existant s'en sert pour
         réinitialiser un état dérivé quand une prop change (`setDraft` quand
         l'intercalaire est renommé, `setBroken` quand l'affiche change) : c'est
         correct, juste pas la forme que React recommande aujourd'hui. On garde
         l'avertissement comme dette visible plutôt qu'un blocage de la CI. */
      "react-hooks/set-state-in-effect": "warn",

      /* Un fichier qui exporte autre chose que des composants casse le
         rafraîchissement à chaud — utile en dev, jamais bloquant. */
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      /* Les variables inutilisées sont du bruit, sauf les captures
         intentionnelles (`_`) et les erreurs de catch non consultées. */
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      /* Des console.log oubliés en production : signalés, pas interdits. */
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    files: ["**/*.test.js"],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["*.config.js"],
    languageOptions: { globals: globals.node },
  },
];
