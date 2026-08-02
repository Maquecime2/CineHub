/* ============================================================
   VUE — VIDÉOTHÈQUE : le mur, ou l'étagère.
   ============================================================ */
import { useMemo } from "react";
import { Pin, LayoutGrid, Library } from "lucide-react";
import { C } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { hash, pickFrom } from "../../domain/seeded";
import { CoffeeRing, TapeResidue, StampCorner, InkUnderline } from "../../components/atmosphere";
import { Label } from "../../components/ui";
import { ShelfBoard } from "../../components/shelf/ShelfBoard";
import { FilmWall } from "./FilmWall";
import { WALLS } from "./walls";
import type { ShelfSortKey, WallUi } from "./walls";
import type { Divider, Film, FilmStatus, PerRow } from "../../types";

interface LibraryViewProps {
  films: Film[];
  onOpen: (id: string) => void;
  wall?: FilmStatus;
  ui: WallUi;
  setUi: (next: WallUi) => void;
  onUpdateMany: (patches: Record<string, Partial<Film>>) => void;
  dividers: Divider[];
  onDividers: (next: Divider[]) => void;
}

const GENRE_INKS = [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate] as const;
const MODES = [
  { k: "wall" as const, l: "MUR", icon: LayoutGrid },
  { k: "shelf" as const, l: "ÉTAGÈRE", icon: Library },
];
const PER_ROW_CHOICES: PerRow[] = ["auto", 4, 6, 8, 10, 12];

