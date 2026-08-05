/* Les contenants : la gouttière de réglage d'une rangée, la rangée
   elle-même, le rayon, le tiroir des mis de côté, l'aperçu d'un boîtier
   ouvert, le cabinet de décors et la palette d'un objet. */
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { X, Trash2, Upload, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { wallStyle, materialStyle, PLANK_SHADOW } from "../../theme/surfaces";
import { hash, fileNoOf } from "../../domain/seeded";
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
  shelfDecorTypes,
  wallDecorTypes,
} from "./constants";
import {
  listCustomDecor,
  listHiddenDecor,
  toggleDecorHidden,
  subscribeCustomDecor,
  addCustomDecor,
  removeCustomDecor,
} from "../../services/customDecor";
import { CustomDraw } from "./CustomDraw";
import { FilmBox, DecorItem, WallItem, CategoryBox, dividerSkin, DividerHead } from "./items";
import { splitRow, useRowCap } from "./lines";

const GutterAct = ({ label, onClick, ink = C.inkFaded }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset",
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

/* LE COMPTE PAR LIGNE — « auto », ou un nombre qu'on écrit.

   C'était une rangée de boutons tirés d'une liste fermée : 3, 4, 5, 6, 8,
   10, 12. Sept choix imposés, et rien pour qui en voulait sept, ou vingt.
   Un champ ne ferme rien, et tient dans la moitié de la place.

   « auto » n'est pas un nombre parmi les autres, c'est l'ABSENCE de
   nombre écrit : la rangée se mesure et prend le compte de sa largeur
   (voir `useRowCap`, dans `lines.js`). Elle laissait auparavant replier
   le navigateur, qui ne sait pas poser de bois sous ce qu'il replie.
   D'où un interrupteur à côté du champ plutôt qu'une valeur de plus
   dedans — un zéro ou un champ vide auraient dit « aucun film par
   ligne » aussi bien que
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
          boxShadow: `1px 1px 0 ${alpha(C.ink, 0.14)}`,
          fontFamily: F.mono,
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
              title="BOÎTIERS PAR LIGNE DE BOIS"
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
                fontFamily: F.body,
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

/* LA PLANCHE — le bois d'UNE ligne. Il y en a autant que de lignes, et
   c'est tout le propos : une bande de boîtiers qui n'a rien dessous
   n'est pas une étagère.

   Elle n'est plus forcément du bois. Mais tant que la vue n'a pas choisi
   de matériau, elle est CE QU'ELLE ÉTAIT : les deux stops du thème, à
   l'hexadécimal près, sans veinage ni reflet. Le matériau n'est pas une
   reformulation de l'existant, c'est une porte à côté — et c'est ce qui
   permet d'affirmer qu'une vue d'hier est identique au pixel. */
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

/* UNE RANGÉE — sa gouttière, ses planches, et ce qui est posé dessus.

   Une planche par rangée, et non plus une par rayon : c'est ce qu'est une
   étagère, cela donne à la gouttière un objet contre quoi buter, et cela
   fait de la rangée une chose qu'on voit.

   Et maintenant une planche par LIGNE de la rangée. Le repli était laissé
   au navigateur, qui ne sait pas poser du bois : dès qu'une rangée passait
   à la ligne, les boîtiers du haut flottaient au-dessus du vide. La rangée
   découpe donc elle-même son contenu en lignes (`splitRow`), et chaque
   ligne est une bande à elle, avec sa planche. Une boîte trop grande ne se
   replie plus à l'intérieur d'elle-même : elle déborde sur la ligne du
   dessous, bois compris. */
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
  const [shown, setShown] = useState(false);
  const ctx = useMemo(() => ({ kind, rowId: row.id, catId: null }), [kind, row.id]);

  /* La mesure se prend sur l'enveloppe, qui n'a pas de marge intérieure :
     ce sont les BANDES qui la portent, et on la retire donc à la main —
     sinon la dernière case déborderait de sa planche. */
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
        <div ref={measure} style={{ flex: 1, minWidth: 0, marginLeft: hidden && !bare ? 26 : 0 }}>
          {drawn.map((nodes, i) => (
            <div
              /* Chaque LIGNE est une rangée aux yeux du glissement : la
                 cible se dit en voisin (`overId`) et non en numéro, donc
                 découper la bande ne dérange rien — et lâcher dans le vide
                 d'une ligne vise désormais la fin de CETTE ligne, ce qui
                 est ce qu'on montrait du doigt. */
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
                  ligne vide — glissez-y un boîtier
                </div>
              )}
              {nodes}
              {/* la planche de CETTE ligne */}
              {!hidden && <Plank theme={theme} plank={plank} />}
            </div>
          ))}
        </div>
      </div>
      {/* la couture : y lâcher un boîtier ouvre une rangée neuve */}
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

