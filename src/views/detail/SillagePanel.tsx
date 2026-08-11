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
import { Bookmark, Compass, Waves } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { Carton, Consigne, SansCle, TitreSection } from "../../components/ui";
import { PosterArt } from "../../components/film/PosterArt";
import { initialsOf, makeFilm } from "../../domain/film";
import { sillageMaison } from "../../domain/sillage";
import type { Voisin } from "../../domain/sillage";
import { fusionnerLoin, déjàDansLeClasseur } from "../../domain/sillageLoin";
import type { VoisinLoin } from "../../domain/sillageLoin";
import { récolterLeSillage } from "../../services/sillage";
import { useTmdbKey } from "../../services/tmdbKey";
import { POSTER_BASE, directorOf } from "../../tmdb";
import type { Film } from "../../types";

/* La hauteur réservée sous chaque titre de colonne. Les deux colonnes
   se remplissent à des instants différents — l'une tout de suite,
   l'autre au retour du réseau — et sans plancher la page se réagencerait
   sous le curseur au moment où l'on va cliquer. */
const HAUTEUR_MINIMALE = 220;

/* DIX PAR COLONNE, ET PAS DE N'IMPORTE QUELLE SORTE.

   Cinq propositions tenues par les GENS qui ont fait les films, cinq par
   ce dont ils PARLENT. Sans ce partage, les noms propres — qui pèsent
   plus lourd, et à juste titre — raflaient la liste entière : on
   apprenait dix fois « même équipe » et jamais « même sujet ».

   Ce qu'une famille ne remplit pas revient à l'autre : une collection
   sans motifs ni mots-clés doit voir dix propositions, pas cinq. */
