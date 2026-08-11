import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  /* `.claude` abrite les copies de travail que les tâches de fond
     ouvrent dans le dépôt lui-même. Ce sont des dépôts entiers : sans
     cette exclusion, `npm run lint` se met à relire tout le projet une
     seconde fois dès qu'une tâche tourne, et rend des centaines
     d'erreurs qui n'appartiennent pas au code qu'on écrit. */
  /* `server/` est un second paquet, avec son propre TypeScript, ses
     propres contrôles et les globales de Node — que cette configuration-
     ci, réglée pour un navigateur, ne connaît pas : elle y voyait des
     `process` et des `Buffer` non définis. Il se vérifie chez lui, par
     `cd server && npm test && npm run typecheck`. */
  { ignores: ["dist", "coverage", "etagere.html", ".claude", "server"] },

  /* Le TypeScript arrive fichier par fichier pendant la migration : les deux
     langages cohabitent dans src/ et partagent les mêmes règles React. */
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

      /* Le vrai garde-fou du projet : l'étagère concentre des centaines de
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

  /* En TypeScript, la règle de base signale à tort les types importés et les
     paramètres de génériques : c'est la version typée qui fait autorité. */
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
