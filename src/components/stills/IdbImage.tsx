import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { getImage } from "../../db";

/* ============================================================
   UNE IMAGE DU COFFRE — et ce qu'on montre quand elle n'y est pas
   ============================================================

   Les captures et les affiches importées depuis un disque vivent en
   IndexedDB, sur l'appareil qui les a rangées. La FICHE, elle, voyage :
   un second appareil connaît donc la liste des captures d'un film, leur
   légende et leur place, sans posséder une seule des images.

   Il rendait alors un rectangle de carton, muet. Signalé en essai comme
   un défaut de synchronisation — ce qui était une lecture RAISONNABLE :
   rien à l'écran ne distinguait « cette image n'est pas ici » de « cette
   image ne s'affiche pas ». Un cadre vide sans un mot ressemble toujours
   à une panne.

   On le dit donc, et l'on adapte le propos à la place : une vignette de
   vingt-deux pixels ne peut porter qu'un signe, une capture pleine page
   mérite une phrase. */

/* En dessous, aucune phrase ne tient : on ne met qu'un signe, et
   l'infobulle porte le reste. */
const ASSEZ_GRAND = 120;

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
  /* TROIS ÉTATS, ET NON DEUX. « Pas encore d'URL » couvrait à la fois la
     lecture en cours et l'absence définitive : annoncer une image
     manquante pendant qu'on la cherche ferait clignoter un reproche à
     chaque ouverture. */
  const [état, setÉtat] = useState<"cherche" | "trouvée" | "absente">("cherche");
  const [url, setUrl] = useState<string | null>(null);
  const boîte = useRef<HTMLDivElement | null>(null);
  const [large, setLarge] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let vivant = true;
    setÉtat("cherche");
    getImage(imageKey)
      .then((blob: Blob | undefined) => {
        if (!vivant) return;
        if (!blob) {
          setÉtat("absente");
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setÉtat("trouvée");
      })
      .catch(() => {
        /* Le coffre refuse — mode privé, base verrouillée. Pour qui
           regarde, c'est la même chose qu'une image absente. */
        if (vivant) setÉtat("absente");
      });
    return () => {
      vivant = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey]);

  useLayoutEffect(() => {
    if (état !== "absente" || !boîte.current) return;
    setLarge(boîte.current.getBoundingClientRect().width >= ASSEZ_GRAND);
  }, [état]);

  if (état === "trouvée" && url) {
    return <img src={url} alt={alt} onClick={onClick} style={style} />;
  }

  /* Pendant la recherche : le carton d'avant, sans un mot. C'est
     l'affaire de quelques millisecondes. */
  if (état === "cherche") return <div style={{ ...style, background: C.paperDark }} />;

  return (
    <div
      ref={boîte}
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
