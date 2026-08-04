/* Les contenants : la gouttière de réglage d'une rangée, la rangée
   elle-même, le rayon, le tiroir des mis de côté, l'aperçu d'un boîtier
   ouvert, le cabinet de décors et la palette d'un objet. */
import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { hash, fileNoOf } from "../../domain/seeded";
import { PosterArt } from "../film/PosterArt";
import { InkStars } from "../ui";
import { isUnplaced, CAT_KEYS, addRow, removeRow, clearRow, addCat } from "../../shelf-views";
import { SHELF_KIND, BOX_H, CAT_COLORS, DECOR_TYPES, DECOR_SIZES } from "./constants";
import { FilmBox, DecorItem, CategoryBox, withBreaks } from "./items";

const GutterAct = ({ label, onClick, ink = C.inkFaded }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset",
      cursor: "pointer",
      padding: "3px 0",
      fontFamily: "'Special Elite', monospace",
      fontSize: 10,
      color: ink,
    }}
  >
    {label}
  </button>
);

/* LE COMPTE PAR LIGNE — « auto », ou un nombre qu'on écrit.

   C'était une rangée de boutons tirés d'une liste fermée : 3, 4, 5, 6, 8,
   10, 12. Sept choix imposés, et rien pour qui en voulait sept, ou vingt.
   Un champ ne ferme rien, et tient dans la moitié de la place.

   « auto » n'est pas un nombre parmi les autres, c'est l'ABSENCE de
   nombre : le conteneur grandit avec son contenu jusqu'à la largeur
   disponible, où le repli naturel s'en charge. D'où un interrupteur à
   côté du champ plutôt qu'une valeur de plus dedans — un zéro ou un
   champ vide auraient dit « aucun film par ligne » aussi bien que
   « autant qu'il en tient ».

   Le brouillon est local et ne remonte qu'à la validation : écrire à
   chaque frappe ferait passer par 1 avant 12, et le rayon se replierait
   sous les doigts à chaque chiffre tapé. */
export const PerRowField = React.memo(function PerRowField({ value, onChange, title, max }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const auto = value == null;

  const commit = () => {
    const n = Math.round(Number(draft));
    // un compte qui n'en est pas un rend la main à ce qui était réglé
    if (!draft.trim() || !Number.isFinite(n) || n < 1) {
      setDraft(value == null ? "" : String(value));
      return;
    }
    /* Le tiroir des mis de côté ne fait que 250 px : deux boîtiers y
       tiennent. On ramène donc au possible plutôt que de refuser — on
       corrige la main qui vise trop grand, on ne la repousse pas. */
    const kept = max ? Math.min(n, max) : n;
    setDraft(String(kept));
    if (kept !== value) onChange(kept);
  };

  return (
    <>
      <div
        style={{
          fontFamily: "'Special Elite', monospace",
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
            cursor: "pointer",
            padding: "2px 8px",
            fontFamily: "'Special Elite', monospace",
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
            fontFamily: "'Special Elite', monospace",
            fontSize: 12,
            color: auto ? C.inkFaded : C.ink,
            opacity: auto ? 0.5 : 1,
          }}
        />
        <span style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: C.inkFaded }}>
          {auto ? "au fil de la largeur" : "par ligne"}
        </span>
      </div>
    </>
  );
});

/* LA GOUTTIÈRE — le réglage d'une rangée, à sa gauche.

   Le nombre de films par ligne était un réglage de MUR, le même pour
   toute l'étagère, qu'un intercalaire pouvait seulement surcharger en
   ouvrant sa ligne. Il appartient maintenant à la rangée elle-même, et
   se règle là où on la regarde. */
