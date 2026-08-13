import { defineConfig } from "vitest/config";

/* Without this file, vitest walks up to the CLIENT's configuration —
   which looks for tests in `src/` only, and mounts a DOM. The server
   needs neither. */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    /* A Postgres in WebAssembly starts in a fraction of a second, but a
       fresh database per test adds up in the end. */
    testTimeout: 20000,
  },
});
