import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layer } from "../ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { ShotImage, type Shot } from "./shots";

/* ============================================================
   QUAND LA SURFACE EST FIXE, L'ENCRE DOIT L'ÊTRE AUSSI

   Le voile de cette visionneuse est peint EN DUR — `rgba(20,15,10,0.88)`,
   plus bas — et tout ce qui se posait dessus prenait `C.paper`, un jeton
   que les peaux réécrivent. Or `paper` est SOMBRE sur huit des dix-sept
   peaux (`#0E2A47`, `#171310`, `#14161A`, `#211E1B`…). Sous celles-là,
   disparaissaient d'un coup la légende, le compteur, la ligne du bas,
   les deux flèches ET la croix de fermeture : la lanterne devenait une
   image sans commandes visibles, et rien ne pouvait le dire.

   C'est le symétrique exact de la leçon de `dormantVeil` — « un aplat
   clair sur une affiche devenait une TACHE ». Un jeton n'a de sens que
   sur un fond qui bascule AVEC lui.

   CES DEUX CONSTANTES NE SONT DONC PAS DES JETONS, ET N'ONT PAS À EN
   DEVENIR. Elles sont la contrepartie d'une surface écrite en dur trois
   lignes plus bas, et elles ne quittent pas ce fichier. Les « corriger »
   en `C.paper` ramènerait le défaut entier.
   ============================================================ */
const LANTERN_INK = "#F4EFE6";
const LANTERN_DEEP = "rgba(20,15,10,0.88)";

const ARROW_COL = {
  all: "unset",
  ...tap,
  cursor: "pointer",
  width: "16%",
  minWidth: 90,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: `${alpha(LANTERN_INK, 0.75)}`,
  fontSize: 44,
  fontFamily: F.title,
} as const;

/* The full-screen viewer, with keyboard navigation.

   LA SEULE DU PRODUIT, DÉSORMAIS. Elle regardait vos captures ; les
   plans de TMDB en avaient une seconde, qui redessinait le même voile,
   les mêmes flèches et le même compteur — deux visionneuses à corriger
   au lieu d'une. Ce qui les séparait n'était pas l'affichage mais la
   PROVENANCE de l'image, et `Shot` la porte. */