const RowGutter = React.memo(function RowGutter({ row, shown, acts, capMax }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(row.label || "");
  useEffect(() => {
    setDraft(row.label || "");
  }, [row.label]);

  return (
    <div
      style={{
        position: "relative",
        width: 26,
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
        title={isUnplaced(row) ? "Les films pas encore rangés" : "Réglages de cette ligne"}
        style={{
          all: "unset",
          cursor: "pointer",
          boxSizing: "border-box",
          width: 22,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.paperDark,
          border: `1px solid ${C.line}`,
          borderRight: "none",
          borderRadius: "2px 0 0 2px",
          boxShadow: "1px 1px 0 rgba(43,38,32,0.14)",
          fontFamily: "'Special Elite', monospace",
          fontSize: 9.5,
          color: C.inkFaded,
          // discrète tant qu'on ne s'occupe pas de la rangée
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
            fontFamily: "'Caveat', cursive",
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
          {/* cliquer ailleurs referme : un réglage ne reste pas ouvert */}
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
              title="OBJETS SUR CETTE LIGNE"
              value={row.perRow ?? null}
              max={capMax}
              onChange={(n) => acts.setRow(row.id, { perRow: n })}
            />

            <div
              style={{
                fontFamily: "'Special Elite', monospace",
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                margin: "12px 0 3px",
              }}
            >
              NOM DE LA LIGNE
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
              placeholder="sans nom"
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                borderBottom: `1px solid ${C.line}`,
                paddingBottom: 2,
                fontFamily: "'Lora', serif",
                fontSize: 13,
                color: C.ink,
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
              <GutterAct
                label="+ une ligne au-dessus"
                onClick={() => {
                  acts.addRow(row.id, "before");
                  setOpen(false);
                }}
              />
              <GutterAct
                label="+ une ligne en dessous"
                onClick={() => {
                  acts.addRow(row.id, "after");
                  setOpen(false);
                }}
              />
              <GutterAct
                label="+ une catégorie ici"
                onClick={() => {
                  acts.addCat(row.id);
                  setOpen(false);
                }}
              />
              {!isUnplaced(row) && (
                <>
                  <GutterAct
                    label="vider la ligne"
                    onClick={() => {
                      acts.clearRow(row.id);
                      setOpen(false);
                    }}
                  />
                  <GutterAct
                    label="supprimer la ligne"
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
                  fontFamily: "'Caveat', cursive",
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

/* UNE RANGÉE — sa gouttière, sa planche, et ce qui est posé dessus.

   Une planche par rangée, et non plus une par rayon : c'est ce qu'est une
   étagère, cela donne à la gouttière un objet contre quoi buter, et cela
   fait de la rangée une chose qu'on voit. */
const ShelfRow = React.memo(function ShelfRow({
  row,
  kind,
  films,
  theme,
  dim,
  dnd,
  acts,
  onOpen,
  onEditCat,
  onEditDecor,
  capMax,
  isLast,
  bare,
}) {
  const [shown, setShown] = useState(false);
  const ctx = useMemo(() => ({ kind, rowId: row.id, catId: null }), [kind, row.id]);

  const nodes = row.items
    .map((it) => {
      if (it.t === "c") {
        return (
          <CategoryBox
            key={it.id}
            cat={it}
            kind={kind}
            rowId={row.id}
            films={films}
            dim={dim}
            acts={acts}
            onOpen={onOpen}
            onEdit={onEditCat}
            onEditDecor={onEditDecor}
            onDragStart={dnd.onDragStart}
            onDragEnd={dnd.onDragEnd}
            onDragOverBox={dnd.onBoxOver}
            onCatOver={dnd.onCatOver}
          />
        );
      }
      if (it.t === "d") {
        return (
          <DecorItem
            key={it.id}
            item={it}
            ctx={ctx}
            onEdit={onEditDecor}
            onDragStart={dnd.onDragStart}
            onDragEnd={dnd.onDragEnd}
            onDragOverBox={dnd.onBoxOver}
          />
        );
      }
      const f = films.get(it.id);
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
    })
    .filter(Boolean);

  const empty = nodes.length === 0;
  // la ligne d'arrivée vide ne se montre pas : elle n'a rien à dire
  const hidden = empty && isUnplaced(row);

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "stretch" }}
        onMouseEnter={() => setShown(true)}
        onMouseLeave={() => setShown(false)}
      >
        {!hidden && !bare && <RowGutter row={row} shown={shown} acts={acts} capMax={capMax} />}
        <div
          data-shelf-row
          onDragOver={(e) => dnd.onRowOver(e, ctx)}
          onDrop={(e) => {
            e.preventDefault();
            dnd.onDrop(kind);
          }}
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            minHeight: hidden ? 12 : BOX_H + 26,
            padding: hidden ? 0 : bare ? "14px 2px 0" : "14px 10px 0",
            marginLeft: hidden && !bare ? 26 : 0,
          }}
        >
          {empty && !isUnplaced(row) && (
            <div
              style={{ color: C.inkFaded, fontStyle: "italic", fontSize: 13, padding: "44px 4px" }}
            >
              ligne vide — glissez-y un boîtier
            </div>
          )}
          {withBreaks(nodes, row.perRow)}
          {/* la planche de CETTE rangée */}
          {!hidden && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 12,
                background: `linear-gradient(${theme.wood[0]}, ${theme.wood[1]})`,
                boxShadow: "0 3px 0 rgba(0,0,0,0.18)",
              }}
            />
          )}
        </div>
      </div>
      {/* la couture : y lâcher un boîtier ouvre une rangée neuve */}
      {!isLast && (
        <div
          data-row-seam
          onDragOver={(e) => dnd.onSeamOver(e, kind, row.id)}
          onDrop={(e) => {
            e.preventDefault();
            dnd.onDrop(kind);
          }}
          style={{ height: 10, marginLeft: bare ? 0 : 26 }}
        />
      )}
    </>
  );
});

/* Un rayon : ses rangées, empilées dans son cadre. La planche n'est plus
   ici — chaque rangée porte la sienne. */
export function Shelf({
  kind,
  title,
  tag,
  shelf,
  count,
  onOpen,
  dnd,
  acts,
  films,
  theme,
  dim,
  onEditCat,
  onEditDecor,
  onCabinet,
}) {
  const cfg = SHELF_KIND[kind];
  const rows = shelf?.rows || [];

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 600,
            fontSize: 21,
            color: C.ink,
          }}
        >
          {title ?? cfg.title}
        </div>
        <div
          style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: 10,
            color: C.inkFaded,
            letterSpacing: 1,
          }}
        >
          {count} film{count > 1 ? "s" : ""}
        </div>
        {(tag ?? cfg.tag) && (
          <div
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 17,
              color: C.burgundy,
              transform: "rotate(-3deg)",
            }}
          >
            {tag ?? cfg.tag}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => acts.addRow(null, "end", kind)}
          title="Ajouter une ligne à la fin du rayon"
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "'Special Elite', monospace",
            fontSize: 9.5,
            letterSpacing: 1,
            color: C.inkFaded,
            border: `1px dashed ${C.line}`,
            padding: "3px 8px",
          }}
        >
          + LIGNE
        </button>
        <button
          onClick={() => onCabinet(kind)}
          title="Poser un objet sur une planche"
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "'Special Elite', monospace",
            fontSize: 9.5,
            letterSpacing: 1,
            color: C.inkFaded,
            border: `1px dashed ${C.line}`,
            padding: "3px 8px",
          }}
        >
          + DÉCOR
        </button>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver(kind);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop(kind);
        }}
        style={{
          position: "relative",
          background: cfg.tint || "transparent",
          border: cfg.border
            ? `1px ${kind === "reserve" ? "solid" : "dashed"} ${cfg.border}${kind === "reserve" ? "" : "59"}`
            : "none",
          borderBottom: "none",
          borderRadius: cfg.border ? "3px 3px 0 0" : 0,
          padding: "10px 10px 0",
          transition: "background .15s ease",
        }}
      >
        {/* la teinte du thème, à l'intérieur du rayon SEULEMENT : repeindre
            le fond de la page se battrait avec le vignettage du papier */}
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
        {rows.map((row, i) => (
          <ShelfRow
            key={row.id}
            row={row}
            kind={kind}
            films={films}
            theme={theme}
            dim={dim}
            dnd={dnd}
            acts={acts}
            onOpen={onOpen}
            onEditCat={onEditCat}
            onEditDecor={onEditDecor}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/* LE TIROIR — les mis de côté.

   En bas de page, ce rayon obligeait à traverser toute la collection pour
   y déposer un film ; et comme il grandissait avec le temps, il repoussait
   la collection vers le haut. Sur le côté, il est atteignable de partout et
   ne prend de la place que lorsqu'on l'ouvre. Fermé, il reste une cible :
   glisser un boîtier sur sa languette l'ouvre tout seul. */
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
  dim,
  onOpen,
  onEditCat,
  onEditDecor,
}) {
  const rows = shelf?.rows || [];
  const filled = rows.some((r) => r.items.length);

  return (
    <>
      {/* la languette, toujours accrochée au bord */}
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
          dnd.onDrop("reserve");
        }}
        title={open ? "Fermer le tiroir" : "Ouvrir les films mis de côté"}
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
          background: `linear-gradient(180deg, ${C.slate}, ${C.slate}cc)`,
          color: C.card,
          fontFamily: "'Special Elite', monospace",
          fontSize: 11,
          letterSpacing: 1.4,
          boxShadow: "-3px 3px 10px rgba(30,20,10,0.32)",
          transition: "right .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
        }}
      >
        {open ? "FERMER" : `MIS DE CÔTÉ${count ? ` · ${count}` : ""}`}
      </button>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver("reserve");
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop("reserve");
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
          // fermé, il ne doit intercepter ni clic ni survol
          visibility: open ? "visible" : "hidden",
        }}
      >
        <div style={{ padding: "18px 16px 10px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 600,
                fontSize: 19,
                color: C.ink,
              }}
            >
              Mis de côté
            </div>
            <div
              style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded }}
            >
              {count}
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setOpen(false)}
              title="Fermer"
              style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 16,
              color: C.inkFaded,
              marginTop: 2,
            }}
          >
            gardés, pas jetés
          </div>
          <button
            onClick={() => acts.addRow(null, "end", "reserve")}
            title="Ajouter une ligne"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-block",
              marginTop: 8,
              fontFamily: "'Special Elite', monospace",
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
                dim={dim}
                dnd={dnd}
                acts={acts}
                onOpen={onOpen}
                onEditCat={onEditCat}
                onEditDecor={onEditDecor}
                isLast={i === rows.length - 1}
                /* Dans un tiroir de 250 px, le réglage par ligne n'a rien à
                 régler : la largeur décide. La rangée y va donc nue, ce
                 qui rend les 26 px de gouttière aux boîtiers. */
                bare
                capMax={2}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* Le boîtier qu'on ouvre. Aperçu seulement : le dossier complet reste
   la fiche, on y va d'un clic depuis ici. */
