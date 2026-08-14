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
    /* AND THE DATABASE IS BUILT IN THE HOOK, NOT IN THE TEST. Raising
       only the line above left `beforeEach` on its ten-second default,
       which is the phase that actually lays the schema down — so the
       generous limit was on the half of the work that does none of it.

       It held as long as the baseline was short. It stopped holding the
       day the counter's tables were added: nine files failed at once, all
       of them in `beforeEach`, none of them on an assertion. */
    hookTimeout: 30000,
  },
});
