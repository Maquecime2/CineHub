import { useCallback, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  Dispatch,
  SetStateAction,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Sparkles, Users } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { buildSky, buildSkyWithCrew, neighbourhood, relax } from "../domain/sky";
import { CoffeeRing, StampCorner, InkUnderline } from "../components/atmosphere";
import type { Film, KinshipRole, LinkType, PlacedNode, SkyLink } from "../types";
import { Label } from "../components/ui";
import { TagChip } from "../components/ui/TagEditor";

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
}: {
  films: Film[];
  onOpen: (id: string) => void;
  /** Fixer une parenté suggérée : elle devient un vrai fil rouge, réciproque. */
  onLinkFilm?: (fromId: string, toId: string, note?: string) => void;
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

  const W = 1100,
    H = 760;
  const complet = useMemo(
    () => (équipes ? buildSkyWithCrew(films, { tags, genres }) : buildSky(films, { tags, genres })),
    [films, tags, genres, équipes]
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
    n.kind === "film" ? 7 + (n.rating || 0) * 1.6 : 4 + Math.min(n.refs ?? 0, 4);

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
        aria-pressed={équipes}
        style={{
          all: "unset",
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
            placeholder="chercher un titre…"
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {departs
              .filter((n) => n.label.toLowerCase().includes(cherche.trim().toLowerCase()))
              .slice(0, 12)
              .map((n) => (
                <button key={n.id} onClick={() => poserFoyer(n.id)} style={departStyle}>
                  {n.label}
                  <span style={{ opacity: 0.6, marginLeft: 6 }}>{n.degree}</span>
                </button>
              ))}
          </div>
          <button
            onClick={() => setFoyer(null)}
            style={{
              all: "unset",
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
              viewBox={`0 0 ${W} ${H}`}
              style={{
                width: "100%",
                display: "block",
                cursor: drag ? "grabbing" : "default",
                touchAction: "none",
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
                const d = `M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`;
                const raisons = (l.why || []).map((w) => `${w.role} · ${w.nom}`).join(", ");
                const fixer =
                  crew && onLinkFilm
                    ? () => onLinkFilm(l.a.slice(2), l.b.slice(2), raisons)
                    : undefined;
                const vise = hoverLink === i;
                const encre = crew ? inkOf(l) : peer ? C.burgundy : C.vermillion;
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
                      strokeWidth={vise ? (peer ? 3 : 2.6) : peer ? 2 : 1.4}
                      strokeDasharray={peer ? "none" : crew ? "7 6" : "2.5 4"}
                      strokeLinecap="round"
                      opacity={on ? (vise ? 1 : peer ? 0.8 : crew ? 0.5 : 0.6) : 0.08}
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
                      {fixer && <title>{`Fixer ce fil — ${raisons}`}</title>}
                    </path>
                  </g>
                );
              })}

              {placed.map((n) => {
                const p = pos(n);
                const r = radiusOf(n);
                const ink = n.kind === "film" ? C.burgundy : n.type ? LINK_INK[n.type] : C.ochre;
                const on = !lit || lit.has(n.id);
                const isHover = hover === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{
                      cursor: n.kind === "film" ? "pointer" : "grab",
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
                      if (n.kind !== "film") return;
                      const s = pressAt.current;
                      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) return; // c'était un glissé
                      if (n.id === foyer) onOpen(n.filmId as string);
                      else poserFoyer(n.id);
                    }}
                    onDoubleClick={() => n.kind === "film" && onOpen(n.filmId as string)}
                  >
                    {/* halo : les astres les plus cités brillent le plus fort */}
                    <circle
                      r={r + 7}
                      fill={ink}
                      opacity={isHover ? 0.22 : 0.1}
                      filter="url(#halo)"
                    />
                    <circle r={r} fill={ink} stroke={C.card} strokeWidth="1.6" />
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
                        fontFamily: n.kind === "film" ? F.title : F.mono,
                        fontSize: n.kind === "film" ? 15 : 10.5,
                        fontWeight: n.kind === "film" ? 700 : 400,
                        fill: C.ink,
                        pointerEvents: "none",
                      }}
                    >
                      {n.label.length > 30 ? n.label.slice(0, 29) + "…" : n.label}
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
            {Object.keys(moved).length > 0 && (
              <button
                onClick={() => setMoved({})}
                style={{
                  all: "unset",
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

const departStyle: CSSProperties = {
  all: "unset",
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
