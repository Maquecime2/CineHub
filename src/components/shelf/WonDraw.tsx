/* ============================================================
   LE DESSIN D'UN OBJET GAGNÉ
   ============================================================

   Il porte la même signature que les dessins maison et que
   `CustomDraw` — `({ color, style })` — et c'est tout l'intérêt :
   `DecorItem`, `WallItem` et le cabinet appellent un composant sans
   savoir d'où vient le trait.

   DEUX ORIGINES, ET LA BARRE OBLIQUE LES SÉPARE. Les onze objets de
   départ sont DESSINÉS, dans le même carré de cent unités et le même
   trait que le reste du carnet : leur `media` est un nom. Ceux qu'un
   administrateur ajoute sont des IMAGES rangées dans le stock commun :
   leur `media` est un chemin.

   L'IMAGE PASSE PAR UNE BALISE `img`, ET C'EST LA DÉCISION QUI COMPTE.
   Un SVG déposé par quelqu'un est du balisage arbitraire ; injecté en
   ligne, il s'exécute dans le document — c'est pour cela que les décors
   déposés repassent par `sanitizeSvg` à la réception. Dans un `img`, le
   même fichier n'a ni script, ni accès au document qui l'affiche : le
   navigateur l'isole lui-même, et il n'y a rien à assainir parce qu'il
   n'y a rien à atteindre. C'est plus sûr que le nettoyage, pas moins.

   LA CONTREPARTIE EST QUE LA COULEUR NE LUI PARLE PLUS. Une image dans
   un `img` ne prend pas l'encre du thème ; c'est `tintable` qui le dit,
   depuis la base, et le panneau de réglages n'offre alors pas la
   teinte. Les onze dessinés, eux, restent teintables.

   LE TICKET EST DEMANDÉ UNE FOIS PAR CLÉ, et gardé : une étagère de
   trente objets ouverte trois fois ne signe pas quatre-vingt-dix URL.
   ============================================================ */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { wonDecorByKey } from "../../services/wonDecor";
import { DRAWINGS } from "./wonDrawings";
import { C, alpha } from "../../theme/tokens";

const signed = new Map<string, Promise<string | null>>();

function ticketFor(path: string): Promise<string | null> {
  const had = signed.get(path);
  if (had) return had;
  const asked = import("../../services/server").then((m) => m.mediaTicket(path)).catch(() => null);
  signed.set(path, asked);
  return asked;
}

/** La place d'un objet dont le dessin manque : un carré lavé, muet. */
function Ghost({ color, style }: { color?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 2,
        background: alpha(color || C.ink, 0.1),
        border: `1px dashed ${alpha(color || C.ink, 0.28)}`,
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

export function WonDraw({
  motif,
  media: given,
  color,
  style,
}: {
  motif: string;
  /**
   * Le média, quand l'appelant le tient déjà.
   *
   * SANS LUI, LE DESSIN DÉPEND DU CACHE D'UN AUTRE ÉCRAN. `wonDecorByKey`
   * lit ce que la dernière lecture de l'étal a rapporté : une vignette
   * qu'on VIENT de déposer n'y est pas, une vignette RETIRÉE non plus.
   * Le studio affichait donc des carrés vides à l'endroit précis où il
   * faut voir ce qu'on publie. Il tient `media` dans sa propre réponse ;
   * il le passe.
   */
  media?: string;
  color?: string;
  style?: CSSProperties;
}) {
  const spec = wonDecorByKey(motif);
  const media = given ?? spec?.media;
  const remote = !!media && media.includes("/");
  const [url, setUrl] = useState<string | null>(null);
  /* UNE IMAGE QUI NE VIENT PAS NE DOIT PAS LAISSER UNE ICÔNE CASSÉE.

     Elle ne vient pas pour trois raisons au moins : le container n'est
     pas réglé sur ce serveur, le ticket a été refusé, ou le fichier
     n'a jamais été déposé. Aucune n'est réparable par la personne qui
     regarde son étagère, et le petit rectangle brisé du navigateur est
     la pire façon de le lui dire — il ressemble à un objet perdu.

     On retombe donc sur une silhouette muette, qui garde la place et ne
     promet rien. C'est la même règle que le dessin inconnu juste en
     dessous. */
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!remote || !media) return;
    let alive = true;
    setBroken(false);
    ticketFor(`bank/${media}`).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [remote, media]);

  if (!media) return null;

  if (remote) {
    /* Rien tant que le ticket n'est pas là : une case qui clignote entre
       un repli et une image est pire qu'une case qui attend. */
    if (!url || broken) return <Ghost color={color} style={style} />;
    return (
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          ...style,
        }}
      />
    );
  }

  const draw = DRAWINGS[media ?? ""];
  /* UN OBJET VENU D'UN SERVEUR PLUS RÉCENT NE CASSE PAS L'ÉTAGÈRE. Le
     catalogue vit là-bas ; un classeur qui n'a pas été rechargé peut
     recevoir un nom de dessin qu'il ne connaît pas, et une silhouette
     vaut mieux qu'un écran blanc. */
  if (!draw) return <Ghost color={color} style={style} />;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke={color || C.ink}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", width: "100%", height: "100%", overflow: "visible", ...style }}
    >
      {draw(color || C.ink)}
    </svg>
  );
}
