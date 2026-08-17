/* The containers: a row's setting gutter, the row itself, the shelf, the
   drawer of things set aside, the preview of an open case, the decor
   cabinet and an object's palette. */
import { useTranslation } from "react-i18next";
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Layer } from "../ui/Layer";
import { X, Trash2, ChevronLeft, Eye, EyeOff, Users, UserX, Download } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap, tapSquare, COARSE, TAP } from "../../theme/styles";
import { wallStyle, materialStyle, PLANK_SHADOW } from "../../theme/surfaces";
import { hash, fileNoOf } from "../../domain/seeded";
import { initialsOf } from "../../domain/film";
import { PosterArt } from "../film/PosterArt";
import { InkStars } from "../ui";
import { isUnplaced, CAT_KEYS, addRow, removeRow, clearRow, addCat } from "../../shelf-views";
import {
  SHELF_KIND,
  BOX_H,
  CAT_COLORS,
  CAT_FAMILIES,
  catInk,
  DECOR_SIZES,
  DECOR_TYPES,
  decorLabel,
  shelfDecorTypes,
  wallDecorTypes,
} from "./constants";
import {
  listCustomDecor,
  listHiddenDecor,
  toggleDecorHidden,
  subscribeCustomDecor,
  removeCustomDecor,
  showCustomDecor,
  takeCustomDecor,
} from "../../services/customDecor";
import { listWonDecor, subscribeWonDecor, wonDecorByKey } from "../../services/wonDecor";
import { accountOpen, serverConfigured, sharedDecor } from "../../services/server";
import { CustomDraw } from "./CustomDraw";
import { FilmBox, DecorItem, WallItem, CategoryBox, dividerSkin, DividerHead } from "./items";
import { splitRow, useRowCap } from "./lines";

const GutterAct = ({ label, onClick, ink = C.inkFaded }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset",
      ...tap,
      cursor: "pointer",
      padding: "3px 0",
      fontFamily: F.mono,
      fontSize: 10,
      color: ink,
    }}
  >
    {label}
  </button>
);

/* THE COUNT PER LINE — "auto", or a number one writes.

   It was a row of buttons drawn from a closed list: 3, 4, 5, 6, 8, 10,
   12. Seven imposed choices, and nothing for whoever wanted seven, or
   twenty. A field closes nothing, and fits in half the room.

   "auto" is not a number among the others, it is the ABSENCE of a written
   number: the row measures itself and takes the count of its width (see
   `useRowCap`, in `lines.js`). It previously let the browser wrap, which
   does not know how to lay wood under what it wraps. Hence a switch
   beside the field rather than one more value inside it — a zero or an
   empty field would have said "no films per line" just as well as "as
   many as fit".

   The draft is local and only goes up on confirmation: writing at every
   keystroke would pass through 1 before 12, and the shelf would fold up
   under one's fingers at every digit typed. */
export const PerRowField = React.memo(function PerRowField({ value, onChange, title, max }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const auto = value == null;

  const commit = () => {
    const n = Math.round(Number(draft));
    // a count that is not one hands back to whatever was set
    if (!draft.trim() || !Number.isFinite(n) || n < 1) {
      setDraft(value == null ? "" : String(value));
      return;
    }
    /* The drawer of things set aside is only 250 px: two cases fit in it.
       So we bring it back to what is possible rather than refusing — we
       correct the hand that aims too big, we do not push it away. */
    const kept = max ? Math.min(n, max) : n;
    setDraft(String(kept));
    if (kept !== value) onChange(kept);
  };

  return (
    <>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 8.5,
          letterSpacing: 1,
          color: C.inkFaded,
          marginBottom: 5,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onChange(auto ? Math.min(Number(draft) || 6, max || Infinity) : null)}
          title={auto ? "Fixer un nombre" : "Laisser remplir la largeur"}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            padding: "2px 8px",
            fontFamily: F.mono,
            fontSize: 9.5,
            background: auto ? C.ink : "transparent",
            color: auto ? C.card : C.inkFaded,
            border: `1px solid ${auto ? C.ink : C.line}`,
          }}
        >
          auto
        </button>
        <input
          type="number"
          min="1"
          max={max || undefined}
          value={draft}
          disabled={auto}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(value == null ? "" : String(value));
          }}
          placeholder={auto ? "—" : ""}
          aria-label={title}
          style={{
            all: "unset",
            boxSizing: "border-box",
            width: 54,
            textAlign: "center",
            borderBottom: `1px solid ${C.line}`,
            paddingBottom: 2,
            fontFamily: F.mono,
            fontSize: 12,
            color: auto ? C.inkFaded : C.ink,
            opacity: auto ? 0.5 : 1,
          }}
        />
        <span style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
          {auto ? "au fil de la largeur" : "par ligne"}
        </span>
      </div>
    </>
  );
});

/* THE GUTTER — a row's setting, to its left.

   The number of films per line was a WALL setting, the same for the whole
   shelf, which a divider could only override by opening its line. It now
   belongs to the row itself, and is set where one looks at it. */
