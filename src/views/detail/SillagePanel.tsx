/* ============================================================
   DANS LE SILLAGE — le panneau, au bas de la fiche

   Deux colonnes de même largeur, et c'est un parti pris : ce qu'on a
   déjà vaut autant que ce qu'on n'a pas. Une collection tenue depuis des
   années répond souvent mieux que le catalogue mondial à « quoi à côté
   de celui-là ? », parce qu'elle sait ce qu'on a aimé.

   La colonne de GAUCHE se dessine en synchrone, sans réseau, sans clé.
   La colonne de DROITE arrive après — et ne doit jamais faire sauter la
   gauche en arrivant, d'où la hauteur réservée.

   SANS CLÉ, LA COLONNE DE DROITE RESTE MONTÉE. La faire disparaître
   donnerait un panneau à une colonne qui a l'air complet, et l'on ne
   saurait jamais qu'il manque quelque chose ni comment l'obtenir.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Compass, Waves } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { Carton, Consigne, SansCle, TitreSection } from "../../components/ui";
import { PosterArt } from "../../components/film/PosterArt";
import { initialsOf } from "../../domain/film";
import { sillageMaison } from "../../domain/sillage";
import type { Voisin } from "../../domain/sillage";
import { fusionnerLoin, déjàDansLeClasseur } from "../../domain/sillageLoin";
import type { VoisinLoin } from "../../domain/sillageLoin";
import { récolterLeSillage } from "../../services/sillage";
import { useTmdbKey } from "../../services/tmdbKey";
import { POSTER_BASE } from "../../tmdb";
import type { Film } from "../../types";

/* La hauteur réservée sous chaque titre de colonne. Les deux colonnes
   se remplissent à des instants différents — l'une tout de suite,
   l'autre au retour du réseau — et sans plancher la page se réagencerait
   sous le curseur au moment où l'on va cliquer. */
const HAUTEUR_MINIMALE = 220;

const COMBIEN = 6;

/* ------------------------------------------------------------
   UNE PROPOSITION — l'affiche, le titre, et POURQUOI
   ------------------------------------------------------------

   La raison n'est pas un ornement : c'est tout ce que le panneau
   apporte. Une liste d'affiches sans raisons est un rayon de plus ; avec
   elles, c'est un argument, et l'on peut être en désaccord — ce qui
   suppose d'avoir compris. */
function Proposition({
  titre,
  année,
  raison,
  affiche,
  onClick,
  aside,
}: {
  titre: string;
  année: number | string | null;
  raison: string;
  affiche: ReactNode;
  onClick?: () => void;
  /** Une mention à droite du titre : « à voir », par exemple. */
  aside?: string;
}) {
  const contenu = (
    <>
      {/* LA CASE DE L'AFFICHE EST POSITIONNÉE, ET ELLE A UNE TAILLE.

          `PosterArt` en mode `plain` se pose en `position: absolute;
          inset: 0` — il attend du contenant qu'il impose ses dimensions.
          Sans `position: relative` ici, l'affiche remontait jusqu'au
          premier ancêtre positionné et s'étalait en travers de la page
          entière, en vignette de 185 px étirée sur mille : une immense
          image floue au milieu de la fiche. */}
      <div
        style={{
          position: "relative",
          width: 44,
          height: 66, // le 2:3 d'une affiche
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {affiche}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: F.title,
            fontWeight: 700,
            fontSize: 14.5,
            color: C.ink,
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</span>
          {aside && (
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.ochre, flexShrink: 0 }}>
              {aside}
            </span>
          )}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 1 }}>
          {année || "s.d."}
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 13.5,
            color: C.inkFaded,
            marginTop: 3,
            lineHeight: 1.35,
          }}
        >
          {raison}
        </div>
      </div>
    </>
  );

  const style: CSSProperties = {
    display: "flex",
    gap: 10,
    padding: "8px 4px",
    borderBottom: `1px dashed ${C.line}`,
    alignItems: "flex-start",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
  };

  if (!onClick) return <div style={style}>{contenu}</div>;
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        ...style,
        cursor: "pointer",
        transition: "background var(--motion-fast) ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = alpha(C.ochre, 0.09);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {contenu}
    </button>
  );
}

/* L'AFFICHE D'UNE FICHE DU CLASSEUR, EN TOUT PETIT.

   `PosterArt` sait tout faire — l'affiche rangée dans IndexedDB, le
   repli, le grain — mais sa substitution est taillée pour les boîtiers
   de l'étagère : elle écrit les initiales à quarante pixels, ce qui
   déborde d'une case de quarante-quatre. On ne l'appelle donc que
   lorsqu'il y a vraiment une affiche, et l'on écrit les initiales
   nous-mêmes, à notre échelle, dans le cas contraire. */
