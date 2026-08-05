import { useCallback, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from "react";
import { Sparkles, Users } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { buildSky, buildSkyWithCrew, relax } from "../domain/sky";
import { CoffeeRing, StampCorner, InkUnderline } from "../components/atmosphere";
import type { Film, LinkType, PlacedNode } from "../types";
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

  const W = 1100,
    H = 760;
  const { nodes, links } = useMemo(
    () => (équipes ? buildSkyWithCrew(films, { tags, genres }) : buildSky(films, { tags, genres })),
    [films, tags, genres, équipes]
  );
  const linkedTotal = useMemo(
    () => films.filter((f) => (f.linkedWorks || []).length > 0).length,
    [films]
  );
  const placed = useMemo(() => relax(nodes, links, W, H), [nodes, links]);

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
                const fixer =
                  crew && onLinkFilm
                    ? () => onLinkFilm(l.a.slice(2), l.b.slice(2), (l.why || []).join(", "))
                    : undefined;
                return (
                  <g key={i}>
                    <path
                      d={d}
                      fill="none"
                      stroke={crew ? C.slate : peer ? C.burgundy : C.vermillion}
                      strokeWidth={peer ? 2 : 1.4}
                      strokeDasharray={peer ? "none" : crew ? "7 6" : "2.5 4"}
                      strokeLinecap="round"
                      opacity={on ? (peer ? 0.8 : crew ? 0.45 : 0.6) : 0.08}
                      style={{ transition: "opacity .18s ease", pointerEvents: "none" }}
                    />
                    {/* Une parenté s'attrape : un trait de 1,4 pixel ne se
                        vise pas, d'où ce chemin large et transparent
                        posé dessus, qui ne sert qu'à recevoir le clic. */}
                    {fixer && (
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ cursor: "pointer" }}
                        onClick={fixer}
                      >
                        <title>{`Fixer ce fil — ${(l.why || []).join(", ")}`}</title>
                      </path>
                    )}
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
                    onClick={(e) => {
                      if (n.kind !== "film") return;
                      const s = pressAt.current;
                      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) return; // c'était un glissé
                      onOpen(n.filmId as string);
                    }}
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