export function CasePreview({ film, onClose, onOpenFile }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = film.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,10,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 20,
      }}
    >
      <div
        data-case
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(760px, 100%)", perspective: 1400, animation: "caseIn .3s ease both" }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            background: C.card,
            border: `1px solid ${C.line}`,
            minHeight: 330,
            boxShadow: "6px 14px 40px rgba(0,0,0,0.42)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={onClose}
            style={{
              all: "unset",
              position: "absolute",
              top: 10,
              right: 12,
              zIndex: 9,
              cursor: "pointer",
              color: C.inkFaded,
            }}
          >
            <X size={18} />
          </button>
          {/* le rabat, qui s'ouvre vers la gauche */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "50%",
              background: C.paperDark,
              borderRight: `1px solid ${C.line}`,
              transformOrigin: "left center",
              backfaceVisibility: "hidden",
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "openLid .78s cubic-bezier(.22,.9,.25,1) both",
            }}
          >
            <span
              style={{
                transform: "rotate(-90deg)",
                fontFamily: "'Special Elite', monospace",
                fontSize: 11,
                letterSpacing: "0.2em",
                color: C.inkFaded,
                whiteSpace: "nowrap",
              }}
            >
              N° {fileNoOf(film.id)}
            </span>
          </div>
          <div
            style={{
              width: 210,
              flexShrink: 0,
              background: C.paperDark,
              display: "flex",
              alignItems: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "2 / 3",
                border: "1px solid rgba(43,38,32,0.3)",
                boxShadow: "2px 3px 0 rgba(43,38,32,0.18)",
                animation: "slideOut .7s .25s cubic-bezier(.2,.85,.3,1) both",
              }}
            >
              <PosterArt film={film} height={300} initials={initials} plain />
            </div>
          </div>
          <div style={{ flex: 1, padding: "24px 28px", animation: "sheetIn .5s .45s both" }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                fontSize: 26,
                color: C.ink,
              }}
            >
              {film.title}
            </div>
            <div
              style={{
                fontFamily: "'Lora', serif",
                fontStyle: "italic",
                fontSize: 13.5,
                color: C.inkFaded,
                marginTop: 2,
              }}
            >
              {film.director || "anonyme"} · {film.year || "s.d."}
            </div>
            {film.status !== "watchlist" && (
              <div style={{ marginTop: 8 }}>
                <InkStars value={film.rating || 0} size={16} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
              {(film.genres || []).map((g) => (
                <span
                  key={g}
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    border: `1px solid ${C.line}`,
                    color: C.inkFaded,
                    padding: "3px 7px",
                  }}
                >
                  {g}
                </span>
              ))}
              {film.chevet && (
                <span
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    border: `1px solid ${C.burgundy}`,
                    color: C.burgundy,
                    padding: "3px 7px",
                  }}
                >
                  FILM DE CHEVET
                </span>
              )}
              {film.archived && (
                <span
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    border: `1px solid ${C.slate}`,
                    color: C.slate,
                    padding: "3px 7px",
                  }}
                >
                  MIS DE CÔTÉ
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: "'Lora', serif",
                fontSize: 14,
                lineHeight: 1.65,
                color: C.ink,
                marginTop: 14,
                maxHeight: 120,
                overflow: "hidden",
              }}
            >
              {film.review?.trim() ? (
                film.review.replace(/\[img:\d+\]/g, "").slice(0, 260)
              ) : (
                <span style={{ fontStyle: "italic", color: C.inkFaded }}>
                  Pas encore de note. Le boîtier attend son feuillet.
                </span>
              )}
            </div>
            <button
              onClick={() => onOpenFile(film.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                marginTop: 18,
                padding: "9px 16px",
                background: C.burgundy,
                color: C.card,
                fontFamily: "'Special Elite', monospace",
                fontSize: 11,
                letterSpacing: 1,
              }}
            >
              OUVRIR LE DOSSIER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Le rangement à la main. Déposer écrit un `order` sur chaque boîtier du
   rayon d'arrivée : sans numéro stable, l'ordre repartirait au tri par
   défaut au prochain rendu. */
