/* ============================================================
   L'ÉVENTAIL — CE QU'UNE LISTE MONTRE D'ELLE-MÊME
   ============================================================

   UNE LISTE S'ANNONÇAIT PAR SON SEUL TITRE, partout où elle paraissait :
   sur le mur, dans le choix d'un défi, sur la carte d'un défi. Dans une
   VIDÉOTHÈQUE. La cause était en base et elle est levée
   (`006_list_poster.sql`) ; ce fichier en est la conséquence visible.

   IL EST SORTI DE `Shelf` PARCE QU'IL A TROIS APPELANTS, et pas avant :
   le mur, le premier pas de l'assistant, et la carte d'un défi bâti sur
   une liste. Écrit trois fois, il aurait divergé trois fois — la
   première copie montrait déjà quatre affiches là où les deux autres
   n'en montraient qu'une.

   TROIS AFFICHES, EN RECOUVREMENT, ET C'EST TOUT CE QU'IL PROMET. Un
   éventail dit « il y en a d'autres dessous » ; trois affiches alignées
   diraient « il y en a trois », ce qui serait faux pour une liste de
   trente. Le NOMBRE est écrit à côté, par l'appelant, et l'éventail n'a
   donc rien à annoncer au lecteur d'écran — d'où `aria-hidden` sur le
   tout.

   LE DÉSORDRE EST SEMÉ, jamais tiré au sort (`domain/seeded`) : un mur
   qui gigote à chaque rendu n'est pas un mur.
   ============================================================ */
import { C, alpha } from "../../theme/tokens";
import { tiltOf } from "../../domain/seeded";
import { posterUrl } from "../../tmdb";

/** Combien d'affiches au plus. Le serveur en rend autant, et pas une de
    plus : ce qui n'est pas montré n'a pas à voyager. */
export const FAN_OF = 3;

export function Fan({
  posters,
  seed,
  /** La hauteur d'une affiche. Une seule mesure : la largeur en découle
      (2:3) et le recouvrement aussi, sinon trois tailles d'appel
      donneraient trois éventails aux proportions différentes. */
  height = 72,
}: {
  posters: string[];
  seed: string;
  height?: number;
}) {
  const width = Math.round((height * 2) / 3);
  /* Le pas du recouvrement : les deux tiers d'une affiche. Assez pour
     qu'on voie qu'il y en a plusieurs, assez peu pour qu'on lise la
     première. */
  const step = Math.round(width * 0.62);

  /* CE QU'ON MONTRE QUAND IL N'Y A RIEN À MONTRER — et il y a deux
     « rien » différents ici : une liste VIDE (on n'y a rien rangé) et
     une liste dont aucune œuvre ne porte d'affiche (rangée avant que la
     colonne existe, ou maigre chez TMDB). Les deux donnent la même image
     de remplacement, et c'est voulu : la seconde se comble d'elle-même
     au prochain rangement, donc rien ici ne doit laisser croire à un
     défaut. */
  if (posters.length === 0) {
    return (
      <div
        aria-hidden
        style={{
          height,
          width: width + step * (FAN_OF - 1),
          flexShrink: 0,
          background: `repeating-linear-gradient(-45deg, ${alpha(C.line, 0.5)} 0 5px, transparent 5px 10px)`,
          border: `1px dashed ${C.line}`,
        }}
      />
    );
  }

  const shown = posters.slice(0, FAN_OF);

  return (
    <div
      aria-hidden
      style={{
        height,
        /* La largeur suit CE QUI EST MONTRÉ et non le maximum : une
           liste d'une seule affiche ne doit pas réserver la place de
           trois, sinon la ligne qui la suit part au large. */
        width: width + step * (shown.length - 1),
        flexShrink: 0,
        position: "relative",
      }}
    >
      {shown.map((p, i) => (
        <img
          key={p}
          src={posterUrl(p)}
          alt=""
          loading="lazy"
          style={{
            position: "absolute",
            left: i * step,
            top: 0,
            height,
            width,
            objectFit: "cover",
            border: `1px solid ${C.line}`,
            background: C.paperDark,
            boxShadow: "1px 2px 5px rgba(30,20,10,0.18)",
            transform: `rotate(${Number(tiltOf(`${seed}${i}`)) / 4}deg)`,
            /* La PREMIÈRE est au-dessus : c'est celle qu'on lit, et
               l'empilement doit aller dans le sens de la lecture. */
            zIndex: FAN_OF - i,
          }}
        />
      ))}
    </div>
  );
}