const RowGutter = React.memo(function RowGutter({ row, shown, acts, capMax }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(row.label || "");
  useEffect(() => {
    setDraft(row.label || "");
  }, [row.label]);

  return (
    <div
      style={{
        position: "relative",
        /* THE GUTTER WIDENS UNDER A FINGER, AND IT IS THE ONLY PLACE IT
           DOES. Its tab is the door to the row's settings — naming the
           line, fixing the number of cases. Twenty-two pixels a side can
           be aimed at with a mouse; with a finger, the tab is missed, and
           with it everything it opens. We pay eighteen pixels of shelf
           width, on a band that already scrolls horizontally. */
        width: COARSE ? TAP : 26,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        paddingBottom: 14,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        title={isUnplaced(row) ? t("shelf.unfiledFilms") : t("shelf.rowSettings")}
        style={{
          all: "unset",
          cursor: "pointer",
          boxSizing: "border-box",
          width: COARSE ? TAP : 22,
          height: COARSE ? TAP : 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.paperDark,
          border: `1px solid ${C.line}`,
          borderRight: "none",
          borderRadius: "2px 0 0 2px",
          boxShadow: `1px 1px 0 ${alpha(C.ink, 0.14)}`,
          fontFamily: F.mono,
          fontSize: 9.5,
          color: C.inkFaded,
          // discreet as long as one is not dealing with the row
          opacity: open || shown ? 1 : 0.45,
          transition: "opacity .15s ease",
        }}
      >
        {isUnplaced(row) ? "?" : row.perRow || "~"}
      </button>

      {row.label && !open && (
        <div
          title={row.label}
          style={{
            position: "absolute",
            top: -18,
            left: 0,
            width: 130,
            textAlign: "left",
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
          }}
        >
          {row.label}
        </div>
      )}

      {open && (
        <>
          {/* clicking elsewhere closes it again: a setting does not stay open */}
          <div
            onClick={() => setOpen(false)}
            data-veil
            style={{ position: "fixed", inset: 0, zIndex: 30 }}
          />
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 8,
              zIndex: 31,
              width: 214,
              padding: "10px 12px",
              background: C.card,
              border: `1px solid ${C.line}`,
              boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
            }}
          >
            <PerRowField
              title={t("shelf.casesPerRow")}
              value={row.perRow ?? null}
              max={capMax}
              onChange={(n) => acts.setRow(row.id, { perRow: n })}
            />

            <div
              style={{
                fontFamily: F.mono,
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                margin: "12px 0 3px",
              }}
            >
              {t("shelf.rowNameLabel")}
            </div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => acts.setRow(row.id, { label: draft.trim() })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  acts.setRow(row.id, { label: draft.trim() });
                  setOpen(false);
                }
              }}
              placeholder={t("shelf.unnamed")}
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                borderBottom: `1px solid ${C.line}`,
                paddingBottom: 2,
                fontFamily: F.body,
                fontSize: 13,
                color: C.ink,
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
              <GutterAct
                label={t("shelf.rowAbove")}
                onClick={() => {
                  acts.addRow(row.id, "before");
                  setOpen(false);
                }}
              />
              <GutterAct
                label={t("shelf.rowBelow")}
                onClick={() => {
                  acts.addRow(row.id, "after");
                  setOpen(false);
                }}
              />
              <GutterAct
                label={t("shelf.addCategoryHere")}
                onClick={() => {
                  acts.addCat(row.id);
                  setOpen(false);
                }}
              />
              {!isUnplaced(row) && (
                <>
                  <GutterAct
                    label={t("shelf.emptyRow")}
                    onClick={() => {
                      acts.clearRow(row.id);
                      setOpen(false);
                    }}
                  />
                  <GutterAct
                    label={t("shelf.deleteRow")}
                    ink={C.burgundy}
                    onClick={() => {
                      acts.removeRow(row.id);
                      setOpen(false);
                    }}
                  />
                </>
              )}
            </div>
            {isUnplaced(row) && (
              <div
                style={{
                  fontFamily: F.hand,
                  fontSize: 14,
                  color: C.inkFaded,
                  marginTop: 8,
                }}
              >
                la ligne d'arrivée recueille ce qui n'a pas encore de place — elle ne se supprime
                pas
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});

/* THE BOARD — the wood of ONE line. There are as many as there are
   lines, and that is the whole point: a band of cases with nothing under
   it is not a shelf.

   It is no longer necessarily wood. But as long as the view has not
   chosen a material, it is WHAT IT WAS: the theme's two stops, to the
   hexadecimal, with no grain or sheen. The material is not a restatement
   of what exists, it is a door beside it — and that is what allows one to
   claim that yesterday's view is identical to the pixel. */
const Plank = React.memo(function Plank({ theme, plank }) {
  const skin = plank?.material
    ? materialStyle(plank.material, plank.finish)
    : {
        background: `linear-gradient(${theme.wood[0]}, ${theme.wood[1]})`,
        boxShadow: PLANK_SHADOW,
      };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 12,
        ...skin,
      }}
    />
  );
});

/* A ROW — its gutter, its boards, and what is laid on them.

   One board per row, and no longer one per shelf: that is what a shelf
   is, it gives the gutter something to butt against, and it makes the row
   a thing one sees.

   And now one board per LINE of the row. Wrapping was left to the
   browser, which does not know how to lay wood: as soon as a row wrapped,
   the cases at the top floated above the void. So the row cuts its own
   content into lines (`splitRow`), and each line is a band of its own,
   with its board. A box that is too big no longer wraps inside itself: it
   overflows onto the line below, wood included. */