/* Le cabinet de curiosités : ce qu'on peut poser sur une planche. Chaque
   motif s'en tire au glisser — et ce glissement-là ne DÉPLACE rien, il
   CRÉE : l'objet n'existe pas encore quand on l'empoigne. */
export function DecorCabinet({ kind, onDragStart, onDragEnd, onClose }) {
  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      <div
        style={{
          position: "fixed",
          right: 40,
          top: 120,
          zIndex: 45,
          width: 240,
          padding: "12px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: "2px 8px 20px rgba(30,20,10,0.34)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div
            style={{
              fontFamily: "'Special Elite', monospace",
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            CABINET DE CURIOSITÉS
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}>
            <X size={13} />
          </button>
        </div>
        <div
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 15,
            color: C.inkFaded,
            marginBottom: 8,
          }}
        >
          glissez un objet sur une planche
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DECOR_TYPES.map((d) => {
            const Draw = d.draw,
              Icon = d.icon;
            return (
              <div
                key={d.key}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  onDragStart(d.key, e.currentTarget);
                }}
                onDragEnd={onDragEnd}
                title={d.label}
                style={{
                  width: 46,
                  height: 46,
                  cursor: "grab",
                  flexShrink: 0,
                  overflow: "hidden",
                  border: `1px solid ${C.line}`,
                  background: C.paper,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Un motif qui se DRESSE n'a ni dessin ni pictogramme :
                    il est fait de papier et de bordures, comme la boîte.
                    Le cabinet en montre donc une maquette, au lieu de
                    chercher un composant qui n'existe pas. */}
                {d.tall ? (
                  <div
                    style={{
                      width: 13,
                      height: 34,
                      background: `linear-gradient(160deg, ${C.paperDark}, #D8C69C)`,
                      border: `1px solid ${C.line}`,
                      borderBottom: "none",
                      borderTop: `2px solid ${C.ochre}`,
                      borderRadius: "2px 2px 0 0",
                      boxShadow: "1px 1px 0 rgba(43,38,32,0.14)",
                      alignSelf: "flex-end",
                      marginBottom: 6,
                    }}
                  />
                ) : Icon ? (
                  <Icon size={20} color={C.inkFaded} />
                ) : (
                  <Draw
                    color={C.ochre}
                    width={40}
                    w={40}
                    style={{ position: "relative", width: 40, height: 40 }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div
          style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: C.inkFaded, marginTop: 8 }}
        >
          rayon visé : {SHELF_KIND[kind]?.title || kind}
        </div>
      </div>
    </>
  );
}

/* Le petit panneau d'un objet posé — couleur, taille, retrait. Sert aux
   catégories comme aux décors : ce sont les deux seules choses de
   l'étagère dont on choisit la teinte. */
export function ItemPalette({
  title,
  color,
  size,
  onColor,
  onSize,
  onRemove,
  onClose,
  removeLabel,
  /* Le compte d'une boîte : elle range, elle a donc une largeur à régler,
     là où un bibelot n'en a pas. */
  perRow,
  onPerRow,
  /* Le nom d'un intercalaire. Seul motif à écrire, donc seul à ouvrir ce
     champ — les autres décors n'ont rien à dire. */
  label,
  onLabel,
}) {
  const [draft, setDraft] = useState(label ?? "");
  useEffect(() => {
    setDraft(label ?? "");
  }, [label]);
  const commitLabel = () => onLabel?.(draft.trim());

  return (
    <>
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
              fontFamily: "'Special Elite', monospace",
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
                fontFamily: "'Special Elite', monospace",
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
              placeholder="sans nom"
              aria-label="Nom de l'intercalaire"
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                borderBottom: `1px solid ${C.line}`,
                paddingBottom: 2,
                fontFamily: "'Special Elite', monospace",
                fontSize: 12,
                color: C.ink,
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {CAT_KEYS.map((k) => (
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

        {onPerRow && (
          <div style={{ marginTop: 14 }}>
            <PerRowField
              title="FILMS PAR LIGNE DANS LA BOÎTE"
              value={perRow ?? null}
              onChange={onPerRow}
            />
          </div>
        )}

        {onSize && (
          <>
            <div
              style={{
                fontFamily: "'Special Elite', monospace",
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                margin: "12px 0 4px",
              }}
            >
              TAILLE
            </div>
            <div style={{ display: "flex" }}>
              {DECOR_SIZES.map(([l, v], i) => (
                <button
                  key={l}
                  onClick={() => onSize(v)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "3px 12px",
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 10,
                    background: size === v ? C.ink : "transparent",
                    color: size === v ? C.card : C.inkFaded,
                    border: `1px solid ${size === v ? C.ink : C.line}`,
                    marginLeft: i === 0 ? 0 : -1,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onRemove}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "block",
            marginTop: 14,
            fontFamily: "'Special Elite', monospace",
            fontSize: 10,
            color: C.burgundy,
          }}
        >
          {removeLabel}
        </button>
      </div>
    </>
  );
}

/* L'ÉTAGÈRE — le rangement à la main, et rien d'autre.

   Il n'y a plus de « mode manuel » : la vue EST l'agencement. Le tri n'a
   pas disparu, il a changé de nature — c'est un geste qu'on donne
   (« ranger par note »), et non plus un état qui se battrait avec les
   catégories. */