function Vignette({ film }: { film: Film }) {
  if (film.poster) return <PosterArt film={film} initials={initialsOf(film.title)} plain />;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(160deg, ${hueOf(film.id)}, #1c1712)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: F.title,
        fontStyle: "italic",
        fontSize: 15,
        color: "#f3ead8cc",
      }}
    >
      {initialsOf(film.title)}
    </div>
  );
}

/* Ce qu'on dit d'une colonne vide. Jamais rien : une colonne muette se
   lit « c'est cassé », et l'on ne saura pas que c'est simplement le
   classeur qui est encore petit. */
function Rien({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 14,
        color: C.inkFaded,
        padding: "14px 4px",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

export function SillagePanel({
  film,
  films,
  onOpen,
}: {
  film: Film;
  films: Film[];
  /** Ouvre une fiche de la collection. */
  onOpen: (id: string) => void;
}) {
  const apiKey = useTmdbKey();

  /* La moitié maison : pure, synchrone, et recalculée seulement quand la
     collection ou le pivot bougent — pas à chaque frappe dans un champ
     de la fiche, ce qui rejouerait le tri sur cinq cents fiches. */
  const chezVous: Voisin[] = useMemo(() => sillageMaison(film, films, COMBIEN), [film, films]);

  const [dehors, setDehors] = useState<VoisinLoin[] | null>(null);
  const [cherche, setCherche] = useState(false);

  const déjàLà = useMemo(() => déjàDansLeClasseur(films), [films]);

  useEffect(() => {
    setDehors(null);
    if (!apiKey) return;
    let vivant = true;
    setCherche(true);
    récolterLeSillage(film, apiKey)
      .then((récoltes) => {
        if (!vivant) return;
        setDehors(fusionnerLoin(récoltes, { déjàLà, combien: COMBIEN }));
      })
      /* Un échec réseau rend une liste VIDE et non `null` : la colonne
         doit dire « rien trouvé » plutôt que tourner indéfiniment. */
      .catch(() => {
        if (vivant) setDehors([]);
      })
      .finally(() => {
        if (vivant) setCherche(false);
      });
    return () => {
      vivant = false;
    };
  }, [film, apiKey, déjàLà]);

  return (
    <Carton tour="detail-sillage" style={{ marginTop: 18 }}>
      <TitreSection icon={<Waves size={15} color={C.cobalt} />}>Dans le sillage</TitreSection>
      <Consigne>
        ce qui tient de « {film.title} » — par l&apos;équipe, les motifs, les gens à l&apos;affiche
      </Consigne>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 22,
          marginTop: 14,
        }}
      >
        {/* ---- CHEZ VOUS ---- */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.burgundy,
              marginBottom: 4,
            }}
          >
            CHEZ VOUS
          </div>
          <div style={{ minHeight: HAUTEUR_MINIMALE }}>
            {chezVous.length ? (
              chezVous.map((v) => (
                <Proposition
                  key={v.clé}
                  titre={v.film.title}
                  année={v.film.year}
                  raison={v.raison}
                  aside={v.film.status === "watchlist" ? "à voir" : undefined}
                  onClick={() => onOpen(v.film.id)}
                  affiche={<Vignette film={v.film} />}
                />
              ))
            ) : (
              <Rien>
                Rien dans le classeur ne tient encore de celui-ci. Les rapprochements se font sur
                l&apos;équipe, les motifs et les gens à l&apos;affiche : compléter les fiches par
                TMDB en fait apparaître beaucoup d&apos;un coup.
              </Rien>
            )}
          </div>
        </div>

        {/* ---- AILLEURS ---- */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.cobalt,
              marginBottom: 4,
            }}
          >
            AILLEURS
          </div>
          <div style={{ minHeight: HAUTEUR_MINIMALE }}>
            {!apiKey ? (
              <SansCle quoi="chercher au-dehors ce qui tient de ce film" />
            ) : cherche ? (
              <Rien>
                <Compass size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                on regarde du côté de l&apos;équipe…
              </Rien>
            ) : dehors?.length ? (
              dehors.map((v) => (
                <Proposition
                  key={v.clé}
                  titre={v.title}
                  année={v.year}
                  raison={v.raison}
                  affiche={
                    v.poster ? (
                      <img
                        src={`${POSTER_BASE}${v.poster}`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: alpha(C.ink, 0.08),
                          border: `1px solid ${C.line}`,
                        }}
                      />
                    )
                  }
                />
              ))
            ) : (
              <Rien>
                Rien de ce côté — soit ce film n&apos;a pas d&apos;équipe renseignée sur TMDB, soit
                tout ce qu&apos;on trouve est déjà chez vous.
              </Rien>
            )}
          </div>
        </div>
      </div>
    </Carton>
  );
}
