import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { getImage } from "../../db";

/* ============================================================
   AN IMAGE FROM THE VAULT — and what we show when it is not there
   ============================================================

   The stills and the posters imported from a disk live in IndexedDB, on
   the device that filed them. The CARD, on the other hand, travels: so a
   second device knows the list of a film's stills, their captions and
   their places, without owning a single one of the images.

   It then drew a rectangle of cardstock, mute. Reported in testing as a
   synchronisation fault — which was a REASONABLE reading: nothing on
   screen told "this image is not here" from "this image will not
   display". An empty frame with not a word always looks like a failure.

   So we say it, and we fit what we say to the room: a twenty-two pixel
   thumbnail can carry only a sign, a full-page still deserves a
   sentence. */

/* Below that, no sentence fits: we put a sign only, and the tooltip
   carries the rest. */
const BIG_ENOUGH = 120;

export function IdbImage({
  imageKey,
  alt = "",
  style,
  onClick,
}: {
  imageKey: string;
  alt?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  /* THREE STATES, AND NOT TWO. "No URL yet" covered both the read in
     progress and the definitive absence: announcing a missing image
     while we are still looking for it would make a reproach blink on
     every opening. */
  const [state, setState] = useState<"cherche" | "trouvée" | "absente">("cherche");
  const [url, setUrl] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [large, setLarge] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    setState("cherche");
    getImage(imageKey)
      .then((blob: Blob | undefined) => {
        if (!alive) return;
        if (!blob) {
          setState("absente");
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState("trouvée");
      })
      .catch(() => {
        /* The vault refuses — private mode, locked database. For
           whoever is looking, it is the same as a missing image. */
        if (alive) setState("absente");
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey]);

  useLayoutEffect(() => {
    if (state !== "absente" || !box.current) return;
    setLarge(box.current.getBoundingClientRect().width >= BIG_ENOUGH);
  }, [state]);

  if (state === "trouvée" && url) {
    return <img src={url} alt={alt} onClick={onClick} style={style} />;
  }

  /* While looking: the cardstock as before, without a word. It is a
     matter of a few milliseconds. */
  if (state === "cherche") return <div style={{ ...style, background: C.paperDark }} />;

  return (
    <div
      ref={box}
      onClick={onClick}
      title="Cette image est restée sur l'appareil qui l'a importée : les captures ne se synchronisent pas encore."
      style={{
        ...style,
        background: C.paperDark,
        border: `1px dashed ${alpha(C.inkFaded, 0.45)}`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: 8,
        color: alpha(C.inkFaded, 0.75),
        textAlign: "center",
      }}
    >
      <ImageOff size={large ? 20 : 12} aria-hidden />
      {large && (
        <span style={{ fontFamily: F.mono, fontSize: 9.5, lineHeight: 1.5 }}>
          restée sur l'autre appareil
        </span>
      )}
    </div>
  );
}
