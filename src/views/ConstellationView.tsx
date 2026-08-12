import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  Dispatch,
  SetStateAction,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Sparkles, Users, Spool } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { tap } from "../theme/styles";
import {
  buildSky,
  buildSkyWithCrew,
  neighbourhood,
  relax,
  neighbourInDirection,
} from "../domain/sky";
import type { Direction } from "../domain/sky";
import { CoffeeRing, StampCorner, InkUnderline } from "../components/atmosphere";
import type { Film, KinshipRole, LinkType, PlacedNode, SkyLink, SkyNode } from "../types";
import { Label } from "../components/ui";
import { TagChip } from "../components/ui/TagEditor";
import { catInk } from "../theme/palette";
import { relationDef, strengthOf } from "../domain/relations";
import { linkTypeOf } from "../components/film/linkTypes";
import { motifById } from "../domain/motifs";
import { searchFilms } from "../domain/search";
import type { Thread } from "../domain/threads";

/* ============================================================
   VUE — CONSTELLATION : une carte du ciel tracée à l'encre.
   Chaque film est une étoile, chaque œuvre liée un astre plus
   discret. Une œuvre citée par deux films devient un pont : c'est
   là que les constellations se forment.
   ============================================================ */
const LEGEND: [LinkType, string][] = [
  ["film", "Film"],
  ["book", "Livre"],
  ["painting", "Peinture"],
  ["other", "Autre œuvre"],
];

const LINK_INK: Record<LinkType, string> = {
  film: C.burgundy,
  book: C.cobalt,
  painting: C.moss,
  other: C.ochre,
};

/* UNE ENCRE PAR NATURE DE PARENTÉ. « Decaë » ne dit rien ; « image ·
   Decaë » dit qu'on suit un chef opérateur, et la couleur le dit sans
   qu'on ait à lire. `thème` est à part — c'est la seule qui vienne de
   vous et non d'un générique — d'où l'encre de l'identité. */
const KIN_INK: Record<KinshipRole, string> = {
  réalisation: C.slate,
  interprétation: C.ochre,
  image: C.cobalt,
  musique: C.moss,
  scénario: C.pine,
  thème: C.burgundy,
};