const ShelfRow = React.memo(function ShelfRow({
  row,
  kind,
  films,
  theme,
  plank,
  dim,
  dnd,
  acts,
  onOpen,
  onEditCat,
  onEditDecor,
  onDecorLabel,
  capMax,
  isLast,
  bare,
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const ctx = useMemo(() => ({ kind, rowId: row.id, catId: null }), [kind, row.id]);

  /* The measurement is taken on the wrapper, which has no inner padding:
     it is the BANDS that carry it, and we therefore take it off by hand —
     otherwise the last cell would overflow its board. */
  const measure = useRef(null);
  const padX = bare ? 4 : 20;
  const cap = useRowCap(measure, row.perRow, padX);
  const lines = useMemo(() => splitRow(row.items, cap), [row.items, cap]);

  const draw = (seg) => {
    if (seg.t === "c") {
      return (
        <CategoryBox
          key={seg.key}
          cat={seg.cat}
          items={seg.items}
          first={seg.first}
          last={seg.last}
          kind={kind}
          rowId={row.id}
          films={films}
          dim={dim}
          acts={acts}
          onOpen={onOpen}
          onEdit={onEditCat}
          onEditDecor={onEditDecor}
          onDecorLabel={onDecorLabel}
          onDragStart={dnd.onDragStart}
          onDragEnd={dnd.onDragEnd}
          onDragOverBox={dnd.onBoxOver}
          onCatOver={dnd.onCatOver}
        />
      );
    }
    if (seg.t === "d") {
      return (
        <DecorItem
          key={seg.key}
          item={seg.it}
          ctx={ctx}
          onEdit={onEditDecor}
          onLabel={onDecorLabel}
          onDragStart={dnd.onDragStart}
          onDragEnd={dnd.onDragEnd}
          onDragOverBox={dnd.onBoxOver}
        />
      );
    }
    const f = films.get(seg.it.id);
    if (!f) return null;
    return (
      <FilmBox
        key={f.id}
        film={f}
        ctx={ctx}
        onOpen={onOpen}
        dim={dim(f)}
        onDragStart={dnd.onDragStart}
        onDragEnd={dnd.onDragEnd}
        onDragOverBox={dnd.onBoxOver}
      />
    );
  };

  const drawn = lines.map((line) => line.map(draw).filter(Boolean));
  const empty = drawn.every((line) => line.length === 0);
  // the empty arrivals line does not show itself: it has nothing to say
  const hidden = empty && isUnplaced(row);

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "stretch" }}
        onMouseEnter={() => setShown(true)}
        onMouseLeave={() => setShown(false)}
      >
        {!hidden && !bare && <RowGutter row={row} shown={shown} acts={acts} capMax={capMax} />}
        <div ref={measure} style={{ flex: 1, minWidth: 0, marginLeft: hidden && !bare ? 26 : 0 }}>
          {drawn.map((nodes, i) => (
            <div
              /* Every LINE is a row in the drag's eyes: the target is
                 stated as a neighbour (`overId`) and not as a number, so
                 cutting the band disturbs nothing — and letting go in a
                 line's emptiness now aims at the end of THAT line, which
                 is what one was pointing at. */
              key={i}
              data-shelf-row
              onDragOver={(e) => dnd.onRowOver(e, ctx)}
              onDrop={(e) => {
                e.preventDefault();
                dnd.onDrop(kind, e);
              }}
              style={{
                position: "relative",
                display: "flex",
                flexWrap: "nowrap",
                alignItems: "flex-end",
                minHeight: hidden ? 12 : BOX_H + 26,
                padding: hidden ? 0 : bare ? "14px 2px 0" : "14px 10px 0",
              }}
            >
              {i === 0 && empty && !isUnplaced(row) && (
                <div
                  style={{
                    color: C.inkFaded,
                    fontStyle: "italic",
                    fontSize: 13,
                    padding: "44px 4px",
                  }}
                >
                  {t("shelf.emptyRowHint")}
                </div>
              )}
              {nodes}
              {/* THIS line's board */}
              {!hidden && <Plank theme={theme} plank={plank} />}
            </div>
          ))}
        </div>
      </div>
      {/* the seam: letting a case go there opens a new row */}
      {!isLast && (
        <div
          data-row-seam
          onDragOver={(e) => dnd.onSeamOver(e, kind, row.id)}
          onDrop={(e) => {
            e.preventDefault();
            dnd.onDrop(kind, e);
          }}
          style={{ height: 10, marginLeft: bare ? 0 : 26 }}
        />
      )}
    </>
  );
});

/* A shelf: its rows, stacked in its frame. The board is no longer here —
   each row carries its own. */
