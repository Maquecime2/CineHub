/* ============================================================
   THE MAP OF FILM-MAKERS
   ============================================================

   The layout is `relax` — the constellation's own relaxation, made
   generic in `domain/sky` and NOT copied here. What is drawn is another
   matter and is written out in full below: hollow nodes, arrows on the
   directed bonds, four inks. Sixty lines of drawing cost less than an
   abstraction laid over a view we are not allowed to touch.

   THE DIMMING IS OPACITY AND STROKE, NEVER `filter`. A filter is
   recomputed at every hover, over the whole subtree, for an effect two
   opacities give outright — and the project's rule is that expensive
   effects belong to moments, not to something one sweeps a pointer
   across.

   THE LIST BELOW THE MAP IS NOT A COURTESY. An SVG graph cannot be
   walked by a screen reader however carefully the labels are written,
   because there is no reading ORDER in a plane. The visually hidden list
   is the honest linear path, and it doubles as the fallback on a narrow
   phone. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { relax } from "../../domain/sky";
import { bondLabel } from "../../domain/bonds";
import type { Bond, BondKind } from "../../domain/bonds";
import { buildLineage } from "../../domain/lineageMap";
import type { LineageNode } from "../../domain/lineageMap";
import { useNodeDrag } from "../graph/useNodeDrag";
import { useGraphKeyboard } from "../graph/useGraphKeyboard";
import { Guideline } from "../ui";
import type { Course } from "../../domain/course";
import type { Film } from "../../types";

const W = 640;
const H = 420;

/* Une encre par nature de lien. Ce sont des JETONS : quatorze peaux les
   réécrivent, et une valeur en dur y devient illisible. */
const BOND_INK: Record<BondKind, string> = {
  master: C.burgundy,
  influence: C.cobalt,
  affinity: C.moss,
  counterpoint: C.vermillion,
};

interface LineageMapProps {
  films: Film[];
  bonds: Bond[];
  course: Course | null;
  /** Le foyer courant, en clé de personne. */
  focusKey: string | null;
  /** L'arête mise en avant, par son identifiant. */
  focusBond: string | null;
  onPickPerson: (key: string) => void;
  onPickBond: (bondId: string) => void;
}

export function LineageMap({
  films,
  bonds,
  course,
  focusKey,
  focusBond,
  onPickPerson,
  onPickBond,
}: LineageMapProps) {
  const { t } = useTranslation();
  const { nodes, links } = useMemo(
    () => buildLineage(films, bonds, course),
    [films, bonds, course]
  );

  /* THE KEY DOES NOT HOLD THE FOCUS. `relax` is O(n²) over 320 passes;
     recomputing it on every click would make selecting a node the most
     expensive gesture on the screen, for a layout that has not moved. */
  const placed = useMemo(() => relax(nodes, links, W, H), [nodes, links]);

  const drag = useNodeDrag();
  const keys = useGraphKeyboard(placed, { onPick: (n) => onPickPerson(n.key) });

  const at = (node: LineageNode & { x: number; y: number }) => {
    const nudge = drag.nudges[node.id];
    return { x: node.x + (nudge?.dx || 0), y: node.y + (nudge?.dy || 0) };
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

  if (placed.length === 0)
    return (
      <div data-tour="lineage-map">
        <Guideline tight>{t("lineage.emptyMap")}</Guideline>
      </div>
    );

  return (
    <div data-tour="lineage-map">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t("lineage.map")}
        style={{ width: "100%", height: "auto", touchAction: "none", overflow: "visible" }}
        onPointerMove={drag.onPointerMove}
        onPointerUp={() => drag.onPointerUp()}
      >
        <defs>
          {Object.entries(BOND_INK).map(([kind, ink]) => (
            <marker
              key={kind}
              id={`lineage-head-${kind}`}
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
              strokeWidth={here ? 3 : 1.2}
              strokeOpacity={shown ? (here ? 1 : 0.55) : 0.12}
              markerEnd={
                link.bond.kind === "master" || link.bond.kind === "influence"
                  ? `url(#lineage-head-${link.bond.kind})`
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
          const hollow = node.inCourse === 0;
          const r = 6 + Math.min(node.inCourse, 5) * 1.6;
          return (
            <g
              key={node.id}
              data-node={node.id}
              tabIndex={keys.tabIndexOf(node.id)}
              role="button"
              aria-pressed={here}
              aria-label={t("lineage.node", {
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
                fill={hollow ? C.paper : C.ink}
                stroke={here ? C.plum : C.ink}
                strokeWidth={here ? 2.5 : 1.2}
                strokeDasharray={node.orphan ? "3 2" : undefined}
              />
              <text
                y={r + 12}
                textAnchor="middle"
                fontFamily={F.mono}
                fontSize={9.5}
                fill={here ? C.ink : alpha(C.ink, 0.7)}
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* LE MIROIR EN LISTE — voir l'en-tête. Visuellement masqué, jamais
          `display: none` : ce dernier le retire aussi du lecteur d'écran,
          ce qui reviendrait à ne rien avoir écrit. */}
      <ul
        aria-label={t("lineage.mapList")}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          margin: -1,
          padding: 0,
          border: 0,
        }}
      >
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
    </div>
  );
}
