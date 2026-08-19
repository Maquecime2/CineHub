/* ============================================================
   THE MAP OF FILM-MAKERS
   ============================================================

   The layout is `relax` — the constellation's own relaxation, made
   generic in `domain/sky` and NOT copied here. What is drawn is another
   matter and is written out in full below: hollow nodes, arrows on the
   directed bonds, four inks. Sixty lines of drawing cost less than an
   abstraction laid over a view we are not allowed to touch.

   IT IS THE FULL WIDTH OF THE SCREEN, AND THAT IS WHY IT CAN BE READ.
   Crammed into half a column at 640 × 420, the nodes were six pixels
   across and their names were set at 9.5: it was a picture of a map. The
   frame is now 1000 × 600, the names are readable, and `useMapView`
   gives it a window one can close in on.

   THE DIMMING IS OPACITY AND STROKE, NEVER `filter`. A filter is
   recomputed at every hover, over the whole subtree, for an effect two
   opacities give outright — and the project's rule is that expensive
   effects belong to moments, not to something one sweeps a pointer
   across.

   THE NUDGES ARE DIVIDED BY THE MAGNIFICATION. `useNodeDrag` counts in
   CLIENT pixels and what is drawn here is in VIEW units; at k = 1 the
   two agree, which is precisely why the confusion went unnoticed for as
   long as there was no zoom. The division happens at `at()`, the one
   place the offsets are consumed, so the hook itself — and its
   four-pixel threshold, on which the whole selection depends — is left
   untouched.

   THE LIST BELOW THE MAP IS NOT A COURTESY. An SVG graph cannot be
   walked by a screen reader however carefully the labels are written,
   because there is no reading ORDER in a plane. The visually hidden list
   is the honest linear path, and it doubles as the fallback on a narrow
   phone — which is why it stays mounted even when the map is folded
   away. It is `position: absolute`, so THIS component carries its own
   `position: relative`: it used to borrow one from a wrapper in the view
   that the workbench layout no longer has. */
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minus, Plus } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { bondLabel } from "../../domain/bonds";
import type { Bond, BondKind } from "../../domain/bonds";
import type { LineageLink, LineageNode } from "../../domain/lineageMap";
import { useNodeDrag } from "../graph/useNodeDrag";
import { useGraphKeyboard } from "../graph/useGraphKeyboard";
import { useMapView } from "../graph/useMapView";
import { Guideline } from "../ui";

/** Un nœud une fois posé par `relax` : voir `MAP_W`. */
export type PlacedNode = LineageNode & { x: number; y: number };

/* LE CADRE EST LARGE ET BAS, et les deux comptent. Large parce qu'un
   graphe serré dans une demi-colonne n'était plus qu'une image de carte ;
   bas parce qu'il partage maintenant l'écran avec le rail qu'il explique
   — six cents pixels de haut poussaient celui-ci sous la ligne de
   flottaison, et une carte qu'on ne peut pas voir EN MÊME TEMPS que son
   sujet ne l'explique plus. Ce qu'on perd en surface, le zoom le rend. */
/* LA DISPOSITION EST CALCULÉE PAR L'APPELANT, ET CES DEUX NOMBRES SONT
   CE QU'IL LUI FAUT POUR LE FAIRE. `relax` est en O(n²) sur trois cent
   vingt passes : tant que ce composant restait monté, le rejouer ne
   coûtait rien puisqu'il ne se rejouait jamais. Depuis une feuille qui
   se démonte à chaque fermeture, il se rejouerait à chaque ouverture —
   d'où le calcul remonté d'un cran, où un mémo le tient. Il ne dépend
   que des nœuds, des arêtes et de ces deux bornes : rien de la fenêtre
   n'y entre, et c'est déjà la règle écrite. */
export const MAP_W = 1000;
export const MAP_H = 440;
const W = MAP_W;
const H = MAP_H;

/* Une encre par nature de lien. Ce sont des JETONS : quatorze peaux les
   réécrivent, et une valeur en dur y devient illisible. */
const BOND_INK: Record<BondKind, string> = {
  master: C.burgundy,
  influence: C.cobalt,
  affinity: C.moss,
  counterpoint: C.vermillion,
};

/** Le miroir en liste : masqué à l'œil, jamais au lecteur d'écran. */
const HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  margin: -1,
  padding: 0,
  border: 0,
} as const;