export function Shelf({
  kind,
  title,
  tag,
  shelf,
  wall = [],
  count,
  onOpen,
  dnd,
  acts,
  films,
  theme,
  plankDecor,
  /* The WALL's decor, as the view saved it — or nothing, and the shelf
     stays the one from before the paintwork. */
  wallDecor,
  dim,
  onEditCat,
  onEditDecor,
  onDecorLabel,
}) {
  const { t } = useTranslation();
  const cfg = SHELF_KIND[kind];
  const rows = shelf?.rows || [];

  /* The shelf's background, shelf tint included: three things that fought
     over the same property are now composed in one place. Recomputed only
     when the decor changes — it is a style that lives on the node the drag
     hovers a hundred times per gesture. */
  const skin = useMemo(
    /* With no ink chosen, we do not invent one: `catInk` would return
       burgundy for an absent key, where a wallpaper with no instruction
       wants the module's discreet tint. */
    () =>
      wallStyle(
        wallDecor,
        wallDecor?.patternInk ? catInk(wallDecor.patternInk) : undefined,
        cfg.tint
      ),
    [wallDecor, cfg.tint]
  );

  return (
    /* The decors' deliberate overflow — a coffee ring, a ribbon biting
       over the edge — is clipped here, as close as possible: on the shelf
       itself, which contains nothing in `position: fixed`. `clip` and not
       `hidden`, which would make this block a scrolling container. */
    <div style={{ marginTop: 26, overflowX: "clip" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            fontFamily: F.title,
            fontWeight: 600,
            fontSize: 21,
            color: C.ink,
          }}
        >
          {title ?? cfg.title}
        </div>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            color: C.inkFaded,
            letterSpacing: 1,
          }}
        >
          {count} film{count > 1 ? "s" : ""}
        </div>
        {/* THE MAIN SHELF WEARS NO CAPTION, and asking for one anyway
            is what printed a key on screen: `defaultValue: ""` looks
            like "nothing to say", but i18next takes an EMPTY default for
            an absent one and hands back the key —
            "shelf.kinds.main.tag", in full, under the shelf. So the
            shelves that have a caption are named, and the one that has
            none is not asked. */}
        {(tag ?? (kind === "main" ? "" : t(`shelf.kinds.${kind}.tag`))) && (
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 17,
              color: C.burgundy,
              transform: "rotate(-3deg)",
            }}
          >
            {tag ?? (kind === "main" ? "" : t(`shelf.kinds.${kind}.tag`))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => acts.addRow(null, "end", kind)}
          title={t("shelf.addRow")}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            fontFamily: F.mono,
            fontSize: 9.5,
            letterSpacing: 1,
            color: C.inkFaded,
            border: `1px dashed ${C.line}`,
            padding: "3px 8px",
          }}
        >
          + LIGNE
        </button>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver(kind);
        }}
        onDrop={(e) => {
          e.preventDefault();
          /* The only drop that knows WHERE, to the pixel: it is the
             shelf's frame that serves as reference for hanging objects. */
          dnd.onDrop(kind, e, true);
        }}
        style={{
          position: "relative",
          ...skin.frame,
          border: cfg.border
            ? `1px ${kind === "reserve" ? "solid" : "dashed"} ${cfg.border}${kind === "reserve" ? "" : "59"}`
            : "none",
          borderBottom: "none",
          borderRadius: cfg.border ? "3px 3px 0 0" : 0,
          padding: "10px 10px 0",
          transition: "background .15s ease",
        }}
      >
        {/* the theme's tint, inside the shelf ONLY: repainting the page
            background would fight with the paper's vignetting */}
        {theme.tint && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: theme.tint,
              mixBlendMode: "multiply",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
        {/* THE WALL'S TEXTURE — the only one of the three layers that is
            an overlay, because it blends and a background does not blend.
            The same way of being as the tint just above: at the back, in
            multiply, and transparent to the cursor. */}
        {skin.texture && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              ...skin.texture,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
        {rows.map((row, i) => (
          <ShelfRow
            key={row.id}
            row={row}
            kind={kind}
            films={films}
            theme={theme}
            plank={plankDecor}
            dim={dim}
            dnd={dnd}
            acts={acts}
            onOpen={onOpen}
            onEditCat={onEditCat}
            onEditDecor={onEditDecor}
            onDecorLabel={onDecorLabel}
            isLast={i === rows.length - 1}
          />
        ))}

        {/* THE WALL — a layer apart, over the rows.

            It was at first AT THE BACK, which was right: a frame is hung
            behind the shelf, not in front. But a row takes the shelf's
            whole width and a hundred and seventy pixels of height;
            stacked, they covered the wall entirely. So the hanging objects
            were drawn underneath and UNREACHABLE — the click always went
            to the row.

            So the layer moves in front, and only lets the cursor through
            on the objects themselves: the rest of the wall stays a drop
            zone for the rows. That is also what makes those objects
            visible, which they barely were.

            It is bounded by `inset: 0`, and it is that layer — not the
            shelf's frame — that the drop measures: both must count in the
            same box, otherwise the shelf's ten pixels of margin shift
            everything one lays down. */}
        {/* The layer no longer clips. `overflow: hidden` was the belt to
            the clamp set at the drop: an object being unable to stick out
            of its shelf, it could not intercept what one let go on the
            neighbouring shelf. The two fell together — we now want to be
            able to pin in a corner, even if the object bites over the
            edge, and the interception is settled otherwise (see
            `tokens.ts`: for the length of a drag, a hanging object no
            longer receives the cursor).

            It stays `inset: 0`: it is that layer, and not the shelf's
            frame, that the drop measures — both must count in the same
            box, otherwise the shelf's ten pixels of margin shift
            everything one lays down. */}
        <div
          data-wall-layer
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          {(wall || []).map((it) => (
            <WallItem
              key={it.id}
              item={it}
              onEdit={onEditDecor}
              onDragStart={dnd.onDragStart}
              onDragEnd={dnd.onDragEnd}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* THE DRAWER — the things set aside.

   At the bottom of the page, this shelf forced one to cross the whole
   collection to drop a film into it; and since it grew with time, it
   pushed the collection upwards. On the side, it is reachable from
   anywhere and only takes room when one opens it. Closed, it stays a
   target: dragging a case onto its tab opens it by itself. */
const DRAWER_W = 250;

export function ReserveDrawer({
  shelf,
  count,
  open,
  setOpen,
  dnd,
  acts,
  films,
  theme,
  plankDecor,
  dim,
  onOpen,
  onEditCat,
  onEditDecor,
  onDecorLabel,
}) {
  const { t } = useTranslation();
  const rows = shelf?.rows || [];
  const filled = rows.some((r) => r.items.length);

  return (
    <Layer>
      {/* the tab, always hooked to the edge */}
      <button
        data-drawer-tab
        onClick={() => setOpen(!open)}
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver("reserve");
          if (!open) setOpen(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop("reserve", e);
        }}
        title={open ? t("shelf.closeDrawer") : t("shelf.openSetAside")}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          position: "fixed",
          right: open ? DRAWER_W : 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 41,
          writingMode: "vertical-rl",
          padding: "20px 9px",
          borderRadius: "4px 0 0 4px",
          background: `linear-gradient(180deg, ${C.slate}, ${alpha(C.slate, 0.8)})`,
          color: C.card,
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 1.4,
          boxShadow: "-3px 3px 10px rgba(30,20,10,0.32)",
          transition: "right .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
        }}
      >
        {open ? t("shelf.close") : `${t("shelf.setAside")}${count ? ` · ${count}` : ""}`}
      </button>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver("reserve");
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop("reserve", e);
        }}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: DRAWER_W,
          zIndex: 40,
          transform: open ? "none" : `translateX(${DRAWER_W}px)`,
          transition: "transform .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
          background: C.paperDark,
          borderLeft: `1px solid ${C.line}`,
          boxShadow: open ? "-8px 0 24px rgba(30,20,10,0.22)" : "none",
          display: "flex",
          flexDirection: "column",
          // closed, it must intercept neither click nor hover
          visibility: open ? "visible" : "hidden",
        }}
      >
        <div style={{ padding: "18px 16px 10px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div
              style={{
                fontFamily: F.title,
                fontWeight: 600,
                fontSize: 19,
                color: C.ink,
              }}
            >
              {t("shelf.setAsideTitle")}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>{count}</div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setOpen(false)}
              title={t("common.close")}
              style={{ all: "unset", ...tapSquare, cursor: "pointer", color: C.inkFaded }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 16,
              color: C.inkFaded,
              marginTop: 2,
            }}
          >
            {t("shelf.keptNotThrown")}
          </div>
          <button
            onClick={() => acts.addRow(null, "end", "reserve")}
            title={t("shelf.addRow")}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              display: "inline-block",
              marginTop: 8,
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
              border: `1px dashed ${C.line}`,
              padding: "3px 8px",
            }}
          >
            + LIGNE
          </button>
        </div>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "16px 4px", alignContent: "flex-start" }}
        >
          {!filled ? (
            <div
              style={{
                color: C.inkFaded,
                fontStyle: "italic",
                fontSize: 13,
                lineHeight: 1.6,
                padding: "0 8px",
              }}
            >
              Rien de côté. Glissez ici un film que vous ne voulez plus voir sur le mur — il reste
              entier, avec sa note et ses captures.
            </div>
          ) : (
            rows.map((row, i) => (
              <ShelfRow
                key={row.id}
                row={row}
                kind="reserve"
                films={films}
                theme={theme}
                plank={plankDecor}
                dim={dim}
                dnd={dnd}
                acts={acts}
                onOpen={onOpen}
                onEditCat={onEditCat}
                onEditDecor={onEditDecor}
                onDecorLabel={onDecorLabel}
                isLast={i === rows.length - 1}
                /* In a drawer of 250 px, the per-line setting has nothing
                 to set: the width decides. So the row goes in bare, which
                 gives the gutter's 26 px back to the cases. */
                bare
                capMax={2}
              />
            ))
          )}
        </div>
      </div>
    </Layer>
  );
}