export function LibraryView({
  films,
  onOpen,
  wall = "watched",
  ui,
  setUi,
  onUpdateMany,
  dividers,
  onDividers,
}: LibraryViewProps) {
  const cfg = WALLS[wall];
  /* Recherche, filtre et tri vivent dans App : ouvrir un film démonte cette
     vue, et un état local serait perdu au retour au mur. */
  const { q, genreFilter, sortBy, desc, grouped } = ui;
  const mode = ui.mode === "shelf" ? "shelf" : "wall";
  const perRow: PerRow = ui.perRow || "auto";
  const set = (patch: Partial<WallUi>) => setUi({ ...ui, ...patch });
  const setQ = (v: string) => set({ q: v });
  const setGenreFilter = (v: string) => set({ genreFilter: v });
  const setGrouped = (fn: (g: boolean) => boolean) => set({ grouped: fn(grouped) });
  // recliquer le tri actif inverse simplement le sens
  const pickSort = (k: ShelfSortKey) =>
    set(k === sortBy ? { desc: !desc } : { sortBy: k, desc: true });

  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );

  /* Un film mis de côté n'a rien à faire sur le mur : c'est justement ce
     qu'on lui a demandé. Il reste visible sur l'étagère, dans son rayon. */
  const scope = useMemo(
    () => (mode === "shelf" ? films : films.filter((f) => !f.archived)),
    [films, mode]
  );
  const asideCount = useMemo(() => films.filter((f) => f.archived).length, [films]);

  const filtered = useMemo(() => {
    const list = scope.filter((f) => {
      const mq =
        !q ||
        f.title.toLowerCase().includes(q.toLowerCase()) ||
        (f.director || "").toLowerCase().includes(q.toLowerCase());
      const mg = !genreFilter || (f.genres || []).includes(genreFilter);
      return mq && mg;
    });
    return [...list].sort((a, b) => {
      const cmp =
        // A–Z se lit dans l'ordre naturel : c'est `desc` qui l'inverse
        sortBy === "title"
          ? -a.title.localeCompare(b.title)
          : sortBy === "director"
            ? -(
                (a.director || "zzz").localeCompare(b.director || "zzz") ||
                a.title.localeCompare(b.title)
              )
            : sortBy === "year"
              ? Number(b.year || 0) - Number(a.year || 0)
              : sortBy === "rating"
                ? (b.rating || 0) - (a.rating || 0)
                : // les films jamais datés glissent en fin de liste plutôt qu'en tête
                  sortBy === "watched"
                  ? (b.watchedAt || "").localeCompare(a.watchedAt || "")
                  : (b.addedAt || 0) - (a.addedAt || 0);
      return desc ? cmp : -cmp;
    });
  }, [scope, q, genreFilter, sortBy, desc]);

  /* Le regroupement par réalisateur : une pile de fiches par cinéaste, les
     plus fréquentés d'abord — c'est là que se lisent les habitudes. */
  const groups = useMemo(() => {
    if (!grouped) return null;
    const by = new Map<string, Film[]>();
    for (const f of filtered) {
      const key = f.director?.trim() || "Réalisateur inconnu";
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(f);
    }
    return [...by.entries()].sort(
      (a, b) =>
        b[1].length - a[1].length ||
        (a[0] === "Réalisateur inconnu"
          ? 1
          : b[0] === "Réalisateur inconnu"
            ? -1
            : a[0].localeCompare(b[0]))
    );
  }, [filtered, grouped]);

  const sorts: [ShelfSortKey, string][] =
    // le rangement à la main n'existe que là où l'on peut ranger
    mode === "shelf" ? [...cfg.sorts, ["manual", "à la main"]] : cfg.sorts;

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 10, right: 120 }} rotate={12} />
      <CoffeeRing style={{ bottom: 40, left: -30, width: 100, height: 100 }} rotate={-40} />
      <CoffeeRing style={{ top: 340, right: -40, width: 190, height: 190 }} rotate={70} />
      <TapeResidue style={{ top: 96, right: 260 }} />
      <TapeResidue style={{ bottom: 120, left: 180, opacity: 0.3 }} rotate={7} w={64} />
      <StampCorner text={`${cfg.stamp} · ${films.length}`} />
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 46,
          color: C.ink,
          position: "relative",
          zIndex: 2,
        }}
      >
        {cfg.title}
      </div>
      <InkUnderline width={cfg.underline} />
      <div
        style={{
          fontFamily: "'Caveat', cursive",
          fontSize: 22,
          color: C.inkFaded,
          marginTop: 2,
          position: "relative",
          zIndex: 2,
        }}
      >
        {cfg.subtitle}
      </div>

      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginTop: 26,
          marginBottom: 34,
          borderBottom: `1px dashed ${C.line}`,
          paddingBottom: 18,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ minWidth: 200 }}>
          <Label>Chercher</Label>
          <input
            style={underlineInput}
            placeholder="un titre, un·e cinéaste…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && (
              <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>
            )}
            {allGenres.map((g) => {
              // chaque genre porte sa propre encre — l'étiquetage n'a pas été fait le même jour
              const ink = pickFrom(GENRE_INKS, Math.abs(hash(g)));
              const on = genreFilter === g;
              return (
                <button
                  key={g}
                  onClick={() => setGenreFilter(on ? "" : g)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 10.5,
                    padding: "4px 11px",
                    borderRadius: 14,
                    border: `1px solid ${ink}`,
                    color: on ? C.card : ink,
                    background: on ? ink : "transparent",
                    transform: `rotate(${(Math.abs(hash(g)) % 5) - 2}deg)`,
                    boxShadow: on ? `1px 2px 4px ${ink}55` : "none",
                    transition: "background .15s ease",
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Trier</Label>
          <div
            style={{
              display: "flex",
              gap: 14,
              fontFamily: "'Special Elite', monospace",
              fontSize: 11,
            }}
          >
            {sorts.map(([k, l]) => (
              <span
                key={k}
                onClick={() => pickSort(k)}
                title={sortBy === k ? "cliquer pour inverser" : ""}
                style={{
                  cursor: "pointer",
                  color: sortBy === k ? C.burgundy : C.inkFaded,
                  textDecoration: sortBy === k ? "underline" : "none",
                }}
              >
                {l}
                {sortBy === k && <span style={{ marginLeft: 3 }}>{desc ? "↓" : "↑"}</span>}
              </span>
            ))}
          </div>
        </div>
        <div>
          <Label>Présentation</Label>
          <div style={{ display: "flex", marginTop: 2 }}>
            {MODES.map(({ k, l, icon: Icon }) => (
              <button
                key={k}
                onClick={() => set({ mode: k })}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px",
                  fontFamily: "'Special Elite', monospace",
                  fontSize: 10.5,
                  background: mode === k ? C.ink : "transparent",
                  color: mode === k ? C.card : C.inkFaded,
                  border: `1px solid ${mode === k ? C.ink : C.line}`,
                  marginLeft: k === "shelf" ? -1 : 0,
                }}
              >
                <Icon size={12} /> {l}
              </button>
            ))}
          </div>
        </div>
        {mode === "shelf" && (
          <div>
            <Label>Par ligne</Label>
            <div style={{ display: "flex", marginTop: 2 }}>
              {PER_ROW_CHOICES.map((n, i) => (
                <button
                  key={n}
                  onClick={() => set({ perRow: n })}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "5px 9px",
                    minWidth: 12,
                    textAlign: "center",
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 10.5,
                    background: perRow === n ? C.ink : "transparent",
                    color: perRow === n ? C.card : C.inkFaded,
                    border: `1px solid ${perRow === n ? C.ink : C.line}`,
                    marginLeft: i === 0 ? 0 : -1,
                  }}
                >
                  {n === "auto" ? "AUTO" : n}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "wall" && (
          <div>
            <Label>Classer</Label>
            <button
              onClick={() => setGrouped((g) => !g)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "5px 12px",
                marginTop: 2,
                fontFamily: "'Special Elite', monospace",
                fontSize: 10.5,
                background: grouped ? C.pine : "transparent",
                color: grouped ? C.card : C.inkFaded,
                border: `1px solid ${grouped ? C.pine : C.line}`,
              }}
            >
              PAR RÉALISATEUR
            </button>
          </div>
        )}
        {mode === "wall" && asideCount > 0 && (
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded }}>
            <button
              onClick={() => set({ mode: "shelf" })}
              style={{
                all: "unset",
                cursor: "pointer",
                borderBottom: `1px dashed ${C.line}`,
              }}
            >
              {asideCount} film{asideCount > 1 ? "s" : ""} de côté — voir l'étagère
            </button>
          </div>
        )}
      </div>

      {mode === "shelf" ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {sortBy !== "manual" && (dividers || []).some((d) => d.wall === wall) && (
            <div
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 18,
                color: C.inkFaded,
                marginTop: 8,
              }}
            >
              Vos intercalaires réapparaissent avec le rangement « à la main » — un tri les
              déplacerait sans les respecter.
            </div>
          )}
          <ShelfBoard
            films={filtered}
            onOpen={onOpen}
            onUpdateMany={onUpdateMany}
            dividers={dividers}
            onDividers={onDividers}
            wall={wall}
            perRow={perRow}
            manual={sortBy === "manual"}
            onManual={() => {
              if (sortBy !== "manual") set({ sortBy: "manual", desc: true });
            }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: C.inkFaded,
            position: "relative",
            zIndex: 2,
          }}
        >
          <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 20,
              color: C.ink,
              marginBottom: 6,
            }}
          >
            {films.length === 0 ? cfg.empty[0] : "Rien à afficher"}
          </div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19 }}>
            {films.length === 0 ? cfg.empty[1] : "Essayez une autre recherche."}
          </div>
        </div>
      ) : grouped && groups ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {groups.map(([director, list]) => (
            <div key={director} style={{ marginBottom: 46 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: "italic",
                    fontWeight: 700,
                    fontSize: 26,
                    color: C.ink,
                  }}
                >
                  {director}
                </div>
                <div
                  style={{
                    flex: 1,
                    borderBottom: `1px dashed ${C.line}`,
                    transform: "translateY(-6px)",
                  }}
                />
                <div
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 11,
                    color: C.inkFaded,
                  }}
                >
                  {list.length} film{list.length > 1 ? "s" : ""}
                </div>
              </div>
              <FilmWall films={list} onOpen={onOpen} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 2 }}>
          <FilmWall films={filtered} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}