/* Un rayon : ses rangées, empilées dans son cadre. La planche n'est plus
   ici — chaque rangée porte la sienne. */
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
  /* Le décor du MUR, tel que la vue l'a enregistré — ou rien, et le
     rayon reste celui d'avant les peintures. */
  wallDecor,
  dim,
  onEditCat,
  onEditDecor,
  onDecorLabel,
  onCabinet,
}) {
  const cfg = SHELF_KIND[kind];
  const rows = shelf?.rows || [];

  /* Le fond du rayon, teinte du rayon comprise : trois choses qui se
     disputaient la même propriété se composent maintenant en un endroit.
     Recalculé au changement de décor seulement — c'est un style qui vit
     sur le nœud que le glissement survole cent fois par geste. */
  const skin = useMemo(
    /* Sans encre choisie, on n'en invente pas une : `catInk` rendrait du
       bordeaux pour une clé absente, là où un papier peint sans consigne
       veut la teinte discrète du module. */
    () =>
      wallStyle(
        wallDecor,
        wallDecor?.patternInk ? catInk(wallDecor.patternInk) : undefined,
        cfg.tint
      ),
    [wallDecor, cfg.tint]
  );

  return (
    <div style={{ marginTop: 26 }}>
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
        {(tag ?? cfg.tag) && (
          <div
            style={{
              fontFamily: F.hand,
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
        <button
          onClick={() => onCabinet(kind)}
          title="Poser un objet sur une planche"
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: F.mono,
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
          /* Le seul dépôt qui sache OÙ, au pixel près : c'est le cadre du
             rayon qui sert de repère aux objets accrochés. */
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
        {/* LA TEXTURE DU MUR — la seule des trois couches qui soit un
            calque, parce qu'elle se fond et qu'un fond ne se fond pas.
            Même façon d'être que la teinte juste au-dessus : au fond, en
            multiply, et transparente au curseur. */}
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

        {/* LE MUR — une couche à part, par-dessus les rangées.

            Elle était d'abord AU FOND, ce qui était juste : un cadre est
            accroché derrière l'étagère, pas devant. Mais une rangée occupe
            toute la largeur du rayon et cent-soixante-dix pixels de haut ;
            empilées, elles recouvraient le mur en entier. Les objets
            accrochés étaient donc dessinés dessous et INJOIGNABLES — le
            clic allait toujours à la rangée.

            La couche passe donc devant, et ne laisse passer le curseur
            que sur les objets eux-mêmes : le reste du mur reste une zone
            de dépôt pour les rangées. C'est aussi ce qui rend ces objets
            visibles, ce qu'ils n'étaient qu'à peine.

            Elle est bornée par `inset: 0`, et c'est elle — pas le cadre du
            rayon — que le dépôt mesure : les deux doivent compter dans la
            même boîte, sinon les dix pixels de marge du rayon décalent
            tout ce qu'on pose. */}
        {/* La couche ne rogne plus. `overflow: hidden` était la ceinture
            de la borne posée au dépôt : un objet ne pouvant pas dépasser
            de son rayon, il ne pouvait pas intercepter ce qu'on lâchait
            sur le rayon voisin. Les deux sont tombés ensemble — on veut
            désormais pouvoir punaiser dans un angle, quitte à ce que
            l'objet morde sur le bord, et l'interception se règle
            autrement (voir `tokens.ts` : le temps d'un glissement, un
            objet accroché ne reçoit plus le curseur).

            Elle reste `inset: 0` : c'est elle, et non le cadre du rayon,
            que le dépôt mesure — les deux doivent compter dans la même
            boîte, sinon les dix pixels de marge du rayon décalent tout ce
            qu'on pose. */}
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
  plankDecor,
  dim,
  onOpen,
  onEditCat,
  onEditDecor,
  onDecorLabel,
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
          dnd.onDrop("reserve", e);
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
          background: `linear-gradient(180deg, ${C.slate}, ${alpha(C.slate, 0.8)})`,
          color: C.card,
          fontFamily: F.mono,
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
          // fermé, il ne doit intercepter ni clic ni survol
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
              Mis de côté
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>{count}</div>
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
              fontFamily: F.hand,
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
                fontFamily: F.mono,
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
                border: `1px solid ${alpha(C.ink, 0.3)}`,
                boxShadow: `2px 3px 0 ${alpha(C.ink, 0.18)}`,
                animation: "slideOut .7s .25s cubic-bezier(.2,.85,.3,1) both",
              }}
            >
              <PosterArt film={film} height={300} initials={initials} plain />
            </div>
          </div>
          <div style={{ flex: 1, padding: "24px 28px", animation: "sheetIn .5s .45s both" }}>
            <div
              style={{
                fontFamily: F.title,
                fontWeight: 700,
                fontSize: 26,
                color: C.ink,
              }}
            >
              {film.title}
            </div>
            <div
              style={{
                fontFamily: F.body,
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
                    fontFamily: F.mono,
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
                    fontFamily: F.mono,
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
                    fontFamily: F.mono,
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
                fontFamily: F.body,
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
                fontFamily: F.mono,
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
/* Une famille du cabinet. Il y en a deux et elles ne se posent pas du
   même geste : l'une se glisse sur une planche, entre deux boîtiers ;
   l'autre au fond du rayon, où l'on veut. Les mêlanger dans une seule
   grille laissait l'utilisateur découvrir la différence en ratant son
   dépôt. */
const DecorFamily = ({ title = "À POSER", hint, types, onDragStart, onDragEnd }) => (
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
      {title}
    </div>
    <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginBottom: 6 }}>
      {hint}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {types.map((d) => {
        const Draw = d.draw;
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
            {/* Un motif qui se DRESSE n'a pas de dessin : il est fait de
                papier et de bordures, comme la boîte. Le cabinet en montre
                donc une maquette, au lieu de chercher un composant qui
                n'existe pas. */}
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
                {/* la maquette porte le même onglet que le carton : c'est
                    à lui qu'on le reconnaît une fois posé */}
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

/* Le registre des motifs importés, lu comme une source extérieure : le
   cabinet et l'atelier en montrent la même liste, et un import fait
   depuis l'un doit apparaître dans l'autre sans qu'on les ait câblés
   l'un à l'autre. */
const useCustomDecor = () =>
  useSyncExternalStore(subscribeCustomDecor, listCustomDecor, listCustomDecor);

const useHiddenDecor = () =>
  useSyncExternalStore(subscribeCustomDecor, listHiddenDecor, listHiddenDecor);

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

/* L'ATELIER — ce qu'on apporte soi-même au cabinet.

   Les quinze motifs de la maison sont dessinés dans le code : c'est un
   fond de catalogue, il ne bouge pas et ne se supprime pas. Ici on
   ajoute les siens, et on ne peut retirer que ceux-là.

   La famille se choisit AVANT l'import, et non après : elle décide de la
   façon dont le dessin s'appuie dans sa case — posé sur le bas, accroché
   par le haut — et c'est écrit dans le fichier au moment où on le range. */
function DecorWorkshop({ onBack }) {
  const custom = useCustomDecor();
  const hiddenKeys = useHiddenDecor();
  const [wall, setWall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const take = async (files) => {
    setError(null);
    setBusy(true);
    try {
      /* Un fichier refusé n'annule pas les autres : on importe ce qui
         passe et on ne rapporte que ce qui a échoué. */
      const failed = [];
      for (const file of Array.from(files)) {
        try {
          await addCustomDecor(file, { wall });
        } catch (e) {
          failed.push(e?.message || file.name);
        }
      }
      if (failed.length) setError(failed[0]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={CABINET_BOX}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <button
          onClick={onBack}
          title="Revenir au cabinet"
          aria-label="Revenir au cabinet"
          style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}
        >
          <ChevronLeft size={13} />
        </button>
        <CabinetTitle>MES OBJETS</CabinetTitle>
      </div>

      <CabinetNote style={{ marginBottom: 8 }}>
        une image, et elle rejoint le cabinet — png, jpg ou svg
      </CabinetNote>

      {/* La famille d'abord : c'est elle qui décide où l'objet se posera,
          et la choisir après coup voudrait dire réécrire le fichier. */}
      <div style={{ display: "flex", marginBottom: 8 }}>
        {[
          [false, "à poser"],
          [true, "à accrocher"],
        ].map(([v, label], i) => (
          <button
            key={label}
            onClick={() => setWall(v)}
            style={{
              all: "unset",
              cursor: "pointer",
              flex: 1,
              textAlign: "center",
              padding: "3px 0",
              fontFamily: F.mono,
              fontSize: 9.5,
              background: wall === v ? C.ink : "transparent",
              color: wall === v ? C.card : C.inkFaded,
              border: `1px solid ${wall === v ? C.ink : C.line}`,
              borderLeft: i ? "none" : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.svg"
        multiple
        onChange={(e) => e.target.files?.length && take(e.target.files)}
        style={{ display: "none" }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: busy ? "progress" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          padding: "7px 0",
          background: C.burgundy,
          color: C.card,
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Upload size={12} />
        {busy ? "IMPORT…" : "IMPORTER UNE IMAGE"}
      </button>

      {error && (
        <div
          role="alert"
          style={{
            fontFamily: F.hand,
            fontSize: 14,
            color: C.burgundy,
            marginTop: 6,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 12, maxHeight: 300, overflowY: "auto" }}>
        <WorkshopSection title="LES MIENS" />
        {custom.length === 0 ? (
          <CabinetNote>rien d'importé pour l'instant</CabinetNote>
        ) : (
          custom.map((d) => (
            <DecorRow
              key={d.key}
              label={d.label}
              note={`${d.wall ? "à accrocher" : "à poser"}${d.tintable ? "" : " · sans couleur"}`}
              vignette={
                <CustomDraw
                  motif={d.key}
                  color={C.ochre}
                  style={{ width: "100%", height: "100%" }}
                />
              }
              action={
                <RowButton
                  onClick={() => removeCustomDecor(d.key)}
                  label={`Supprimer « ${d.label} »`}
                >
                  <Trash2 size={12} />
                </RowButton>
              }
            />
          ))
        )}

        {/* Les dessins de la maison ne se suppriment pas — ils sont dans
            le code. Mais on n'a pas besoin des quinze, et le cabinet se
            range en les retirant du panneau. */}
        <WorkshopSection title="CEUX DE LA MAISON" />
        {DECOR_TYPES.map((d) => {
          const hidden = hiddenKeys.includes(d.key);
          const Draw = d.draw;
          return (
            <DecorRow
              key={d.key}
              label={d.label}
              note={d.wall ? "à accrocher" : "à poser"}
              dim={hidden}
              vignette={
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
                  label={hidden ? `Remettre « ${d.label} »` : `Masquer « ${d.label} »`}
                >
                  {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </RowButton>
              }
            />
          );
        })}
      </div>

      <CabinetNote style={{ marginTop: 8 }}>
        {/* Deux gestes voisins qui ne font pas la même chose : le dire
            une fois ici vaut mieux qu'une étagère qui se vide sans
            prévenir. */}
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

const RowButton = ({ onClick, label, children }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}
  >
    {children}
  </button>
);

/* Une ligne de l'atelier : la vignette, le nom, et le geste qu'on peut
   faire dessus. La même pour un objet importé et pour un dessin de la
   maison — ils se lisent dans la même liste, ils doivent se ressembler. */
const DecorRow = ({ label, note, vignette, action, dim }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 0",
      // un motif masqué reste lisible, mais s'efface de moitié
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
      {vignette}
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
      <CabinetNote style={{ fontSize: 12 }}>{dim ? "masqué" : note}</CabinetNote>
    </div>
    {action}
  </div>
);

export function DecorCabinet({ kind, onDragStart, onDragEnd, onClose }) {
  const [managing, setManaging] = useState(false);
  // le registre bouge sous le cabinet dès qu'on importe depuis l'atelier
  useCustomDecor();

  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      {managing ? (
        <DecorWorkshop onBack={() => setManaging(false)} />
      ) : (
        <div style={CABINET_BOX}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <CabinetTitle>CABINET DE CURIOSITÉS</CabinetTitle>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setManaging(true)}
              title="Importer ou supprimer vos propres objets"
              style={{
                all: "unset",
                cursor: "pointer",
                fontFamily: F.mono,
                fontSize: 9,
                letterSpacing: 0.5,
                color: C.burgundy,
              }}
            >
              GÉRER
            </button>
            <button
              onClick={onClose}
              style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
            >
              <X size={13} />
            </button>
          </div>
          <DecorFamily
            hint="glissez-les sur une planche, entre deux boîtiers"
            types={shelfDecorTypes()}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <DecorFamily
            title="À ACCROCHER"
            hint="glissez-les au fond du rayon, où vous voulez"
            types={wallDecorTypes()}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <CabinetNote style={{ marginTop: 10 }}>
            rayon visé : {SHELF_KIND[kind]?.title || kind}
          </CabinetNote>
        </div>
      )}
    </>
  );
}

/* L'ORIENTATION — de combien l'objet penche, et qui l'a décidé.

   Tout ce qui se pose sur cette étagère est de travers, et c'est voulu :
   le guingois vient de l'identifiant de l'objet, chacun le sien, et
   c'est ce qui empêche une rangée de ressembler à une planche de
   catalogue. Mais le hasard ne sait pas qu'un cadre doit parfois être
   droit, ni qu'une image importée peut arriver couchée.

   D'où un CURSEUR, et deux recours à côté. Le curseur parce que
   l'orientation est une grandeur continue : on la vise à l'œil, sur
   l'objet, et le tour entier tient dans un geste. Les deux boutons d'un
   cran de cinq degrés d'avant demandaient dix-huit clics pour coucher un
   cadre — un réglage qu'on abandonne avant de l'atteindre. Le curseur
   natif donne en prime les flèches du clavier, que les boutons n'avaient
   jamais offertes.

   Les recours sont ceux qu'un curseur ne sait pas donner : remettre
   d'aplomb tombe pile sur zéro, que la main rate d'un degré ; rendre la
   main au hasard sort de l'échelle, puisque « pas de réglage » n'est pas
   un angle. Et tant qu'on n'a rien touché, le champ affiche l'angle SEMÉ
   plutôt qu'un zéro : c'est celui qu'on a sous les yeux, et l'écart entre
   les deux est exactement ce qu'on vient régler. */
const clampRot = (deg) => (((deg % 360) + 540) % 360) - 180;

const OrientField = ({ angle, seeded, onChange }) => {
  const réglé = angle != null;
  const shown = Math.round(clampRot(Number(réglé ? angle : seeded) || 0));

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
          aria-label="Orientation"
          title="Faire tourner l'objet"
          style={{ flex: 1, minWidth: 0, accentColor: C.ink, cursor: "pointer" }}
        />
        {/* Zéro se rate d'un degré à la main : le compte est aussi le
            bouton qui y retombe. */}
        <button
          onClick={() => onChange(0)}
          title="Remettre d'aplomb"
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
      {/* Rendre la main au hasard n'a de sens que si on la lui a prise. */}
      {réglé && (
        <button
          onClick={() => onChange(null)}
          title="Rendre à l'objet son guingois d'origine"
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
          au hasard
        </button>
      )}
    </>
  );
};

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
  /* Plus de compte ici : une boîte n'a pas de largeur à elle. Elle suit
     celle de la ligne de bois, réglée dans la gouttière de la rangée —
     un seul compte, à un seul endroit. */
  /* Le nom d'un intercalaire. Seul motif à écrire, donc seul à ouvrir ce
     champ — les autres décors n'ont rien à dire. */
  label,
  onLabel,
  /* L'orientation. `rot` peut être absent : l'objet est alors au guingois
     que son identifiant lui a semé, et `seededRot` dit lequel — le champ
     doit pouvoir montrer l'angle qu'on VOIT, pas un zéro qui n'est vrai
     nulle part. */
  rot,
  seededRot,
  onRot,
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
              placeholder="sans nom"
              aria-label="Nom de l'intercalaire"
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

        {/* Un objet importé qu'on ne sait pas teinter n'a pas de couleur :
            sans `onColor`, la rangée de pastilles disparaît au lieu de
            promettre un réglage qui ne ferait rien. */}
        {/* Par familles, et non plus en une seule bande. Huit pastilles
            se parcouraient du regard ; vingt-quatre alignées ne sont
            plus un choix mais un nuancier, où l'on cherche « quelque
            chose de chaud » sans le trouver. Les intitulés sont menus :
            ils rangent, ils ne s'annoncent pas. */}
        {onColor && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {CAT_FAMILIES.map((fam) => (
              <div key={fam.label}>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 8,
                    letterSpacing: 1,
                    color: C.inkFaded,
                    marginBottom: 4,
                  }}
                >
                  {fam.label.toUpperCase()}
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
            {/* Sept calibres ne tiennent plus sur une ligne de deux cent
                vingt pixels : la bande se replie, et les boutons portent
                alors leur propre filet plutôt que de se coller l'un à
                l'autre — deux bords accolés d'un rang à l'autre feraient
                un damier au lieu d'une réglette. */}
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
    </>
  );
}

/* L'ÉTAGÈRE — le rangement à la main, et rien d'autre.

   Il n'y a plus de « mode manuel » : la vue EST l'agencement. Le tri n'a
   pas disparu, il a changé de nature — c'est un geste qu'on donne
   (« ranger par note »), et non plus un état qui se battrait avec les
   catégories. */