/* Filing by hand. Dropping writes an `order` on every case of the
   arrival shelf: without a stable number, the order would go back to the
   default sort at the next render. */
/* The cabinet of curiosities: what one can lay on a board. Every pattern
   is pulled out of it by dragging — and that drag MOVES nothing, it
   CREATES: the object does not exist yet when one grabs it. */
/* A family of the cabinet. There are two and they are not laid down with
   the same gesture: one is dragged onto a board, between two cases; the
   other to the back of the shelf, wherever one wants. Mixing them in a
   single grid left the user to discover the difference by botching their
   drop. */
const DecorFamily = ({ title, hint, types, leftOf, onDragStart, onDragEnd }) => {
  const { t } = useTranslation();
  const heading = title ?? t("shelf.toStandTitle");
  return (
    <>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 8.5,
          letterSpacing: 1,
          color: C.inkFaded,
          margin: "10px 0 3px",
        }}
      >
        {heading}
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginBottom: 6 }}>
        {hint}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {types.map((d) => {
          const Draw = d.draw;
          /* `undefined` = pas de plafond (la maison, et ce qu'on a
             déposé). Un nombre = ce qu'il reste à poser. */
          const left = leftOf?.(d.key);
          const spent = left === 0;
          return (
            <div
              key={d.key}
              draggable={!spent}
              onDragStart={(e) => {
                if (spent) return e.preventDefault();
                e.dataTransfer.effectAllowed = "copy";
                onDragStart(d.key, e.currentTarget);
              }}
              onDragEnd={onDragEnd}
              title={
                left === undefined
                  ? decorLabel(d, t)
                  : `${decorLabel(d, t)} — ${t("shelf.leftToPlace", { count: left })}`
              }
              style={{
                position: "relative",
                width: 46,
                height: 46,
                /* ÉPUISÉ NE VEUT PAS DIRE ABSENT. On le laisse en place,
                   pâli, avec son compte à zéro : le retirer du cabinet
                   ferait croire qu'on ne le possède plus, alors qu'on
                   l'a simplement tout posé. */
                cursor: spent ? "not-allowed" : "grab",
                opacity: spent ? 0.4 : 1,
                flexShrink: 0,
                overflow: "hidden",
                border: `1px solid ${C.line}`,
                background: C.paper,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {left !== undefined && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    right: 1,
                    bottom: 0,
                    fontFamily: F.mono,
                    fontSize: 8.5,
                    color: spent ? C.burgundy : C.inkFaded,
                  }}
                >
                  {left}
                </span>
              )}
              {/* A pattern that STANDS UP has no drawing: it is made of
                paper and borders, like the box. So the cabinet shows a
                mock-up of it, instead of looking for a component that does
                not exist. */}
              {d.tall ? (
                <div
                  style={{
                    position: "relative",
                    width: 15,
                    height: 34,
                    ...dividerSkin(C.ochre),
                    alignSelf: "flex-end",
                    marginBottom: 6,
                  }}
                >
                  {/* the mock-up carries the same tab as the card: it is by
                    that tab that one recognises it once laid */}
                  <DividerHead ink={C.ochre} height={9} />
                </div>
              ) : (
                <Draw color={C.ochre} style={{ width: 38, height: 38 }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

/* The register of imported patterns, read as an outside source: the
   cabinet and the workshop show the same list, and an import made from
   one must appear in the other without our having wired them to each
   other. */
const useCustomDecor = () =>
  useSyncExternalStore(subscribeCustomDecor, listCustomDecor, listCustomDecor);

const useHiddenDecor = () =>
  useSyncExternalStore(subscribeCustomDecor, listHiddenDecor, listHiddenDecor);

/* Le registre des objets gagnés vit hors de React — il est rempli par la
   lecture du comptoir — et le cabinet doit se redessiner quand on en
   gagne un. Même forme que les deux du dessus. */
const useWonDecor = () => useSyncExternalStore(subscribeWonDecor, listWonDecor, listWonDecor);

const CABINET_BOX = {
  position: "fixed",
  right: 40,
  top: 120,
  zIndex: 45,
  width: 240,
  padding: "12px 14px",
  background: C.card,
  border: `1px solid ${C.line}`,
  boxShadow: "2px 8px 20px rgba(30,20,10,0.34)",
};

const CabinetTitle = ({ children }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: 9.5,
      letterSpacing: 1,
      color: C.inkFaded,
    }}
  >
    {children}
  </div>
);

const CabinetNote = ({ children, ...p }) => (
  <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, ...p.style }} {...p}>
    {children}
  </div>
);

/* THE WORKSHOP — what one brings to the cabinet oneself.

   The fifteen house patterns are drawn in the code: they are a catalogue
   backlist, they do not move and cannot be deleted. Here one adds one's
   own, and only those can be removed.

   The family is chosen BEFORE the import, and not after: it decides how
   the drawing rests in its cell — laid on the bottom, hooked by the top —
   and it is written into the file at the moment one files it. */
/* ---------- OTHER PEOPLE'S SHELF ----------

   The pieces the people one follows have put on show. It is the only
   place in this cabinet where something arrives from outside, and
   everything about it is written so that its absence changes nothing:
   with no server, no account or no network the section does not appear
   at all, and the workshop is the workshop it has always been.

   TAKING A COPY IS TAKING A COPY. It lands in "les miens" and stays
   there — even if its author puts the piece back to private afterwards.
   One does not take back what one has given, and a shelf that empties
   itself because somebody elsewhere hesitated is a shelf one stops
   trusting. */
function SharedShelf() {
  const { t } = useTranslation();
  const [shelf, setShelf] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!serverConfigured() || !accountOpen()) return;
    let alive = true;
    sharedDecor()
      .then((d) => alive && setShelf(d))
      /* Quiet on failure: this heading may simply have nothing to say. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!shelf?.length) return null;

  const take = async (remote) => {
    setBusy(remote.id);
    try {
      await takeCustomDecor(remote);
      setShelf((was) => was.filter((d) => d.id !== remote.id));
    } catch {
      /* The cabinet says nothing: the piece is still over there. */
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <WorkshopSection title={t("shelf.atOthers")} />
      {shelf.map((d) => (
        <DecorRow
          key={d.id}
          label={d.label}
          note={`${t(d.wall === "mur" ? "shelf.toHang" : "shelf.toStand")} · ${t(
            "shelf.decorFrom",
            { pseudo: d.owner }
          )}`}
          action={
            <RowButton
              onClick={() => take(d)}
              disabled={busy === d.id}
              label={t("shelf.decorTake", { label: d.label })}
            >
              <Download size={12} />
            </RowButton>
          }
        />
      ))}
    </>
  );
}

