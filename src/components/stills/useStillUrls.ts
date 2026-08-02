import { useEffect, useState } from "react";
import { getImage } from "../../db";
import type { Still } from "../../types";

/* Les URL d'objet des captures, mutualisées : le même blob sert la bande,
   les vignettes en ligne et la visionneuse. Révoquées au démontage. */
export function useStillUrls(stills: Still[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const keys = (stills || []).map((s) => s.key).join("|");
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    Promise.all(
      (stills || []).map(async (s): Promise<[string, string] | null> => {
        // vignette si elle existe : inutile de décoder du 4K pour 110 px
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
    // `keys` résume la liste : c'est lui qui dit si les captures ont changé
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return urls;
}