/** L'encre d'un fil suggéré : celle de sa première raison. */
const inkOf = (l: SkyLink): string => {
  const r = l.why?.[0]?.role;
  return r ? KIN_INK[r] : C.slate;
};
export function ConstellationView({
  films,
  onOpen,
  onLinkFilm,
  fils = [],
}: {
  films: Film[];
  onOpen: (id: string) => void;
  /** Fixer une parenté suggérée : elle devient un vrai fil rouge, réciproque. */
  onLinkFilm?: (fromId: string, toId: string, note?: string) => void;
  /** Les rassemblements nommés — « les films où le héros meurt ». */
  fils?: Thread[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  /** Le fil visé, par son rang — de quoi l'épaissir et l'étiqueter. */
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, PlacedNode>>({});
  const svgRef = useRef<SVGSVGElement | null>(null);
  // d'où le pointeur est parti : au-delà de quelques pixels, c'est un glissé, pas un clic
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  const allTags = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.themes || []))).sort(),
    [films]
  );
  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );
  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (v: string) =>
    setter((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  /* SUIVRE LES ÉQUIPES — éteint par défaut, et ce n'est pas de la
     timidité : la carte à la main est la promesse de cet écran, et une
     seconde couche allumée d'office ferait passer pour vôtre ce qui
     vient de la machine. On l'allume quand on veut voir plus loin. */
  const [équipes, setÉquipes] = useState(false);

  /* LE FOYER — le remède au fouillis, et il n'est pas graphique.

     Un graphe de deux cents astres ne se lit à AUCUNE disposition : ce
     n'est pas un problème de placement mais de quantité. Et le lecteur
     n'a de toute façon qu'une question à la fois — « qu'est-ce qui tient
     près de celui-ci ». On part donc d'un film et l'on montre ses
     voisins ; cliquer un voisin déplace le foyer sur lui.

     `null` veut dire « la carte entière », qui reste joignable d'un
     bouton : le fouillis est parfois ce qu'on est venu voir. */
  const [foyer, setFoyer] = useState<string | null>(null);
  const [portee, setPortee] = useState(1);
  /* Les films traversés, pour pouvoir revenir sur ses pas. */
  const [chemin, setChemin] = useState<string[]>([]);
  const [cherche, setCherche] = useState("");

  /* LES ÉPINGLES — les films qu'on est allé chercher soi-même.

     Ils ne tiennent au ciel par aucun fil : c'est la recherche qui les y
     a posés, et c'est très bien ainsi — on cherche justement un film
     qu'on n'a pas encore relié, pour voir ce qu'il pourrait rejoindre.
     Comme les positions attrapées à la souris, ils ne survivent pas à la
     page : ce sont des gestes, pas des données. */
  const [épingles, setÉpingles] = useState<string[]>([]);
  /* Les fils qu'on a éteints. On garde les ÉTEINTS et non les allumés :
     un fil qu'on vient de créer doit apparaître sans qu'on ait à
     l'allumer. */
  const [filsÉteints, setFilsÉteints] = useState<string[]>([]);
  const filsActifs = useMemo(
    () => fils.filter((f) => !filsÉteints.includes(f.id)),
    [fils, filsÉteints]
  );

  const W = 1100,
    H = 760;
  const complet = useMemo(
    () =>
      équipes
        ? buildSkyWithCrew(films, { tags, genres }, {}, { threads: filsActifs, pinned: épingles })
        : buildSky(films, { tags, genres }, { threads: filsActifs, pinned: épingles }),
    [films, tags, genres, équipes, filsActifs, épingles]
  );
  /* La découpe se fait APRÈS la construction : la carte entière existe
     toujours, on n'en montre qu'une part. */
  const { nodes, links } = useMemo(
    () => (foyer ? neighbourhood(complet.nodes, complet.links, foyer, portee) : complet),
    [complet, foyer, portee]
  );

  const linkedTotal = useMemo(
    () => films.filter((f) => (f.linkedWorks || []).length > 0).length,
    [films]
  );
  const placed = useMemo(() => relax(nodes, links, W, H), [nodes, links]);

  /* Les films par lesquels commencer : les plus reliés d'abord, ce sont
     ceux depuis lesquels on ira le plus loin. */
  const departs = useMemo(
    () =>
      [...complet.nodes]
        .filter((n) => n.kind === "film")
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 40),
    [complet.nodes]
  );

  /* CHERCHER DANS TOUTE LA COLLECTION, ET PAS SEULEMENT AU CIEL.

     La recherche ne regardait que les astres déjà placés — c'est-à-dire
     les films déjà reliés. Or on cherche presque toujours l'inverse : un
     film auquel on pense, dont on ne sait plus s'il est relié, et qu'on
     voudrait justement raccrocher à quelque chose. Ne rien trouver
     laissait croire qu'il n'était pas dans la collection.

     Un résultat hors carte s'épingle donc d'un clic : il entre au ciel,
     seul, et devient le foyer — d'où l'on voit ce qu'il pourrait
     rejoindre. */
  const auCiel = useMemo(
    () => new Set(complet.nodes.filter((n) => n.kind === "film").map((n) => n.filmId as string)),
    [complet.nodes]
  );
  const résultats = useMemo(
    () => (cherche.trim() ? searchFilms(films, cherche, 12) : []),
    [films, cherche]
  );

  const épingler = (filmId: string) => {
    setÉpingles((cur) => (cur.includes(filmId) ? cur : [...cur, filmId]));
    poserFoyer(`f:${filmId}`);
    setCherche("");
  };

  const poserFoyer = (id: string) => {
    setFoyer((actuel) => {
      if (actuel && actuel !== id) setChemin((c) => [...c, actuel]);
      return id;
    });
    setMoved({});
  };
  const revenir = () => {
    setChemin((c) => {
      const precedent = c[c.length - 1];
      setFoyer(precedent ?? null);
      return c.slice(0, -1);
    });
    setMoved({});
  };

  const pos = useCallback((p: PlacedNode) => moved[p.id] || p, [moved]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  /* ------------------------------------------------------------
     LE PARCOURS AU CLAVIER
     ------------------------------------------------------------

     La carte ne se lisait qu'au pointeur. Sans souris, aucun chemin
     n'existait vers un astre : la vue la plus riche du classeur était
     la seule entièrement fermée.

     UN SEUL ARRÊT DE TABULATION pour tout le ciel, et les flèches à
     l'intérieur. Rendre trois cents astres tabulables ferait trois cents
     pressions pour traverser la vue, ce qui est une façon polie de la
     garder fermée. C'est le motif habituel des grilles et des cartes.

     `curseur` double le survol plutôt que de le remplacer : les deux
     désignent « l'astre dont on parle en ce moment », et la mise en
     lumière des voisins doit répondre aux deux de la même façon. */
  const [curseur, setCurseur] = useState<string | null>(null);
  const astreCourant = curseur ? byId.get(curseur) : undefined;

  /* Un astre effacé par un changement de filtre ne doit pas laisser un
     curseur fantôme derrière lui — ni la voix de synthèse annoncer un
     astre qui n'est plus là. */
  useEffect(() => {
    if (curseur && !byId.has(curseur)) setCurseur(null);
  }, [byId, curseur]);

  /* Le même geste qu'un clic, pour que le clavier et le pointeur ne
     puissent pas diverger : deux copies de cette règle finiraient par
     répondre différemment à la même touche. */
  const ouvrirOuFoyer = (n: PlacedNode) => {
    if (n.kind === "work") return;
    if (n.kind === "thread") poserFoyer(n.id);
    else if (n.id === foyer) onOpen(n.filmId as string);
    else poserFoyer(n.id);
  };

  const auClavier = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const flèches: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const direction = flèches[e.key];
    if (direction) {
      const suivant = neighbourInDirection(placed, curseur, direction);
      /* On n'avale la touche QUE si l'on s'est déplacé : sinon la page
         ne défilerait plus alors qu'il n'y a rien de ce côté, et l'on
         croirait la carte figée. */
      if (suivant) {
        e.preventDefault();
        setCurseur(suivant.id);
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && astreCourant) {
      e.preventDefault();
      ouvrirOuFoyer(astreCourant);
      return;
    }
    /* Échap repose le curseur sans quitter la carte : on sort de
       l'exploration, pas de la vue. Une seconde pression laisse le
       navigateur faire ce qu'il veut. */
    if (e.key === "Escape" && curseur) {
      e.preventDefault();
      setCurseur(null);
    }
  };

  /* Ce que le lecteur d'écran annonce. Un film porte sa note, une œuvre
     son type, un fil ce qu'il rassemble — la même chose que l'étiquette
     visible, parce que deux descriptions différentes du même astre
     seraient deux cartes différentes. */
  const direLAstre = (n: PlacedNode): string =>
    [
      n.label,
      n.sub,
      n.kind === "film" ? "film" : n.kind === "thread" ? "fil" : "œuvre",
      n.id === foyer ? "foyer de la carte" : "",
      `${n.degree} lien${n.degree > 1 ? "s" : ""}`,
    ]
      .filter(Boolean)
      .join(", ");

  // l'ensemble des astres qu'un survol met en lumière
  const lit = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    links.forEach((l) => {
      if (l.a === hover) set.add(l.b);
      if (l.b === hover) set.add(l.a);
    });
    return set;
  }, [hover, links]);

  const toSvg = (e: ReactPointerEvent) => {
    const r = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const radiusOf = (n: PlacedNode) =>
    n.kind === "film"
      ? 7 + (n.rating || 0) * 1.6
      : /* Un fil est plus gros que ses membres : il en est le centre, et
           sa taille dit combien il en rassemble. */
        n.kind === "thread"
        ? 11 + Math.min(n.degree, 10)
        : 4 + Math.min(n.refs ?? 0, 4);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <StampCorner text="CARTE DU CIEL" />
      <CoffeeRing style={{ top: 150, right: 90 }} rotate={-25} />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 46,
          color: C.ink,
          position: "relative",
          zIndex: 2,
        }}
      >
        La constellation
      </div>
      <InkUnderline width={300} />
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 22,
          color: C.inkFaded,
          marginTop: 2,
          position: "relative",
          zIndex: 2,
        }}
      >
        {équipes
          ? "vos fils, et les parentés trouvées dans les génériques"
          : "seulement ce que vous avez relié à la main — attrapez une étoile pour la déplacer"}
      </div>

      {/* L'INTERRUPTEUR — la seconde couche, qu'on allume si on veut. */}
      <button
        onClick={() => setÉquipes((v) => !v)}
        data-tour="constellation-teams"
        aria-pressed={équipes}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          marginTop: 14,
          position: "relative",
          zIndex: 3,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: F.mono,
          fontSize: 10.5,
          letterSpacing: "var(--tag-tracking)",
          padding: "5px 11px",
          color: équipes ? C.card : C.slate,
          background: équipes ? C.slate : "transparent",
          border: `1px solid ${C.slate}`,
          borderRadius: "var(--tag-radius)",
        }}
      >
        <Users size={13} />
        SUIVRE LES ÉQUIPES
      </button>
      {équipes && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 17,
            color: C.inkFaded,
            marginTop: 6,
            position: "relative",
            zIndex: 2,
          }}
        >
          en pointillé : une personne partagée par deux ou trois films. Cliquez un pointillé pour le
          fixer — il devient alors un vrai fil rouge.
        </div>
      )}

      {/* LES FILS. À la différence des filtres ci-dessous, ils PEUPLENT le
          ciel : un fil y fait entrer ses membres, reliés ou non. C'est ce
          qui permet de demander « les films où le héros meurt » et de
          l'obtenir dessiné, plutôt que de fouiller une liste. */}
      {fils.length > 0 && (
        <div
          data-tour="constellation-fils"
          style={{ marginTop: 16, position: "relative", zIndex: 3 }}
        >
          <Label>Fils</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {fils.map((fil) => {
              const on = !filsÉteints.includes(fil.id);
              const encre = catInk(fil.color);
              const motif = fil.motif ? motifById(fil.motif) : undefined;
              return (
                <button
                  key={fil.id}
                  onClick={() =>
                    setFilsÉteints((cur) =>
                      cur.includes(fil.id) ? cur.filter((x) => x !== fil.id) : [...cur, fil.id]
                    )
                  }
                  title={motif ? `alimenté par « ${motif.label} »` : "fil composé à la main"}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: F.mono,
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: "var(--tag-radius)",
                    border: `1px solid ${encre}`,
                    color: on ? C.card : encre,
                    background: on ? encre : "transparent",
                  }}
                >
                  <Spool size={11} />
                  {fil.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* filtres : mots-clés et genres. Ils réduisent le ciel, ils ne le peuplent pas. */}
      {(allTags.length > 0 || allGenres.length > 0) && (
        <div
          style={{
            marginTop: 20,
            position: "relative",
            zIndex: 3,
            borderBottom: `1px dashed ${C.line}`,
            paddingBottom: 14,
          }}
        >
          {allTags.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>
                Mots-clés {tags.length > 0 && <span style={{ color: C.pine }}>· cumulatifs</span>}
              </Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {allTags.map((t) => (
                  <TagChip
                    key={t}
                    tag={t}
                    active={tags.includes(t)}
                    onClick={() => toggle(setTags)(t)}
                  />
                ))}
              </div>
            </div>
          )}
          {allGenres.length > 0 && (
            <div>
              <Label>Genres</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {allGenres.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggle(setGenres)(g)}
                      style={{
                        all: "unset",
                        ...tap,
                        cursor: "pointer",
                        fontFamily: F.mono,
                        fontSize: 10,
                        padding: "3px 10px",
                        borderRadius: 12,
                        border: `1px solid ${C.burgundy}`,
                        color: on ? C.card : C.burgundy,
                        background: on ? C.burgundy : "transparent",
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {(tags.length > 0 || genres.length > 0) && (
            <button
              onClick={() => {
                setTags([]);
                setGenres([]);
              }}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginTop: 10,
                color: C.inkFaded,
                fontFamily: F.mono,
                fontSize: 10,
              }}
            >
              tout afficher
            </button>
          )}
        </div>
      )}

      {/* LE CHOIX DU DÉPART — tant qu'aucun foyer n'est posé, on ne
          montre pas le graphe. C'est tout le remède : au lieu de subir
          deux cents astres et de chercher par où entrer, on choisit un
          film, et la carte se compose autour de lui.

          Les films proposés sont les plus reliés : ce sont ceux depuis
          lesquels on ira le plus loin. */}
      {foyer == null && complet.nodes.length > 0 && (
        <div
          data-tour="constellation-start"
          style={{
            marginTop: 18,
            padding: "16px 18px",
            border: `1px dashed ${C.line}`,
            background: alpha(C.card, 0.7),
            position: "relative",
            zIndex: 3,
          }}
        >
          <Label>Par où commencer</Label>
          <div
            style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, margin: "2px 0 10px" }}
          >
            choisissez un film — la carte ne montrera que lui et ses voisins, et vous avancerez de
            proche en proche
          </div>
          <input
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            placeholder="chercher dans toute la collection…"
            style={{
              width: "100%",
              maxWidth: 320,
              boxSizing: "border-box",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${C.line}`,
              outline: "none",
              fontFamily: F.body,
              fontSize: 14,
              color: C.ink,
              padding: "4px 2px",
              marginBottom: 10,
            }}
          />
          <Résultats
            cherche={cherche}
            résultats={résultats}
            departs={departs}
            auCiel={auCiel}
            onFoyer={poserFoyer}
            onÉpingler={épingler}
          />
          <button
            onClick={() => setFoyer(null)}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              marginTop: 12,
              fontFamily: F.mono,
              fontSize: 10,
              color: C.inkFaded,
              borderBottom: `1px solid ${C.line}`,
            }}
            onClickCapture={() => setPortee(1)}
          >
            OU VOIR TOUT LE CIEL, EN L&apos;ÉTAT
          </button>
        </div>
      )}

      {/* LE FIL D'ARIANE — on avance de proche en proche, il faut donc
          pouvoir revenir sur ses pas. */}
      {foyer != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 14,
            position: "relative",
            zIndex: 3,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>
            FOYER
          </span>
          <span style={{ fontFamily: F.title, fontSize: 17, fontWeight: 700, color: C.ink }}>
            {complet.nodes.find((n) => n.id === foyer)?.label ?? "—"}
          </span>
          {chemin.length > 0 && (
            <button onClick={revenir} style={petitBouton(false)}>
              ← REVENIR ({chemin.length})
            </button>
          )}
          <button onClick={() => setPortee(portee === 1 ? 2 : 1)} style={petitBouton(portee === 2)}>
            {portee === 1 ? "ÉLARGIR" : "RESSERRER"}
          </button>
          <button
            onClick={() => {
              setFoyer(null);
              setChemin([]);
            }}
            style={petitBouton(false)}
          >
            CHANGER DE DÉPART
          </button>
          <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
            un clic déplace le foyer · un double-clic ouvre la fiche
          </span>
        </div>
      )}

      {/* LA RECHERCHE RESTE À PORTÉE UNE FOIS LE FOYER POSÉ.

          Elle ne servait qu'à choisir un départ et disparaissait ensuite —
          or c'est en explorant qu'on pense à un film, et il fallait
          revenir en arrière pour l'atteindre. C'est aussi le seul moyen de
          sauter d'un bout du ciel à l'autre sans repasser par les voisins. */}
      {foyer != null && (
        <div style={{ marginTop: 12, position: "relative", zIndex: 3 }}>
          <input
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            placeholder="sauter à un autre film…"
            style={{
              width: "100%",
              maxWidth: 320,
              boxSizing: "border-box",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${C.line}`,
              outline: "none",
              fontFamily: F.body,
              fontSize: 14,
              color: C.ink,
              padding: "4px 2px",
              marginBottom: 8,
            }}
          />
          {cherche.trim() && (
            <Résultats
              cherche={cherche}
              résultats={résultats}
              departs={departs}
              auCiel={auCiel}
              onFoyer={poserFoyer}
              onÉpingler={épingler}
            />
          )}
        </div>
      )}

      {placed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: C.inkFaded,
            position: "relative",
            zIndex: 2,
          }}
        >
          <Sparkles size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div
            style={{
              fontFamily: F.title,
              fontSize: 20,
              color: C.ink,
              marginBottom: 6,
            }}
          >
            {tags.length || genres.length
              ? "Aucun fil sous ces filtres"
              : "Le ciel est encore noir"}
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 19,
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            {tags.length || genres.length
              ? "Aucun des films reliés ne porte ces mots-clés — élargissez la sélection."
              : "Ouvrez un film, descendez au « fil rouge » et reliez-lui un livre, une peinture ou un autre film. Seuls les films reliés apparaissent ici."}
          </div>
        </div>
      ) : (
        <>
          {/* la légende, façon cartouche de carte ancienne */}
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 10.5,
              color: C.inkFaded,
              marginTop: 18,
              letterSpacing: 1,
              position: "relative",
              zIndex: 2,
            }}
          >
            {placed.filter((n) => n.kind === "film").length} FILM(S) RELIÉ(S) · {links.length}{" "}
            FIL(S)
            {équipes && ` · DONT ${links.filter((l) => l.kind === "crew").length} PAR LES ÉQUIPES`}
            {(tags.length || genres.length) > 0 && ` · ${linkedTotal} RELIÉ(S) AU TOTAL`}
          </div>
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              marginTop: 10,
              marginBottom: 10,
              position: "relative",
              zIndex: 2,
            }}
          >
            {équipes &&
              (Object.keys(KIN_INK) as KinshipRole[]).map((r) => (
                <span
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    color: C.inkFaded,
                    letterSpacing: 0.8,
                  }}
                >
                  <span style={{ width: 14, height: 0, borderTop: `2px dashed ${KIN_INK[r]}` }} />
                  {r.toUpperCase()}
                </span>
              ))}
            {LEGEND.map(([k, l]) => (
              <span
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                  letterSpacing: 1,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: LINK_INK[k],
                    boxShadow: `0 0 6px ${LINK_INK[k]}88`,
                  }}
                />
                {l.toUpperCase()}
              </span>
            ))}
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 2,
              background: `radial-gradient(ellipse at 50% 45%, ${alpha(C.card, 0.8)}, transparent 72%)`,
              border: `1px dashed ${C.line}`,
              boxShadow: "inset 0 0 40px rgba(30,20,10,0.06)",
            }}
          >
            <svg
              ref={svgRef}
              data-tour="constellation-ciel"
              viewBox={`0 0 ${W} ${H}`}
              /* UN SEUL ARRÊT DE TABULATION POUR TOUTE LA CARTE, et les
                 flèches à l'intérieur : trois cents astres tabulables
                 demanderaient trois cents pressions pour traverser la
                 vue. `application` prévient le lecteur d'écran qu'il
                 doit laisser passer les flèches au lieu de les prendre
                 pour sa propre navigation. */
              role="application"
              tabIndex={0}
              aria-label="Carte du ciel — flèches pour aller d'un astre à l'autre, Entrée pour l'ouvrir, Échap pour lâcher"
              aria-activedescendant={curseur ? `astre-${curseur}` : undefined}
              onKeyDown={auClavier}
              onFocus={() => {
                /* Entrer dans la carte pose le curseur quelque part :
                   un cadre au focus sans rien de désigné dedans ne dit
                   pas quoi faire de la touche suivante. */
                if (!curseur) setCurseur(foyer ?? placed[0]?.id ?? null);
              }}
              onBlur={() => setCurseur(null)}
              style={{
                width: "100%",
                display: "block",
                cursor: drag ? "grabbing" : "default",
                touchAction: "none",
                outline: curseur ? `2px solid ${alpha(C.cobalt, 0.5)}` : "none",
                outlineOffset: 2,
              }}
              onPointerMove={(e) => {
                if (!drag) return;
                const p = toSvg(e);
                setMoved((m) => ({
                  ...m,
                  [drag]: { ...(byId.get(drag) as PlacedNode), x: p.x, y: p.y },
                }));
              }}
              onPointerUp={() => setDrag(null)}
              onPointerLeave={() => {
                setDrag(null);
                setHover(null);
              }}
            >
              {/* le quadrillage effacé d'une carte astronomique */}
              <defs>
                <pattern id="sky-grid" width="55" height="55" patternUnits="userSpaceOnUse">
                  <path
                    d="M55 0 L0 0 0 55"
                    fill="none"
                    stroke={C.line}
                    strokeWidth="0.6"
                    opacity="0.4"
                  />
                </pattern>
                <filter id="halo" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width={W} height={H} fill="url(#sky-grid)" />

              {/* les fils : caténaire légère, comme sur le panneau d'enquête */}
              {links.map((l, i) => {
                const na = byId.get(l.a),
                  nb = byId.get(l.b);
                if (!na || !nb) return null;
                const a = pos(na),
                  b = pos(nb);
                const on = !lit || (lit.has(l.a) && lit.has(l.b));
                const mx = (a.x + b.x) / 2,
                  my = (a.y + b.y) / 2 + Math.abs(b.x - a.x) * 0.09 + 10;
                // fiche à fiche : un trait plein, c'est le lien le plus fort
                const peer = l.kind === "peer";
                /* UNE PARENTÉ NE SE DESSINE PAS COMME UN FIL ROUGE.
                   Pointillé long et pâle, à l'encre de l'ardoise : ce
                   qui vient de la machine doit se distinguer de ce qui
                   vient de vous sans qu'on ait à cliquer pour le savoir. */
                const crew = l.kind === "crew";
                /* Un fil (le rassemblement) n'est pas une parenté : il se
                   trace à la teinte du fil, en trait continu mais fin —
                   il rassemble sans prétendre relier deux à deux. */
                const filDeRassemblement = l.kind === "thread";
                const d = `M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`;
                /* Ce que le fil raconte quand on le vise : la parenté
                   trouvée par la machine, ou la relation qu'on a écrite
                   soi-même — laquelle se lit dans le sens du trait. */
                const raisons = filDeRassemblement
                  ? (byId.get(l.a)?.label ?? "")
                  : peer
                    ? /* La relation nommée, puis CE QU'ON A ÉCRIT SOUS LE
                         LIEN. Un fil peut n'avoir ni l'une ni l'autre :
                         il reste un fil, et il doit le dire — sans ce
                         repli, le trait le plus fort de la carte était le
                         seul à se survoler en silence. */
                      [relationDef(l.relation)?.label, l.note].filter(Boolean).join(" — ") ||
                      "fil écrit à la main"
                    : /* UN RENVOI VERS UNE ŒUVRE PARLE, LUI AUSSI. La
                         branche « équipe » ramassait aussi les citations,
                         qui n'ont pas de `why` : le fil vers le livre
                         était donc muet. Il dit ce qu'on a écrit sous le
                         lien, et à défaut la nature de l'œuvre visée avec
                         son auteur. */
                      l.kind === "cite"
                      ? l.note ||
                        [linkTypeOf(nb.type || "other").label, nb.sub].filter(Boolean).join(" · ")
                      : (l.why || []).map((w) => `${w.role} · ${w.name}`).join(", ");
                const fixer =
                  crew && onLinkFilm
                    ? () => onLinkFilm(l.a.slice(2), l.b.slice(2), raisons)
                    : undefined;
                const vise = hoverLink === i;
                const teinteDuFil = filDeRassemblement
                  ? catInk(byId.get(l.a)?.color || "burgundy")
                  : null;
                const encre = teinteDuFil ?? (crew ? inkOf(l) : peer ? C.burgundy : C.vermillion);
                // un lien fort épaissit le trait : c'est la seule chose qu'il ait à dire ici
                const épaisseurPeer = 1.4 + strengthOf(l.force) * 0.6;
                return (
                  <g key={i}>
                    <path
                      d={d}
                      fill="none"
                      stroke={encre}
                      /* Un fil qu'on peut cliquer doit le dire AVANT
                         qu'on clique : au survol il s'épaissit et
                         s'assombrit, ce qu'aucune infobulle ne fait
                         assez vite. */
                      strokeWidth={
                        vise
                          ? (peer ? épaisseurPeer : 1.4) + 1.2
                          : peer
                            ? épaisseurPeer
                            : filDeRassemblement
                              ? 1.2
                              : 1.4
                      }
                      strokeDasharray={
                        peer ? "none" : crew ? "7 6" : filDeRassemblement ? "1 5" : "2.5 4"
                      }
                      strokeLinecap="round"
                      opacity={
                        on
                          ? vise
                            ? 1
                            : peer
                              ? 0.8
                              : crew
                                ? 0.5
                                : filDeRassemblement
                                  ? 0.55
                                  : 0.6
                          : 0.08
                      }
                      style={{
                        transition: "opacity .18s ease, stroke-width .12s ease",
                        pointerEvents: "none",
                      }}
                    />
                    {/* L'ÉTIQUETTE, au milieu du fil et seulement au
                        survol : elle nomme la nature de la parenté, ce
                        qu'une couleur seule ne peut pas faire. */}
                    {vise && raisons && (
                      <g style={{ pointerEvents: "none" }}>
                        <rect
                          x={mx - Math.min(raisons.length * 3.4, 190) / 2 - 6}
                          y={(a.y + b.y) / 2 + 2}
                          width={Math.min(raisons.length * 3.4, 190) + 12}
                          height={19}
                          rx={2}
                          fill={C.card}
                          stroke={encre}
                          strokeWidth="0.8"
                        />
                        <text
                          x={mx}
                          y={(a.y + b.y) / 2 + 15}
                          textAnchor="middle"
                          style={{ fontFamily: F.mono, fontSize: 10, fill: C.ink }}
                        >
                          {raisons.length > 54 ? `${raisons.slice(0, 53)}…` : raisons}
                        </text>
                      </g>
                    )}
                    {/* CE QUI REÇOIT LA SOURIS, et il est large.

                        Un trait d'un pixel et demi ne se vise pas : il
                        faut l'atteindre au pixel près, et une caténaire
                        n'est même pas droite. D'où ce chemin transparent
                        posé par-dessus, épais de vingt-six pixels — assez
                        pour qu'on tombe dessus sans y penser, assez fin
                        pour que deux fils voisins restent distincts.

                        Il existe pour TOUT fil et non plus seulement pour
                        ceux qu'on peut fixer : le survol doit nommer la
                        parenté même quand il n'y a rien à cliquer. */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={26}
                      style={{ cursor: fixer ? "pointer" : "default" }}
                      onPointerEnter={() => setHoverLink(i)}
                      onPointerLeave={() => setHoverLink(null)}
                      onClick={fixer}
                    >
                      {/* L'infobulle du navigateur double l'étiquette
                          dessinée : elle survit au fil qu'on vise en
                          bord de ciel, et c'est elle que lisent les
                          outils qui ne voient pas le SVG. Tout fil en a
                          une, pas seulement celui qu'on peut fixer. */}
                      {(fixer || raisons) && (
                        <title>{fixer ? `Fixer ce fil — ${raisons}` : raisons}</title>
                      )}
                    </path>
                  </g>
                );
              })}

              {placed.map((n) => {
                const p = pos(n);
                const r = radiusOf(n);
                const on = !lit || lit.has(n.id);
                const isHover = hover === n.id || curseur === n.id;
                const ink =
                  n.kind === "thread"
                    ? catInk(n.color || "burgundy")
                    : n.kind === "film"
                      ? C.burgundy
                      : n.type
                        ? LINK_INK[n.type]
                        : C.ochre;
                /* Un motif qui raconte la fin ne s'affiche pas en clair
                   sur une carte qu'on parcourt : le nom du fil reste
                   gratté tant qu'on ne l'a pas dévoilé d'un survol. */
                const gratté =
                  n.kind === "thread" && !!n.motif && !!motifById(n.motif)?.spoiler && !isHover;
                return (
                  <g
                    key={n.id}
                    id={`astre-${n.id}`}
                    role="option"
                    aria-selected={curseur === n.id}
                    aria-label={direLAstre(n)}
                    transform={`translate(${p.x},${p.y})`}
                    style={{
                      cursor: n.kind === "work" ? "grab" : "pointer",
                      opacity: on ? 1 : 0.22,
                      transition: "opacity .18s ease",
                    }}
                    onPointerEnter={() => !drag && setHover(n.id)}
                    onPointerLeave={() => !drag && setHover(null)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pressAt.current = { x: e.clientX, y: e.clientY };
                      setDrag(n.id);
                    }}
                    /* UN CLIC DÉPLACE LE FOYER, IL N'OUVRE PLUS LA FICHE.

                       C'est le geste de l'exploration : on avance de
                       proche en proche, et quitter la carte à chaque
                       astre rendrait le parcours impossible. Ouvrir la
                       fiche reste à un double-clic, et la légende le
                       dit — un geste qu'on ne devine pas doit être
                       écrit quelque part.

                       Le foyer lui-même fait exception : recliquer
                       dessus n'aurait rien à recentrer, alors il
                       ouvre. */
                    onClick={(e) => {
                      if (n.kind === "work") return;
                      const s = pressAt.current;
                      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) return; // c'était un glissé
                      /* Un fil ne s'ouvre pas — il n'a pas de fiche : le
                         prendre pour foyer montre tout ce qu'il rassemble,
                         et c'est exactement la question qu'on lui pose. */
                      if (n.kind === "thread") poserFoyer(n.id);
                      else if (n.id === foyer) onOpen(n.filmId as string);
                      else poserFoyer(n.id);
                    }}
                    onDoubleClick={() => n.kind === "film" && onOpen(n.filmId as string)}
                  >
                    {/* L'ANNEAU DU CURSEUR CLAVIER. Le halo du survol ne
                        suffit pas : il est diffus par nature, et « où
                        suis-je » doit se voir d'un coup d'œil sans avoir
                        à comparer deux lueurs. Un trait franc, donc, et
                        seulement au clavier. */}
                    {curseur === n.id && (
                      <circle
                        r={r + 11}
                        fill="none"
                        stroke={C.cobalt}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    )}
                    {/* halo : les astres les plus cités brillent le plus fort */}
                    <circle
                      r={r + 7}
                      fill={ink}
                      opacity={isHover ? 0.22 : 0.1}
                      filter="url(#halo)"
                    />
                    <circle
                      r={r}
                      fill={n.kind === "thread" ? alpha(ink, 0.28) : ink}
                      stroke={n.kind === "thread" ? ink : C.card}
                      strokeWidth={n.kind === "thread" ? 2 : 1.6}
                    />
                    {/* L'astre épinglé se distingue : rien ne le retient au
                        ciel qu'un geste, et le cercle en pointillé le dit. */}
                    {n.pinned && (
                      <circle
                        r={r + 8}
                        fill="none"
                        stroke={C.slate}
                        strokeWidth="0.9"
                        strokeDasharray="1 4"
                      />
                    )}
                    {n.kind === "film" && (
                      <circle
                        r={r + 4.5}
                        fill="none"
                        stroke={ink}
                        strokeWidth="0.9"
                        opacity="0.5"
                        strokeDasharray="2 3"
                      />
                    )}
                    <text
                      x={0}
                      y={-r - 11}
                      textAnchor="middle"
                      style={{
                        /* Les rôles, et non deux polices nommées en
                           clair : écrites ainsi, elles restaient celles
                           du carnet sous les treize autres peaux. */
                        fontFamily: n.kind === "work" ? F.mono : F.title,
                        fontSize: n.kind === "work" ? 10.5 : n.kind === "thread" ? 16 : 15,
                        fontWeight: n.kind === "work" ? 400 : 700,
                        fontStyle: n.kind === "thread" ? "italic" : "normal",
                        fill: C.ink,
                        pointerEvents: "none",
                      }}
                    >
                      {gratté
                        ? "•".repeat(Math.min(n.label.length, 14))
                        : n.label.length > 30
                          ? n.label.slice(0, 29) + "…"
                          : n.label}
                    </text>
                    {isHover && n.sub && (
                      <text
                        x={0}
                        y={r + 18}
                        textAnchor="middle"
                        style={{
                          fontFamily: F.hand,
                          fontSize: 16,
                          fill: C.inkFaded,
                          pointerEvents: "none",
                        }}
                      >
                        {n.sub}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {/* CE QUE LA VOIX DIT PENDANT QU'ON SE DÉPLACE.

                `aria-activedescendant` suffit en théorie, mais les
                lecteurs d'écran le suivent inégalement à l'intérieur
                d'un SVG. Une région vivante dit la même chose par un
                chemin qui, lui, marche partout. Elle est hors de l'écran
                et non `display: none` : ce qui est masqué n'est pas lu. */}
            <div
              aria-live="polite"
              aria-atomic="true"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clipPath: "inset(50%)",
                whiteSpace: "nowrap",
              }}
            >
              {astreCourant ? direLAstre(astreCourant) : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 14,
              position: "relative",
              zIndex: 2,
            }}
          >
            <span style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded }}>
              {placed.filter((n) => n.kind === "film").length} film(s),{" "}
              {placed.filter((n) => n.kind === "work").length} œuvre(s) —{" "}
              {placed.filter((n) => (n.refs ?? 0) > 1).length} pont(s) entre deux films
            </span>
            {(Object.keys(moved).length > 0 || épingles.length > 0) && (
              <button
                /* Remettre le ciel en place, c'est aussi retirer les
                   épingles : ce sont deux gestes de la même main, et les
                   laisser survivre au balayage donnerait un ciel « remis
                   en place » qui ne l'est pas. */
                onClick={() => {
                  setMoved({});
                  setÉpingles([]);
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.burgundy,
                  borderBottom: `1px solid ${C.burgundy}`,
                }}
              >
                REMETTRE LE CIEL EN PLACE
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* LA LISTE DES DÉPARTS, ET CE QU'ELLE MONTRE QUAND ON CHERCHE.

   Sans recherche : les films les plus reliés, ceux depuis lesquels on ira
   le plus loin. Avec : la collection ENTIÈRE, chaque résultat marqué selon
   qu'il est déjà au ciel ou non. Un film hors carte ne se grise pas — il
   se propose, parce que l'épingler est justement ce qu'on est venu
   faire. */
function Résultats({
  cherche,
  résultats,
  departs,
  auCiel,
  onFoyer,
  onÉpingler,
}: {
  cherche: string;
  résultats: Film[];
  departs: PlacedNode[] | SkyNode[];
  auCiel: Set<string>;
  onFoyer: (nodeId: string) => void;
  onÉpingler: (filmId: string) => void;
}) {
  if (!cherche.trim())
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {departs.slice(0, 12).map((n) => (
          <button key={n.id} onClick={() => onFoyer(n.id)} style={departStyle}>
            {n.label}
            <span style={{ opacity: 0.6, marginLeft: 6 }}>{n.degree}</span>
          </button>
        ))}
      </div>
    );

  if (résultats.length === 0)
    return (
      <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded }}>
        rien de ce nom dans la collection.
      </div>
    );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {résultats.map((f) => {
        const placé = auCiel.has(f.id);
        return (
          <button
            key={f.id}
            onClick={() => (placé ? onFoyer(`f:${f.id}`) : onÉpingler(f.id))}
            title={placé ? "Prendre pour foyer" : "L'épingler au ciel et partir de lui"}
            style={{
              ...departStyle,
              borderStyle: placé ? "solid" : "dashed",
              color: placé ? C.ink : C.inkFaded,
            }}
          >
            {f.title}
            <span style={{ opacity: 0.6, marginLeft: 6, fontFamily: F.mono, fontSize: 9.5 }}>
              {placé ? "au ciel" : "épingler"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const departStyle: CSSProperties = {
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.body,
  fontSize: 12.5,
  padding: "4px 10px",
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: "var(--tag-radius)",
  background: C.card,
};

const petitBouton = (actif: boolean): CSSProperties => ({
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: "var(--tag-tracking)",
  padding: "3px 9px",
  color: actif ? C.card : C.inkFaded,
  background: actif ? C.slate : "transparent",
  border: `1px solid ${actif ? C.slate : C.line}`,
  borderRadius: "var(--tag-radius)",
});
