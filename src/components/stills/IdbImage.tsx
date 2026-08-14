import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { holdMedia, releaseMedia } from "../../services/media";
import { accountOpen, watchAccount } from "../../services/server";

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

/* A hold that failed holds nothing, so there is nothing to release. It
   still has to be caught: an untouched rejection is an unhandled one. */
const ignore = (): void => {};

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
  const { t } = useTranslation();
  const [state, setState] = useState<"cherche" | "trouvée" | "absente">("cherche");
  const [url, setUrl] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [large, setLarge] = useState(true);

  /* ASKING AGAIN WHEN THE ACCOUNT ARRIVES.
   *
   * `readMedia` falls back on the mirror, and the mirror needs an
   * account: `pullMedia` refuses outright while `accountOpen()` is false,
   * and `remotePath` has no private prefix to build without the person's
   * identifier. On a machine that has JUST signed in, both are false for
   * the length of the first `/me` round trip — and every image mounted in
   * that window settled on "absente" and never asked again. A binder
   * opened on a second computer therefore showed "restée sur l'autre
   * appareil" over screenshots sitting in the container, for the whole
   * session.
   *
   * So the lookup depends on the answer to "is an account open", exactly
   * as `tmdbKey` does — signing in re-runs it, without a reload. */
  const signedIn = useSyncExternalStore(watchAccount, accountOpen);

  useEffect(() => {
    let alive = true;
    setState("cherche");
    /* THE VAULT FIRST, THE MIRROR NEXT. `holdMedia` looks here, and only
       goes asking the container if the image is not here — so this
       screen no longer needs to know that a container exists at all.

       WHICH IS WHY "absente" NOW MEANS SOMETHING ELSE than it did: not
       "it is on the other device", but "it is nowhere we can reach".
       Before the mirror, those two were the same sentence.

       And it HOLDS rather than reads: a strip of stills mounts and
       unmounts its thumbnails as one scrolls the fiche, and the same
       twenty images were being read out of the vault again each time.
       One release per successful hold, through the same promise — see
       `PosterArt` for why it cannot be done beside it. */
    const wait = holdMedia(imageKey);
    void wait
      .then((objectUrl) => {
        if (!alive) return;
        if (!objectUrl) {
          setState("absente");
          return;
        }
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
      void wait.then((objectUrl) => {
        if (objectUrl) releaseMedia(imageKey);
      }, ignore);
    };
  }, [imageKey, signedIn]);

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
      title={t("stills.notSynced")}
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
