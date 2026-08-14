import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   WHAT THE VAULT ANSWERS WHEN IT HOLDS NOTHING

   This file had no test at all, and the reason it had none is the
   reason the bug below lived for as long as it did: jsdom implements no
   IndexedDB, so the whole module was unreachable from the suite.

   THE BUG, IN ONE LINE. `tx` resolved with
   `result?.result !== undefined ? result.result : result` — right for a
   `fn` that returns something other than a request, catastrophic for
   `get` on a key that is not there. `request.result` is `undefined`
   then, so it fell back on THE REQUEST OBJECT, which is truthy.

   Everything downstream reads that as "the image is here":

     - `readMedia` does `const here = await getImage(key); if (here)
       return here;` — so it never once asked the mirror, for any
       missing image, for anybody. Not one ticket request left the page.
     - `URL.createObjectURL` was then handed an `IDBRequest` and threw
       "Overload resolution failed"; `IdbImage` caught it and drew
       "stayed on the other device" — over a blob sitting in the
       container all along.

   The stand-in below is deliberately minimal: it is the shape of the
   API this module actually uses, and nothing more.
   ============================================================ */

const stores = new Map();

const makeRequest = (compute) => {
  const req = { result: undefined };
  /* A real request carries `result` from the start — that is exactly
     what tells it apart from a plain return value. */
  queueMicrotask(() => {
    req.result = compute();
  });
  return req;
};

const objectStore = (name) => ({
  get: (key) => makeRequest(() => stores.get(name)?.get(key)),
  put: (value, key) =>
    makeRequest(() => {
      if (!stores.has(name)) stores.set(name, new Map());
      stores.get(name).set(key, value);
      return undefined;
    }),
  delete: (key) => makeRequest(() => void stores.get(name)?.delete(key)),
  getAllKeys: () => makeRequest(() => [...(stores.get(name)?.keys() ?? [])]),
});

globalThis.indexedDB = {
  open: () => {
    const req = {};
    queueMicrotask(() => {
      req.result = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => {},
        transaction: (name) => {
          const t = { objectStore: () => objectStore(name) };
          /* The transaction completes after the requests have run. */
          queueMicrotask(() => queueMicrotask(() => t.oncomplete?.()));
          return t;
        },
        close: () => {},
      };
      req.onsuccess?.();
    });
    return req;
  },
};

const { putImage, getImage, deleteImage, allImageKeys } = await import("./db.js");

beforeEach(() => {
  stores.clear();
  vi.clearAllMocks();
});

describe("the image vault", () => {
  it("gives back what was filed", async () => {
    const blob = new Blob(["png"]);
    await putImage("a", blob);
    expect(await getImage("a")).toBe(blob);
  });

  /* THE ONE THAT COST A COLLECTION ITS SCREENSHOTS. An absent key must
     answer "nothing" — anything truthy is read as an image by every
     caller, and the mirror is never asked. */
  it("answers nothing for a key it does not hold", async () => {
    expect(await getImage("jamais-vue")).toBeUndefined();
  });

  it("answers nothing once the key has been removed", async () => {
    await putImage("b", new Blob(["png"]));
    await deleteImage("b");
    expect(await getImage("b")).toBeUndefined();
  });

  it("still hands back a real result when there is one", async () => {
    /* The fallback must not swing the other way: a request WITH a
       result keeps answering with it. */
    await putImage("c", new Blob(["png"]));
    expect(await allImageKeys()).toEqual(["c"]);
  });
});