interface LineageMapProps {
  /** La disposition, calculée par l'appelant : voir `MAP_W`. */
  placed: PlacedNode[];
  links: LineageLink[];
  bonds: Bond[];
  /** Le foyer courant, en clé de personne. */
  focusKey: string | null;
  /** L'arête mise en avant, par son identifiant. */
  focusBond: string | null;
  onPickPerson: (key: string) => void;
  onPickBond: (bondId: string) => void;
  /** Le bouton de nouage, rendu dans la barre : voir `LineageView`. */
  action?: ReactNode;
  /**
   * La hauteur que le dessin peut prendre. Le plafond par défaut a été
   * choisi quand la carte partageait l'écran avec le rail qu'elle
   * explique ; sous une feuille, cette raison n'existe plus.
   */
  maxHeight?: string;
}

export function LineageMap({
  placed,
  links,
  bonds,
  focusKey,
  focusBond,
  onPickPerson,
  onPickBond,
  action,
  maxHeight = "40vh",
}: LineageMapProps) {
  const { t } = useTranslation();

  const drag = useNodeDrag();
  const view = useMapView(W, H);
  const keys = useGraphKeyboard(placed, { onPick: (n) => onPickPerson(n.key) });

  /* LE CURSEUR RAMÈNE LA FENÊTRE À LUI, et par un effet et non dans le
     gestionnaire : `useGraphKeyboard` pose le curseur suivant en état,
     donc au moment où la touche est traitée `keys.cursor` vaut encore
     l'ANCIEN nœud. Sans cela, une flèche à k = 3 met le focus sur un
     nœud hors du cadre — annoncé au lecteur d'écran, et invisible à
     l'œil. `focusOn` ne bouge rien quand le nœud est déjà en vue. */
  const cursor = keys.cursor;
  const { focusOn } = view;
  useEffect(() => {
    const node = cursor ? placed.find((p) => p.id === cursor) : null;
    if (node) focusOn(node.x, node.y);
  }, [cursor, placed, focusOn]);

  const at = (node: LineageNode & { x: number; y: number }) => {
    const nudge = drag.nudges[node.id];
    /* Client pixels into view units — see the header. */
    return { x: node.x + (nudge?.dx || 0) / view.k, y: node.y + (nudge?.dy || 0) / view.k };
  };

  const byId = new Map(placed.map((p) => [p.id, p]));

  /* Le voisinage à un pas reste net ; le reste s'atténue. Sans foyer,
     tout est net — on ne met pas une carte en sourdine par défaut. */
  const near = useMemo(() => {
    if (!focusKey) return null;
    const keep = new Set<string>();
    for (const bond of bonds) {
      if (bond.from === focusKey) keep.add(bond.to);
      if (bond.to === focusKey) keep.add(bond.from);
    }
    keep.add(focusKey);
    return keep;
  }, [bonds, focusKey]);

  const lit = (key: string) => !near || near.has(key);

  const mirror = (
    <ul aria-label={t("program.mapList")} style={HIDDEN}>
      {placed.map((node) => (
        <li key={node.id}>
          {node.name}
          <ul>
            {bonds
              .filter((b) => b.from === node.key || b.to === node.key)
              .map((b) => (
                <li key={b.id}>{bondLabel(b, node.key, t)}</li>
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );

  if (placed.length === 0)
    return (
      <div data-tour="program-map" style={{ position: "relative" }}>
        <Guideline tight>{t("program.emptyMap")}</Guideline>
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    );

  return (
    <div data-tour="program-map" style={{ position: "relative" }}>
      {/* LA BARRE PORTE LE ZOOM ET LE NOUAGE, et elle est au-dessus du
          dessin : les boutons sont le contrôle honnête, la molette n'en
          est que le raccourci. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        {action}
        <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          <button
            onClick={() => view.zoomBy(1 / 1.4)}
            disabled={!view.canZoomOut}
            aria-label={t("program.zoomOut")}
            title={t("program.zoomOut")}
            style={{ ...bare, padding: 4, opacity: view.canZoomOut ? 1 : 0.3 }}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => view.zoomBy(1.4)}
            disabled={!view.canZoomIn}
            aria-label={t("program.zoomIn")}
            title={t("program.zoomIn")}
            style={{ ...bare, padding: 4, opacity: view.canZoomIn ? 1 : 0.3 }}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={view.reset}
            disabled={!view.moved}
            aria-label={t("program.zoomReset")}
            title={t("program.zoomReset")}
            style={{ ...bare, padding: 4, opacity: view.moved ? 1 : 0.3 }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      <svg
        viewBox={view.viewBox}
        /* `application` and not `group`: the arrows, `+`, `-` and `0`
               are ours once the cursor is inside, and a browse mode that
               kept them would leave the map unwalkable. */
        role="application"
        tabIndex={0}
        aria-label={t("program.map")}
        style={{
          width: "100%",
          height: "auto",
          maxHeight,
          touchAction: "none",
          overflow: "hidden",
          display: "block",
          border: `1px solid ${alpha(C.line, 0.7)}`,
          background: alpha(C.card, 0.5),
          cursor: view.panning ? "grabbing" : view.k > 1 ? "grab" : "default",
        }}
        onWheel={view.onWheel}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") return view.zoomBy(1.4);
          if (e.key === "-") return view.zoomBy(1 / 1.4);
          if (e.key === "0") return view.reset();
        }}
        onPointerDown={view.onPointerDown}
        onPointerMove={(e) => {
          drag.onPointerMove(e);
          view.onPointerMove(e);
        }}
        onPointerUp={() => {
          drag.onPointerUp();
          view.onPointerUp();
        }}
      >
        <defs>
          {Object.entries(BOND_INK).map(([kind, ink]) => (
            <marker
              key={kind}
              id={`program-head-${kind}`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill={ink} />
            </marker>
          ))}
        </defs>

        {links.map((link) => {
          const a = byId.get(link.a);
          const b = byId.get(link.b);
          if (!a || !b) return null;
          const from = at(a);
          const to = at(b);
          const ink = BOND_INK[link.bond.kind];
          const here = focusBond === link.bond.id;
          const shown = lit(link.bond.from) && lit(link.bond.to);
          return (
            <line
              key={link.bond.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={ink}
              strokeWidth={here ? 3.5 : 1.5}
              strokeOpacity={shown ? (here ? 1 : 0.55) : 0.12}
              markerEnd={
                link.bond.kind === "master" || link.bond.kind === "influence"
                  ? `url(#program-head-${link.bond.kind})`
                  : undefined
              }
              style={{ cursor: "pointer" }}
              onClick={() => onPickBond(link.bond.id)}
            />
          );
        })}

        {placed.map((node) => {
          const { x, y } = at(node);
          const here = node.key === focusKey;
          const shown = lit(node.key);
          /* LE NŒUD CREUX : relié, mais sans un film au programme. Un
                 cercle vide dit « il manque quelque chose ici » sans qu'on
                 ait à l'écrire, et c'est le principal appel de l'écran. */
          const hollowNode = node.inCourse === 0;
          const r = 10 + Math.min(node.inCourse, 5) * 2;
          return (
            <g
              key={node.id}
              data-node={node.id}
              tabIndex={keys.tabIndexOf(node.id)}
              role="button"
              aria-pressed={here}
              aria-label={t("program.node", {
                name: node.name,
                films: node.inCourse,
                bonds: node.degree,
              })}
              transform={`translate(${x},${y})`}
              opacity={shown ? 1 : 0.25}
              style={{ cursor: "pointer" }}
              onPointerDown={(e) => drag.onPointerDown(node.id, e)}
              onPointerUp={() => {
                /* Only a press that never crossed the four-pixel threshold
                       selects — see `useNodeDrag`. */
                if (drag.onPointerUp()) onPickPerson(node.key);
              }}
              onKeyDown={(e) => keys.onKeyDown(e, node)}
            >
              <circle
                r={r}
                fill={hollowNode ? C.paper : C.ink}
                stroke={here ? C.plum : C.ink}
                strokeWidth={here ? 3 : 1.4}
                strokeDasharray={node.orphan ? "4 3" : undefined}
              />
              <text
                y={r + 15}
                textAnchor="middle"
                fontFamily={F.mono}
                fontSize={12}
                fill={here ? C.ink : alpha(C.ink, 0.7)}
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          color: alpha(C.ink, 0.45),
          marginTop: 5,
          letterSpacing: 0.5,
        }}
      >
        {t("program.howToLook")}
      </div>

      {mirror}
    </div>
  );
}
