import { useEffect, useState } from "react";
import { getImage } from "../../db";
import type { Still } from "../../types";

/* The stills' object URLs, shared: the same blob serves the strip, the
   inline thumbnails and the viewer. Revoked on unmount. */
export function useStillUrls(stills: Still[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const keys = (stills || []).map((s) => s.key).join("|");
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    Promise.all(
      (stills || []).map(async (s): Promise<[string, string] | null> => {
        // thumbnail if there is one: no point decoding 4K for 110 px
        const blob =
          (await getImage(s.thumbKey || s.key).catch(() => null)) ||
          (await getImage(s.key).catch(() => null));
        if (!blob) return null;
        const u = URL.createObjectURL(blob);
        made.push(u);
        return [s.key, u];
      })
    ).then((pairs) => {
      if (!alive) {
        made.forEach(URL.revokeObjectURL);
        return;
      }
      setUrls(Object.fromEntries(pairs.filter((p): p is [string, string] => p !== null)));
    });
    return () => {
      alive = false;
      made.forEach(URL.revokeObjectURL);
    };
    // `keys` sums the list up: it is what says whether the stills changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return urls;
}