function DecorWorkshop({ onBack }) {
  const { t } = useTranslation();
  const custom = useCustomDecor();
  const hiddenKeys = useHiddenDecor();

  /* LE DÉPÔT N'EXISTE PLUS, ET CE QUI RESTE EST L'ARMOIRE.

     On importait une image et elle rejoignait le cabinet. Les objets
     neufs sortent maintenant d'une pochette, au comptoir : c'est le
     serveur qui tire, et personne ne dépose plus rien.

     CE PANNEAU NE DISPARAÎT PAS POUR AUTANT. Il tient toujours ce qu'on
     a déposé AVANT — on le range, on le montre, on le retire — et
     fermer la porte d'entrée n'est pas vider la pièce. Il dit
     simplement où l'on trouve les neufs.

     `addCustomDecor` reste dans le service : la synchronisation d'un
     appareil qui n'a pas encore vu ce changement passe par elle. */

  return (
    <div style={CABINET_BOX}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <button
          onClick={onBack}
          title={t("shelf.backToCabinet")}
          aria-label={t("shelf.backToCabinet")}
          style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}
        >
          <ChevronLeft size={13} />
        </button>
        <CabinetTitle>{t("shelf.myObjects")}</CabinetTitle>
      </div>

      <CabinetNote style={{ marginBottom: 10 }}>{t("shelf.wonAtCounter")}</CabinetNote>

      <div style={{ marginTop: 12, maxHeight: 300, overflowY: "auto" }}>
        <WorkshopSection title={t("shelf.mine")} />
        {custom.length === 0 ? (
          <CabinetNote>{t("shelf.nothingImported")}</CabinetNote>
        ) : (
          custom.map((d) => (
            <DecorRow
              key={d.key}
              label={decorLabel(d, t)}
              note={`${t(d.wall ? "shelf.toHang" : "shelf.toStand")}${
                d.tintable ? "" : ` · ${t("shelf.noColour")}`
              }${d.owner ? ` · ${t("shelf.decorFrom", { pseudo: d.owner })}` : ""}${
                d.shown ? ` · ${t("shelf.decorShown")}` : ""
              }`}
              thumb={
                <CustomDraw
                  motif={d.key}
                  color={C.ochre}
                  style={{ width: "100%", height: "100%" }}
                />
              }
              action={
                <div style={{ display: "flex", gap: 4 }}>
                  {/* ON SHOW, OR NOT. Only appears once the object has a
                      server identity: before that there is nothing to
                      show it to anybody WITH, and a switch that does
                      nothing is worse than no switch.

                      Somebody else's piece has no switch at all — it is
                      not ours to publish. */}
                  {d.remoteId && !d.owner && (
                    <RowButton
                      onClick={() => showCustomDecor(d.key, !d.shown).catch(() => {})}
                      label={
                        d.shown
                          ? t("shelf.decorHide", { label: decorLabel(d, t) })
                          : t("shelf.decorShow", { label: decorLabel(d, t) })
                      }
                    >
                      {d.shown ? <Users size={12} /> : <UserX size={12} />}
                    </RowButton>
                  )}
                  <RowButton
                    onClick={() => removeCustomDecor(d.key)}
                    label={`Supprimer « ${decorLabel(d, t)} »`}
                  >
                    <Trash2 size={12} />
                  </RowButton>
                </div>
              }
            />
          ))
        )}

        <SharedShelf />

        {/* The house drawings cannot be deleted — they are in the code.
            But one does not need all fifteen, and the cabinet is tidied by
            removing them from the panel. */}
        <WorkshopSection title={t("shelf.ofTheHouse")} />
        {DECOR_TYPES.map((d) => {
          const hidden = hiddenKeys.includes(d.key);
          const Draw = d.draw;
          return (
            <DecorRow
              key={d.key}
              label={decorLabel(d, t)}
              note={t(d.wall ? "shelf.toHang" : "shelf.toStand")}
              dim={hidden}
              thumb={
                d.tall ? (
                  <div
                    style={{
                      position: "relative",
                      width: 11,
                      height: 26,
                      ...dividerSkin(C.ochre),
                      alignSelf: "flex-end",
                    }}
                  >
                    <DividerHead ink={C.ochre} height={7} />
                  </div>
                ) : (
                  <Draw color={C.ochre} style={{ width: 28, height: 28 }} />
                )
              }
              action={
                <RowButton
                  onClick={() => toggleDecorHidden(d.key)}
                  label={
                    hidden ? `Remettre « ${decorLabel(d, t)} »` : `Masquer « ${decorLabel(d, t)} »`
                  }
                >
                  {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </RowButton>
              }
            />
          );
        })}
      </div>

      <CabinetNote style={{ marginTop: 8 }}>
        {/* Two neighbouring gestures that do not do the same thing:
            saying it once here is better than a shelf that empties without
            warning. */}
        masquer retire du cabinet sans toucher aux étagères ; supprimer retire des deux
      </CabinetNote>
    </div>
  );
}