export function StillLightbox({
  shots,
  index,
  title,
  onClose,
  onIndex,
}: {
  shots: Shot[];
  index: number;
  /** De quoi ces images sont les images. Sert à NOMMER la couche. */
  title?: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const { t } = useTranslation();
  const shot = shots[index];
  /* `useDialog` PIÈGE LE FOCUS ET LE REND, ce que cette visionneuse ne
     faisait pas : on l'ouvrait au clavier et le curseur restait derrière
     le voile. Il prend aussi Escape en charge — d'où l'effet ci-dessous
     réduit aux seules flèches. La planche des plans l'avait ; c'est le
     genre de qualité qu'une fusion perd si personne ne compare. */
  const box = useDialog(onClose);

  /* ON NE BOUCLE PAS, ET C'EST UNE DÉCISION : on doit sentir qu'on est
     au bout. Les captures bouclaient, les plans butaient ; la règle qui
     porte une raison écrite l'emporte sur celle qui n'en portait pas. */
  const step = (to: number) => onIndex(Math.max(0, Math.min(shots.length - 1, to)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(index + 1);
      if (e.key === "ArrowLeft") step(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* THE PAGE BEHIND DOES NOT SCROLL.

     The viewer takes the whole screen, but the film's card stays
     underneath with all its height: the vertical bar went on showing at
     the edge, and the wheel slid a page nobody can see. An image looked
     at large is a full screen, not a window laid over something else.

     On `html` and not on `body`: it is the root element's overflow that
     propagates to the window. The previous value is put back as it was —
     empty most of the time, and the style sheet takes over again. */
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflowY;
    root.style.overflowY = "hidden";
    return () => {
      root.style.overflowY = before;
    };
  }, []);
  if (!shot) return null;

  return (
    <Layer>
      {/* CE COMMENTAIRE S'AFFICHAIT. Écrit sans accolades, il n'était pas
          un commentaire mais du TEXTE JSX : la visionneuse posait ses
          trente mots de code anglais au-dessus de l'image, à côté de la
          légende, sur chaque agrandissement. Rien ne pouvait le dire —
          ni le typage, ni le lint, ni un test qui ne lit pas ce que la
          couche écrit.

          Ce qu'il dit reste vrai : la fermeture ne part que du VOILE
          lui-même (`e.target` === `e.currentTarget`) et jamais de ce
          qu'il contient, pour qu'un clic à côté de l'image ne referme
          pas la visionneuse par accident. */}
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title ? t("frames.plate", { title }) : t("stills.theFilmStrip")}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: LANTERN_DEEP,
          zIndex: 80,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
        }}
      >
        {/* `all: unset` puts the button back to inline: without `flex`, the vertical
          padding does not count and the target stays a thin strip */}
        {/* ELLE NE SE POSE PAS SUR LE VOILE, MAIS SUR L'IMAGE.

            Une croix claire sans fond disparaît sur un plan clair — et un
            agrandissement montre justement une image, pas le voile. Elle
            porte donc son propre disque, de la même encre profonde que le
            voile : elle se lit sur n'importe quel plan sans avoir à
            deviner ce qu'il y a dessous.

            `tap` RESTE. La cible tactile de quarante-quatre pixels ne se
            négocie pas ; le disque est plus petit qu'elle, et c'est le
            `padding` qui tient la cible. */}
        <button
          onClick={onClose}
          title={t("stills.close")}
          style={{
            all: "unset",
            ...tap,
            position: "absolute",
            top: 10,
            right: 14,
            cursor: "pointer",
            color: LANTERN_INK,
            padding: 11,
            borderRadius: "50%",
            background: LANTERN_DEEP,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <X size={24} />
        </button>

        {/* full-height navigation columns: a wide target, not a chevron */}
        {shots.length > 1 && (
          <button
            onClick={() => step(index - 1)}
            title={t("stills.previous")}
            style={ARROW_COL}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = LANTERN_INK;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${alpha(LANTERN_INK, 0.75)}`;
            }}
          >
            ‹
          </button>
        )}

        {/* the central area is entirely safe, margins included */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px 10px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              background: C.card,
              padding: 10,
              boxShadow: "0 14px 40px rgba(0,0,0,0.6)",
              maxWidth: "100%",
            }}
          >
            <ShotImage
              shot={shot}
              big
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "72vh",
                objectFit: "contain",
              }}
            />
          </div>
          <div
            /* LA CURSIVE QUITTE LA LÉGENDE, et ce n'est pas un avis sur
               le goût. Ce fichier a déjà écrit la règle ailleurs : elle
               est « jolie sur une ligne, LENTE dans un bloc ». Une
               légende de capture est de la LECTURE, pas une signature —
               et à vingt et un pixels sur un fond sombre, la cursive
               coûtait le double de ce qu'elle apportait. Qui la veut
               partout a `theme/handwriting.ts` ; ici c'est le fond qui
               tranche. */
            style={{
              fontFamily: F.body,
              fontSize: 19,
              color: LANTERN_INK,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {shot.caption || t("stills.shotNumber", { n: index + 1 })}
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                /* SECONDAIRE, PAS ABSENT. Sept dixièmes d'une encre qui
                   était sombre ne faisaient rien ; sept dixièmes d'une
                   encre claire suffisent, mais sur un voile à 88 % on
                   remonte encore un peu. */
                opacity: 0.82,
                marginLeft: 10,
              }}
            >
              {t("frames.count", { place: index + 1, total: shots.length })}
            </span>
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 10.5,
              /* QUATRE DIXIÈMES NE SE LISENT PAS, même en clair, sur un
                 voile à 88 % et à neuf pixels et demi. C'est une
                 indication et non un secret. */
              color: `${alpha(LANTERN_INK, 0.62)}`,
              marginTop: 10,
              letterSpacing: 1,
            }}
          >
            {t("stills.escToClose")}
          </div>
        </div>

        {shots.length > 1 && (
          <button
            onClick={() => step(index + 1)}
            title={t("stills.next")}
            style={ARROW_COL}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = LANTERN_INK;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${alpha(LANTERN_INK, 0.75)}`;
            }}
          >
            ›
          </button>
        )}
      </div>
    </Layer>
  );
}
