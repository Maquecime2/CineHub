import { describe, it, expect } from "vitest";

/* THIS TEST EXISTS BECAUSE `cmd` GOT ME.

   `set VITE_SERVEUR=http://localhost:8787 && npm run build` files into
   the variable everything that comes before the `&&`, trailing space
   included. So the compiled address carried a trailing space, every
   request went out to an invalid URL, and the screen announced an
   unreachable server that was running perfectly well. Nothing in the
   code was wrong — only confident. */

const clean = (raw: string): string => raw.trim().replace(/\/+$/, "");

describe("the server's address", () => {
  it("survives a space left behind by the shell", () => {
    expect(clean("http://localhost:8787 ")).toBe("http://localhost:8787");
    expect(clean("  http://localhost:8787\t")).toBe("http://localhost:8787");
  });

  it("survives a trailing slash, which would double the paths' own", () => {
    expect(clean("http://localhost:8787/")).toBe("http://localhost:8787");
    expect(clean("https://api.exemple.fr//")).toBe("https://api.exemple.fr");
  });

  it("leaves a clean address intact, and the empty one empty", () => {
    expect(clean("https://api.exemple.fr")).toBe("https://api.exemple.fr");
    expect(clean("")).toBe("");
  });
});