const WorkshopSection = ({ title }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: 8.5,
      letterSpacing: 1,
      color: C.inkFaded,
      margin: "10px 0 4px",
      borderBottom: `1px solid ${C.line}`,
      paddingBottom: 3,
    }}
  >
    {title}
  </div>
);

const RowButton = ({ onClick, label, children, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    style={{
      all: "unset",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.45 : 1,
      color: C.inkFaded,
      display: "flex",
    }}
  >
    {children}
  </button>
);

/* A line of the workshop: the thumbnail, the name, and the gesture one
   can make on it. The same for an imported object and for a house
   drawing — they are read in the same list, they must look alike. */
const DecorRow = ({ label, note, thumb, action, dim }) => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        // a hidden pattern stays readable, but fades by half
        opacity: dim ? 0.42 : 1,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          background: C.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {thumb}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          title={label}
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            color: C.ink,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textDecoration: dim ? "line-through" : "none",
          }}
        >
          {label}
        </div>
        <CabinetNote style={{ fontSize: 12 }}>{dim ? t("shelf.hidden") : note}</CabinetNote>
      </div>
      {action}
    </div>
  );
};

export function DecorCabinet({ placed, onDragStart, onDragEnd, onClose }) {
  const { t } = useTranslation();
  const [managing, setManaging] = useState(false);
  // the register moves under the cabinet as soon as one imports from the workshop
  useCustomDecor();
  /* Le cabinet doit se redessiner quand on gagne un objet : le registre
     est rempli par la lecture du comptoir, hors de React. */
  useWonDecor();

  /* CE QU'IL RESTE À POSER, PAR MOTIF.

     LES OBJETS DE LA MAISON N'ONT PAS DE PLAFOND, et c'est ce que ce
     `undefined` veut dire : ils sont dans le code, ils ne s'épuisent
     pas, et leur en inventer un serait reprendre quelque chose à
     quelqu'un. Seuls les objets GAGNÉS se comptent — on en pose autant
     qu'on en possède, ce qui est la seule chose qui donne un sens à un
     double. Ceux qu'on avait déposés soi-même restent illimités, eux
     aussi : ils étaient à nous avant cette règle. */
  const leftOf = (key) => {
    const won = wonDecorByKey(key);
    if (!won) return undefined;
    return Math.max(0, won.copies - (placed?.[key] || 0));
  };

  return (
    <Layer>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      {managing ? (
        <DecorWorkshop onBack={() => setManaging(false)} />
      ) : (
        <div style={CABINET_BOX}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <CabinetTitle>{t("shelf.cabinet")}</CabinetTitle>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setManaging(true)}
              title={t("shelf.manageYourObjects")}
              style={{
                all: "unset",
                cursor: "pointer",
                fontFamily: F.mono,
                fontSize: 9,
                letterSpacing: 0.5,
                color: C.burgundy,
              }}
            >
              {t("shelf.manage")}
            </button>
            <button
              onClick={onClose}
              style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
            >
              <X size={13} />
            </button>
          </div>
          <DecorFamily
            hint={t("shelf.dragOntoShelf")}
            types={shelfDecorTypes()}
            leftOf={leftOf}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <DecorFamily
            title={t("shelf.toHangTitle")}
            hint={t("shelf.dragToBack")}
            types={wallDecorTypes()}
            leftOf={leftOf}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          {/* LE CABINET NE VISE PLUS UNE PLANCHE.

              Il s'ouvrait depuis le haut de CHAQUE rayon, et annonçait
              « rayon visé : … » — ce qui était faux : c'est le LÂCHER
              qui décide où l'objet se pose, pas le bouton par lequel on
              a ouvert le tiroir. Un objet pris depuis le chevet se
              déposait très bien sur le rayon principal, et l'écran
              disait le contraire.

              Un seul bouton, hors des planches, et cette phrase-là
              remplace la précédente : elle dit ce qui est vrai. */}
          <CabinetNote style={{ marginTop: 10 }}>{t("shelf.dropDecides")}</CabinetNote>
        </div>
      )}
    </Layer>
  );
}

/* THE ORIENTATION — how far the object leans, and who decided.

   Everything laid on this shelf is askew, and that is intended: the
   lopsidedness comes from the object's identifier, each its own, and it is
   what stops a row looking like a catalogue plate. But chance does not
   know that a frame must sometimes be straight, nor that an imported image
   can arrive lying down.

   Hence a SLIDER, and two fallbacks beside it. The slider because
   orientation is a continuous quantity: one aims at it by eye, on the
   object, and the whole turn fits in one gesture. The two five-degree step
   buttons of before asked for eighteen clicks to lay a frame down — a
   setting one gives up before reaching it. The native slider gives the
   keyboard arrows into the bargain, which the buttons had never offered.

   The fallbacks are the ones a slider cannot give: putting back upright
   falls exactly on zero, which the hand misses by a degree; handing back
   to chance leaves the scale, since "no setting" is not an angle. And as
   long as one has touched nothing, the field shows the SOWN angle rather
   than a zero: it is the one before one's eyes, and the gap between the
   two is exactly what one has come to set. */
