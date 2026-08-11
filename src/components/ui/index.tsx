/* ============================================================
   PRIMITIVES — les petites pièces réemployées d'une vue à l'autre.
   ============================================================ */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Star, KeyRound } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { ouvrirReglageTmdb } from "../../services/tmdbKey";

/** La note, en étoiles d'encre. Un clic sur une étoile déjà pleine la coupe en deux. */
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
   LE CARTON — le contenant commun des blocs d'une fiche
   ============================================================

   Chaque bloc s'était fait sa propre boîte au fil du temps : la fiche
   catalogue avait un filet et un fond, la pellicule et le fil rouge
   n'avaient rien du tout, et les champs de texte flottaient sur le
   papier. Mis côte à côte en colonnes, ça ne se lisait plus comme une
   fiche mais comme quatre pages différentes posées ensemble.

   Un seul contenant, donc. Ce qu'il porte garde SON registre — le titre
   italique d'une grande section n'est pas l'intitulé d'un champ, et les
   confondre effacerait ce qui distingue « La pellicule » de « Mots-clés ».
   On unifie la boîte, pas ce qu'on écrit dessus. */
export function Carton({
  children,
  style,
  onFocusCapture,
  tour,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** Le carton d'un champ sert aussi à savoir où l'on écrit. */
  onFocusCapture?: () => void;
  /** Nom de l'ancre que la visite guidée vient chercher ici. */
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
   IL MANQUE UNE CLÉ — le manque, dit à voix haute
   ============================================================

   Sans clé TMDB, huit écrans s'éteignaient en silence : les Découvertes
   ne découvraient rien, le tiroir du soir ne proposait rien, le choix
   d'affiche n'offrait aucune affiche. Une vue vide ne dit pas « il
   manque un réglage » — elle dit « il n'y a rien », et on referme.

   Ce cartouche prend la place que le contenu aurait prise, et il porte
   ce qu'il faut pour sortir du manque : un bouton qui ouvre le tiroir.
   On ne renvoie donc jamais `null` faute de clé ; on renvoie ceci. */
export function SansCle({ quoi, style }: { quoi: string; style?: CSSProperties }) {
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
        Il manque une clé TMDB pour {quoi}.
      </span>
      <button
        onClick={ouvrirReglageTmdb}
        style={{
          all: "unset",
          cursor: "pointer",
          fontFamily: F.hand,
          fontSize: 14,
          color: C.burgundy,
          textDecoration: "underline",
        }}
      >
        La régler ici
      </button>
    </div>
  );
}

/* Le titre d'une grande section : l'icône, le nom à la plume, le filet
   qui court jusqu'au bout, et de quoi poser un bouton au bord. C'était la
   mise en tête de la pellicule ; le fil rouge en avait une presque
   pareille, à un filet près. Une seule maintenant. */
export function TitreSection({
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

/** La ligne de conduite sous un titre de section, à main levée. */
export function Consigne({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, margin: "0 0 12px" }}>
      {children}
    </div>
  );
}

/** L'intitulé d'un champ, tapé à la machine. */
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
/* Un champ qui se lit comme une liste séparée par des virgules.

   Naïvement, on rendait `value={liste.join(", ")}` et on renvoyait le
   découpage à chaque frappe. Mais taper la virgule produit un dernier
   morceau vide, que le découpage jette : le `join` recomposait aussitôt
   la même chaîne SANS la virgule, et le curseur reculait d'un cran. Il
   devenait impossible d'ouvrir un second genre.

   On garde donc le TEXTE tel qu'il est tapé tant que le champ est vivant,
   et on ne renvoie la liste que découpée à côté. La chaîne ne se
   recompose depuis la liste que lorsque celle-ci change par ailleurs
   (TMDB qui remplit la fiche, une remise à zéro du formulaire). */
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
export type { DemandeConfirmation } from "./Confirmation";
