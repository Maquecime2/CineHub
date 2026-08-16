/* ============================================================
   PRIMITIVES — the small pieces reused from one view to the next.
   ============================================================ */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Star, KeyRound } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { openTmdbSettings } from "../../services/tmdbKey";
import i18n from "../../i18n";

/** The rating, in ink stars. Clicking an already full star halves it. */
export function InkStars({
  value = 0,
  onChange,
  size = 15,
}: {
  value?: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const editable = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <span
            key={n}
            onClick={editable ? () => onChange(n === value ? n - 0.5 : n) : undefined}
            style={{
              cursor: editable ? "pointer" : "default",
              position: "relative",
              lineHeight: 0,
            }}
          >
            <Star
              size={size}
              color={C.burgundy}
              fill={filled ? C.burgundy : "none"}
              strokeWidth={1.4}
            />
            {half && (
              <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden" }}>
                <Star size={size} color={C.burgundy} fill={C.burgundy} strokeWidth={1.4} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================
   THE CARDSTOCK — the shared container of a card's blocks
   ============================================================

   Each block had made itself its own box over time: the catalogue card
   had a rule and a background, the filmstrip and the red thread had
   nothing at all, and the text fields floated on the paper. Set side by
   side in columns, it no longer read as one card but as four different
   pages laid together.

   One container, then. What it carries keeps ITS OWN register — a large
   section's italic title is not a field's label, and confusing the two
   would erase what tells "La pellicule" from "Mots-clés". We unify the
   box, not what is written on it. */
export function Cardstock({
  children,
  style,
  onFocusCapture,
  tour,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** A field's cardstock also serves to know where one is writing. */
  onFocusCapture?: () => void;
  /** Name of the anchor the guided tour comes looking for here. */
  tour?: string;
}) {
  return (
    <div
      onFocusCapture={onFocusCapture}
      data-tour={tour}
      style={{
        border: `1px solid ${C.line}`,
        background: C.paperDark,
        padding: "13px 15px 15px",
        transition: "border-color .2s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   A KEY IS MISSING — the lack, said out loud
   ============================================================

   With no TMDB key, eight screens went dark in silence: Discoveries
   discovered nothing, the evening drawer suggested nothing, the poster
   picker offered no poster. An empty view does not say "a setting is
   missing" — it says "there is nothing here", and you close it again.

   This cartouche takes the place the content would have taken, and it
   carries what is needed to get out of the lack: a button that opens the
   drawer. So we never return `null` for want of a key; we return this. */
export function NoKey({ what, style }: { what: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.line}`,
        background: alpha(C.ochre, 0.07),
        padding: "12px 14px",
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 6,
        ...style,
      }}
    >
      <KeyRound size={13} color={C.inkFaded} style={{ transform: "translateY(2px)" }} />
      <span style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
        Il manque une key TMDB pour {what}.
      </span>
      {/* TWO REMEDIES, AND THE SECOND ASKS FOR NONE. Since the server
          relays TMDB, an open account does away with the key entirely —
          it is even the first thing an account brings, instead of copying
          elsewhere what we already had. Say it HERE, where the lack makes
          itself felt, rather than in a screen nobody opens. */}
      <button
        onClick={openTmdbSettings}
        style={{
          all: "unset",
          cursor: "pointer",
          fontFamily: F.hand,
          fontSize: 14,
          color: C.burgundy,
          textDecoration: "underline",
        }}
      >
        {i18n.t("tmdbKey.setItHere")}
      </button>
      <span style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
        — ou ouvrez un compte, qui vous en dispense.
      </span>
    </div>
  );
}

/* A large section's title: the icon, the name in pen, the rule running
   to the end, and room to set a button at the edge. It was the
   filmstrip's heading; the red thread had an almost identical one, give
   or take a rule. Only one now. */
export function SectionTitle({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
      {icon}
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 21,
          color: C.ink,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      <div
        style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, transform: "translateY(-4px)" }}
      />
      {action}
    </div>
  );
}

/* The line of guidance under a section title, in a free hand.

   TWO SPACINGS, AND THE REASON IS THE NEIGHBOUR ABOVE. Under a section
   title, the line breathes below and not above — the title has already
   made the gap. Under a paragraph or a field, it is the other way round.
   The quiz and the lists had each re-declared the second version at the
   foot of their file rather than pass a word here, and that is how a
   primitive gets forked in silence. */
export function Guideline({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 17,
        color: C.inkFaded,
        margin: tight ? "8px 0 0" : "0 0 12px",
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   « PAS ENCORE » N'EST PAS « AUCUN »
   ============================================================

   Les vues du hall partaient d'un tableau vide et affichaient donc leur
   phrase de vide — « vous n'avez aucune liste », « aucun défi en cours »
   — PENDANT que la requête était en vol. Sur une connexion lente c'est
   une affirmation fausse, et le contenu qui la remplace ensuite fait
   sauter la mise en page par-dessus le marché.

   Ce n'est pas un tourniquet : `App` a déjà tranché la question pour le
   chargement d'une vue, et l'argument tient ici — un rond qui tourne
   serait la seule pièce venue d'ailleurs dans une application qui est un
   carnet. Ce sont donc des LIGNES RÉGLÉES, comme celles qu'on attend de
   voir se remplir.

   L'ANIMATION EST UNE OPACITÉ ET RIEN D'AUTRE. La direction artistique
   réserve les effets chers aux moments, pas aux listes ; et sa durée
   passe par `--motion-slow`, que le bloc `prefers-reduced-motion` met à
   zéro tout seul.
   ============================================================ */
export function Waiting({ lines = 3, label }: { lines?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ margin: "10px 0 12px", display: "flex", flexDirection: "column", gap: 9 }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            height: 1,
            borderBottom: `1px solid ${C.line}`,
            /* Des longueurs INÉGALES et TENUES : une ligne réglée qui
               s'arrête au même endroit que sa voisine ne ressemble à
               rien d'écrit. Elles sont dérivées de l'indice, jamais
               tirées au sort — un cadre qui gigote n'est pas un cadre. */
            width: `${[92, 74, 84, 63, 88][i % 5]}%`,
            opacity: 0.75,
            animation: "waitingFade var(--motion-slow) var(--motion-ease) infinite alternate",
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* THE HEAD OF A VIEW — the icon, the name, the hand-written line.

   The quiz, the lists AND the feed drew it identically, to the pixel:
   same padding, same italic thirty-four, same eighteen in a free hand.
   Only the icon, its tint, the two sentences — and, for the feed, a
   hundred pixels of width — ever changed. Three copies of one block in a
   project of this size is what happens when the three files are never
   read on the same day. The counter would have been the fourth. */
export function ViewHeading({
  icon,
  title,
  blurb,
  children,
  wide,
}: {
  /** Already coloured by the caller: the tint belongs to the tab. */
  icon: ReactNode;
  title: string;
  blurb: string;
  children?: ReactNode;
  /* LE FIL PREND TOUTE LA LARGEUR, et lui seul.

     Les autres vues alignent une COLONNE DE TEXTE : mille pixels y sont
     une limite de lisibilité, pas une contrainte de place — une ligne
     qui traverse un écran de vingt-sept pouces ne se lit plus, l'œil
     perd le début en arrivant à la fin. Le fil, lui, range des AFFICHES
     en grille, et une grille n'a pas ce problème : plus elle est large,
     plus elle montre, et rien n'y devient plus difficile à lire.

     Il portait cent pixels de plus dans sa version recopiée, ce qui
     était la moitié du raisonnement — assez pour qu'on ne remarque pas
     qu'il en manquait la moitié. */
  wide?: boolean;
}) {
  return (
    <div style={{ padding: "34px 24px 70px", maxWidth: wide ? "none" : 1000 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        {icon}
        <h1
          style={{
            margin: 0,
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 34,
            color: C.ink,
          }}
        >
          {title}
        </h1>
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginBottom: 24 }}>
        {blurb}
      </div>
      {children}
    </div>
  );
}

/* THE SHARE OF ONE SINGLE THING — a bar, a name, a count.

   Not to be confused with `Honours` just below, which ranks SEVERAL
   lines against each other and scales them on the largest. Here there is
   one row, and the bar says a fraction of a whole known in advance: four
   films seen out of nine, eleven answers out of twenty. The quiz and the
   lists had the same seven pixels of height, the same faded ground and
   the same fixed column of a hundred and ten for the name — twice.

   The width transition goes through `--motion-slow`, so that a progress
   that moves does not jump, and so that reduced motion switches it off
   with everything else. */
export function Meter({
  name,
  done,
  total,
  ink = C.burgundy,
  faded,
  note,
}: {
  /** Absent: the bar alone, with no column of name. */
  name?: string;
  done: number;
  total: number;
  ink?: string;
  /** The share is drawn, but paler — a thing begun and not finished. */
  faded?: boolean;
  /** What is added after the count: "still playing", a date, a rank. */
  note?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
      {name !== undefined && (
        <span
          style={{ fontFamily: F.mono, fontSize: 10.5, color: C.ink, width: 110, flexShrink: 0 }}
        >
          {name}
        </span>
      )}
      <span
        style={{
          flex: 1,
          height: 7,
          background: alpha(C.ink, 0.08),
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Against the WHOLE, never against the best of the rows: a bar
            that filled the width because everybody did badly would
            flatter the entire table. */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            right: "auto",
            width: `${total ? (100 * done) / total : 0}%`,
            background: faded ? alpha(ink, 0.4) : ink,
            transition: "width var(--motion-slow) var(--motion-ease)",
          }}
        />
      </span>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
        {done}/{total}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

/** A field's label, typed on a machine. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: C.inkFaded,
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}
/** What is written when a section has nothing to show. */
export function Nothing({ what }: { what: string }) {
  return <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>{what}</div>;
}

/* ============================================================
   CE QUI A RATÉ — une seule forme, pour tout le classeur
   ============================================================

   IL Y EN AVAIT CINQ. `trouble` au comptoir, `souci` dans le fil, `msg`
   au générique, `error` au bureau des découvertes, `keyState` dans le
   cartouche — cinq noms, cinq styles écrits à la main, et cinq façons de
   dire la même chose selon le fichier qu'on lisait.

   ET AUCUNE N'ÉTAIT ANNONCÉE. Pas un `role="alert"` sur un seul message
   d'erreur du produit : quelqu'un qui navigue à la voix cliquait, rien
   ne se passait, et rien ne le lui disait non plus. C'est la raison
   principale de ce composant — l'uniformité n'est que le bénéfice.

   LE VERDICT SE DIT PAR UN MOT ET PAS PAR UNE COULEUR. Le bordeaux
   disparaît sous cinq des dix-sept peaux ; c'est le trait vertical à
   gauche, épais, qui reste lisible partout, et le texte qui porte le
   sens. La couleur n'est qu'un accent de plus.
   ============================================================ */
export function Trouble({
  children,
  onRetry,
  retryLabel,
}: {
  children: ReactNode;
  /** Un rattrapage, quand il y en a un. Sans lui, on ne dessine rien. */
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (!children) return null;
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        margin: "8px 0",
        padding: "6px 10px 7px",
        borderLeft: `3px solid ${C.burgundy}`,
        background: alpha(C.burgundy, 0.07),
        fontFamily: F.hand,
        fontSize: 16,
        color: C.ink,
      }}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: F.mono,
            fontSize: 9.5,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.burgundy,
            borderBottom: `1px dotted ${alpha(C.burgundy, 0.6)}`,
          }}
        >
          {retryLabel ?? i18n.t("common.retry")}
        </button>
      )}
    </div>
  );
}

/* A small horizontal rule: the share of each entry of a ranking.

   The number of lines is TRUNCATED BY THE CALLER, never hidden here:
   that is what guarantees a board does not overflow without anyone
   knowing.

   It lived in the almanac, where it draws the loyalties and the trades.
   The credits' folder asks the very same question of its own figures —
   who comes back with this person — and a second, almost identical
   ranking would have drifted from the first at the third change. */
export function Honours({
  items,
  total,
  ink = C.ochre,
  empty,
  onPick,
  pickTitle,
}: {
  items: { name: string; n: number }[];
  total: number;
  ink?: string;
  /** What to say when there is nothing. */
  empty: string;
  /** Makes each name clickable. Absent: the ranking stays plain text. */
  onPick?: (name: string) => void;
  /** The title borne by a clickable name — "what I have of them". */
  pickTitle?: (name: string) => string;
}) {
  if (items.length === 0) return <Nothing what={empty} />;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 3 }}>
      {items.map((it) => (
        <div key={it.name}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontFamily: F.body,
              fontSize: 12.5,
              color: C.ink,
            }}
          >
            {onPick ? (
              /* A dotted line of ink, as on the film card: the notebook
                 does not underline in blue what one can follow. */
              <button
                onClick={() => onPick(it.name)}
                title={pickTitle ? pickTitle(it.name) : it.name}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  borderBottom: `1px dotted ${C.inkFaded}`,
                }}
              >
                {it.name}
              </button>
            ) : (
              <span
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={it.name}
              >
                {it.name}
              </span>
            )}
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded, flexShrink: 0 }}>
              {it.n}
              {total > 0 ? ` · ${Math.round((it.n / total) * 100)}%` : ""}
            </span>
          </div>
          <div style={{ height: 3.5, background: alpha(C.line, 0.5), marginTop: 2 }}>
            <div style={{ height: "100%", width: `${(it.n / max) * 100}%`, background: ink }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* A field that reads as a comma-separated list.

   Naively, we rendered `value={list.join(", ")}` and returned the split
   on every keystroke. But typing the comma produces a last empty piece,
   which the split throws away: the `join` immediately recomposed the same
   string WITHOUT the comma, and the caret moved back one notch. Opening a
   second genre became impossible.

   So we keep the TEXT as it is typed for as long as the field is alive,
   and only return the list split off to the side. The string is only
   recomposed from the list when that list changes elsewhere (TMDB filling
   the card in, a form being reset). */
export function CommaInput({
  value,
  onChange,
  style,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    setText(joined);
  }
  return (
    <input
      style={style}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const list = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setSeen(list.join(", "));
        onChange(list);
      }}
      onBlur={() => setText(value.join(", "))}
    />
  );
}

export { Tally } from "./Tally";
export { Confirmation } from "./Confirmation";
export type { ConfirmRequest } from "./Confirmation";