const clampRot = (deg) => (((deg % 360) + 540) % 360) - 180;

const OrientField = ({ angle, seeded, onChange }) => {
  const { t } = useTranslation();
  const setValue = angle != null;
  const shown = Math.round(clampRot(Number(setValue ? angle : seeded) || 0));

  return (
    <>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 8.5,
          letterSpacing: 1,
          color: C.inkFaded,
          margin: "12px 0 4px",
        }}
      >
        ORIENTATION
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={shown}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t("shelf.orientation")}
          title={t("shelf.turnTheObject")}
          style={{ flex: 1, minWidth: 0, accentColor: C.ink, cursor: "pointer" }}
        />
        {/* Zero is missed by a degree by hand: the count is also the
            button that falls back on it. */}
        <button
          onClick={() => onChange(0)}
          title={t("shelf.setItStraight")}
          style={{
            all: "unset",
            cursor: "pointer",
            minWidth: 46,
            textAlign: "center",
            padding: "2px 6px",
            fontFamily: F.mono,
            fontSize: 11,
            color: C.ink,
            border: `1px solid ${C.line}`,
          }}
        >
          {shown > 0 ? `+${shown}°` : `${shown}°`}
        </button>
      </div>
      {/* Handing back to chance only makes sense if one took it from chance. */}
      {setValue && (
        <button
          onClick={() => onChange(null)}
          title={t("shelf.resetTilt")}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "block",
            marginTop: 4,
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
          }}
        >
          {t("shelf.atRandom")}
        </button>
      )}
    </>
  );
};

/* The little panel of a laid object — colour, size, inset. Serves the
   categories as well as the decors: they are the shelf's only two things
   whose tint one chooses. */
export function ItemPalette({
  title,
  color,
  size,
  onColor,
  onSize,
  onRemove,
  onClose,
  removeLabel,
  /* No count here any more: a box has no width of its own. It follows the
     wood line's, set in the row's gutter — a single count, in a single
     place. */
  /* A divider's name. The only pattern that writes, hence the only one to
     open this field — the other decors have nothing to say. */
  label,
  onLabel,
  /* The orientation. `rot` can be absent: the object is then at the
     lopsidedness its identifier sowed for it, and `seededRot` says which —
     the field must be able to show the angle one SEES, not a zero that is
     true nowhere. */
  rot,
  seededRot,
  onRot,
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(label ?? "");
  useEffect(() => {
    setDraft(label ?? "");
  }, [label]);
  const commitLabel = () => onLabel?.(draft.trim());

  return (
    <Layer>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      <div
        style={{
          position: "fixed",
          right: 40,
          top: 120,
          zIndex: 45,
          width: 224,
          padding: "12px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: "2px 8px 20px rgba(30,20,10,0.34)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            {title}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}>
            <X size={13} />
          </button>
        </div>

        {onLabel && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                marginBottom: 4,
              }}
            >
              NOM
            </div>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") setDraft(label ?? "");
              }}
              placeholder={t("shelf.unnamed")}
              aria-label={t("shelf.dividerName")}
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                borderBottom: `1px solid ${C.line}`,
                paddingBottom: 2,
                fontFamily: F.mono,
                fontSize: 12,
                color: C.ink,
              }}
            />
          </div>
        )}

        {/* An imported object we cannot tint has no colour: without
            `onColor`, the row of swatches disappears instead of promising
            a setting that would do nothing. */}
        {/* By families, and no longer in a single band. Eight swatches
            could be taken in at a glance; twenty-four in a row are no
            longer a choice but a colour chart, where one looks for
            "something warm" without finding it. The headings are small:
            they file, they do not announce themselves. */}
        {onColor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {CAT_FAMILIES.map((fam) => (
              <div key={fam.key}>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 8,
                    letterSpacing: 1,
                    color: C.inkFaded,
                    marginBottom: 4,
                  }}
                >
                  {t(`palette.families.${fam.key}`).toUpperCase()}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {fam.keys.map((k) => (
                    <button
                      key={k}
                      onClick={() => onColor(k)}
                      title={k}
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: CAT_COLORS[k],
                        border: color === k ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                        transform: `rotate(${(hash(k) % 5) - 2}deg)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {onSize && (
          <>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                margin: "12px 0 4px",
              }}
            >
              TAILLE
            </div>
            {/* Seven calibres no longer fit on a line of two hundred and
                twenty pixels: the band wraps, and the buttons then carry
                their own hairline rather than sticking to one another —
                two edges joined from one rank to the next would make a
                chequerboard instead of a ruler. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {DECOR_SIZES.map(([l, v]) => (
                <button
                  key={l}
                  onClick={() => onSize(v)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "3px 9px",
                    fontFamily: F.mono,
                    fontSize: 10,
                    background: size === v ? C.ink : "transparent",
                    color: size === v ? C.card : C.inkFaded,
                    border: `1px solid ${size === v ? C.ink : C.line}`,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        {onRot && <OrientField angle={rot} seeded={seededRot} onChange={onRot} />}

        <button
          onClick={onRemove}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "block",
            marginTop: 14,
            fontFamily: F.mono,
            fontSize: 10,
            color: C.burgundy,
          }}
        >
          {removeLabel}
        </button>
      </div>
    </Layer>
  );
}

/* THE SHELF — filing by hand, and nothing else.

   There is no "manual mode" any more: the view IS the arrangement.
   Sorting has not disappeared, it has changed nature — it is a gesture one
   gives ("sort by rating"), and no longer a state that would fight with
   the categories. */