const QUOTAS = { gens: 5, sujets: 5 };

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
  dépli,
}: {
  titre: string;
  année: number | string | null;
  raison: string;
  affiche: ReactNode;
  onClick?: () => void;
  /** Une mention à droite du titre : « à voir », par exemple. */
  aside?: string;
  /** Ce qui se déplie sous la proposition quand on l'ouvre. */
  dépli?: ReactNode;
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
    alignItems: "flex-start",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
  };

  /* Le filet est sur l'ENVELOPPE et non sur la ligne : sinon il passerait
     entre la proposition et son dépli, qui se liraient alors comme deux
     entrées différentes. */
  return (
    <div style={{ borderBottom: `1px dashed ${C.line}` }}>
      {onClick ? (
        <button
          onClick={onClick}
          aria-expanded={dépli ? true : undefined}
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
      ) : (
        <div style={style}>{contenu}</div>
      )}
      {dépli}
    </div>
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

/* ------------------------------------------------------------
   EN SAVOIR PLUS SANS QUITTER LE CLASSEUR
   ------------------------------------------------------------

   Les propositions du dehors ne menaient nulle part : un titre, une
   affiche, une raison, et rien à en faire. On ne pouvait ni les
   retenir, ni même savoir de quoi elles parlaient — il fallait aller
   chercher ailleurs, c'est-à-dire sortir.

   Le dépli répond sur place. Le synopsis vient DÉJÀ avec le candidat
   (`toCandidate` en garde 240 signes) ; seul le réalisateur manque, et
   il est demandé à l'ouverture — un appel, pour le film qu'on regarde,
   et non quarante d'avance pour ceux qu'on n'ouvrira pas. */
function Dépli({
  v,
  réalisateur,
  déjàMis,
  onMettreDeCôté,
}: {
  v: VoisinLoin;
  réalisateur: string;
  déjàMis: boolean;
  onMettreDeCôté: () => void;
}) {
  return (
    <div style={{ padding: "2px 4px 12px 58px" }}>
      {réalisateur && (
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginBottom: 4 }}>
          {réalisateur.toUpperCase()}
        </div>
      )}
      {v.overview ? (
        <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>
          {v.overview}
        </div>
      ) : (
        <div style={{ fontFamily: F.hand, fontSize: 13.5, color: C.inkFaded }}>
          TMDB n&apos;en donne aucun résumé.
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 8,
        }}
      >
        <button
          onClick={onMettreDeCôté}
          disabled={déjàMis}
          style={{
            all: "unset",
            cursor: déjàMis ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            fontFamily: F.mono,
            fontSize: 10,
            borderRadius: "var(--tag-radius)",
            border: `1px solid ${déjàMis ? C.line : C.pine}`,
            color: déjàMis ? C.inkFaded : C.card,
            background: déjàMis ? "transparent" : C.pine,
          }}
        >
          <Bookmark size={11} /> {déjàMis ? "mis de côté" : "mettre de côté"}
        </button>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
          {v.voteAverage ? `${v.voteAverage.toFixed(1)} / 10 · ${v.voteCount} votes` : "pas noté"}
        </span>
      </div>
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
  onAddToWatchlist,
}: {
  film: Film;
  films: Film[];
  /** Ouvre une fiche de la collection. */
  onOpen: (id: string) => void;
  /** Range une proposition du dehors dans la liste « à voir ». */
  onAddToWatchlist?: (f: Film) => void;
}) {
  const apiKey = useTmdbKey();

  /* La moitié maison : pure, synchrone, et recalculée seulement quand la
     collection ou le pivot bougent — pas à chaque frappe dans un champ
     de la fiche, ce qui rejouerait le tri sur cinq cents fiches. */
  const chezVous: Voisin[] = useMemo(() => sillageMaison(film, films, QUOTAS), [film, films]);

  const [dehors, setDehors] = useState<VoisinLoin[] | null>(null);
  const [cherche, setCherche] = useState(false);
  /* La proposition dépliée — une seule à la fois : deux synopsis ouverts
     transformeraient la colonne en article. */
  const [ouvert, setOuvert] = useState<number | null>(null);
  /* Les réalisateurs déjà demandés, par identifiant TMDB. `discover` et
     `recommendations` rendent des films, pas des équipes : le nom se
     demande à part, et seulement pour celui qu'on ouvre. */
  const [réals, setRéals] = useState<Record<number, string>>({});
  const [misDeCôté, setMisDeCôté] = useState<Set<number>>(() => new Set());

  /* CE QU'ON POSSÈDE EST LU AU MOMENT DE LA RÉCOLTE, ET N'EST PAS SUIVI.

     `films` est volontairement absent des dépendances : c'est la
     fermeture de l'effet qui en garde l'instantané, pris au moment où
     la question a été posée. Deux raisons, qui vont dans le même sens.

     La première est un défaut : mettre une proposition de côté ajoute
     une fiche, donc change `films` — et l'effet se rejouait, repliant
     le synopsis qu'on venait tout juste d'ouvrir.

     La seconde est un choix : ce film-là DOIT rester à sa place. Le
     voir s'évanouir sous le curseur à l'instant où on le retient
     donnerait l'impression de l'avoir perdu. Il reste, marqué « à
     voir » — la liste répond à une question posée à l'ouverture, ce
     n'est pas un tableau de bord qui se réécrit tout seul. */
  useEffect(() => {
    setDehors(null);
    setOuvert(null);
    setMisDeCôté(new Set());
    if (!apiKey) return;
    let vivant = true;
    setCherche(true);
    récolterLeSillage(film, apiKey)
      .then((récoltes) => {
        if (!vivant) return;
        setDehors(fusionnerLoin(récoltes, { déjàLà: déjàDansLeClasseur(films), quotas: QUOTAS }));
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
    /* `film.id` et non `film` : retoucher une note ou poser un motif
       rend un nouvel objet, et refaire la récolte à chaque frappe
       viderait la colonne sous les yeux. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id, apiKey]);

  /* Déplier demande le réalisateur, une fois. Un échec ne dit rien : le
     dépli vaut déjà pour son synopsis et son bouton. */
  const déplier = (v: VoisinLoin) => {
    setOuvert((o) => (o === v.tmdbId ? null : v.tmdbId));
    if (réals[v.tmdbId] != null || !apiKey) return;
    directorOf(v.tmdbId, apiKey)
      .then((nom: string) => setRéals((r) => ({ ...r, [v.tmdbId]: nom })))
      .catch(() => {});
  };

  /* METTRE DE CÔTÉ FABRIQUE UNE VRAIE FICHE, pas un signet. On y range
     ce qu'on sait déjà — titre, année, affiche, identifiant, et le
     réalisateur s'il a été demandé — pour qu'elle parte nommée au lieu
     d'attendre un « compléter les fiches » qui redemanderait la même
     chose. C'est le même geste que le bureau des découvertes. */
  const mettreDeCôté = (v: VoisinLoin) => {
    onAddToWatchlist?.(
      makeFilm({
        title: v.title,
        year: v.year || "",
        poster: v.poster ? `${POSTER_BASE}${v.poster}` : "",
        director: réals[v.tmdbId] || "",
        status: "watchlist",
        tmdbId: v.tmdbId,
        source: "tmdb",
      })
    );
    setMisDeCôté((s) => new Set(s).add(v.tmdbId));
  };

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
                  aside={misDeCôté.has(v.tmdbId) ? "à voir" : undefined}
                  onClick={() => déplier(v)}
                  dépli={
                    ouvert === v.tmdbId ? (
                      <Dépli
                        v={v}
                        réalisateur={réals[v.tmdbId] || ""}
                        déjàMis={misDeCôté.has(v.tmdbId)}
                        onMettreDeCôté={() => mettreDeCôté(v)}
                      />
                    ) : undefined
                  }
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
