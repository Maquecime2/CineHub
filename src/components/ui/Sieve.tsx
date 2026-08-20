/* ============================================================
   UN TAMIS QUI NE PREND PAS TOUTE LA TABLE
   ============================================================

   DIX-NEUF GENRES ET ONZE DÉCENNIES, EN PASTILLES, TOUJOURS DÉPLIÉES.
   Le haut du classeur était fait de deux longues rangées qu'on ne lit
   pas — on les balaie — et qui poussaient les affiches sous la ligne de
   flottaison. Or un filtre est fermé la plupart du temps : c'est une
   chose qu'on ouvre pour choisir, pas un bandeau qu'on regarde.

   ET ON PEUT EN COCHER PLUSIEURS, ce qui n'était pas possible. Un seul
   genre à la fois obligeait à choisir entre « policier » et « noir »
   pour une même envie, et entre deux décennies voisines pour une même
   période. Plusieurs cases dans le MÊME tamis s'additionnent (l'un OU
   l'autre) ; deux tamis se posent l'un sur l'autre (l'un ET l'autre).

   IL RESTE DANS LA COLONNE DE VUE. `position: absolute` sous son bouton,
   et non un `Layer` : c'est l'exception assumée de la doctrine pour un
   menu ancré à son déclencheur, parce que le sortir de la colonne
   romprait l'ancrage. Voir le budget de `z-index` dans `CLAUDE.md`.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, tap } from "../../theme/styles";

export interface SieveOption {
  /** Ce qui est retenu. C'est aussi la clé React. */
  value: string;
  label: string;
  /** L'encre de cette option, quand elle en porte une. */
  ink?: string;
}

export function Sieve({
  label,
  options,
  chosen,
  onChange,
  tour,
}: {
  label: string;
  options: SieveOption[];
  chosen: readonly string[];
  onChange: (next: string[]) => void;
  tour?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  /* Cliquer ailleurs referme. Une modale aurait son voile pour cela ; un
     menu ancré n'en a pas, et ne doit pas en avoir — le reste de l'écran
     continue de répondre pendant qu'on choisit. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  if (options.length === 0) return null;

  const toggle = (value: string) =>
    onChange(chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value]);

  /* CE QUE LE BOUTON DIT UNE FOIS FERMÉ. Un seul choix se nomme — c'est
     l'information la plus utile et elle tient. Au-delà, le nombre : trois
     noms bout à bout font une ligne plus longue que la rangée qu'on vient
     de replier. */
  const said =
    chosen.length === 0
      ? t("sieve.any")
      : chosen.length === 1
        ? (options.find((o) => o.value === chosen[0])?.label ?? chosen[0]!)
        : t("sieve.several", { count: chosen.length });

  return (
    <div ref={box} style={{ position: "relative" }} data-tour={tour}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          all: "unset" as const,
          ...tap,
          boxSizing: "border-box",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 10px",
          border: `1px solid ${chosen.length ? C.ink : C.line}`,
          background: chosen.length ? alpha(C.ink, 0.06) : "transparent",
          fontFamily: F.mono,
          fontSize: 10.5,
          color: C.ink,
          transition: "background var(--motion-fast) var(--motion-ease)",
        }}
      >
        <span style={{ color: C.inkFaded, letterSpacing: 1 }}>{label}</span>
        <span>{said}</span>
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 10,
            minWidth: 190,
            maxHeight: 280,
            overflowY: "auto",
            padding: 4,
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: `2px 5px 16px ${alpha(C.ink, 0.24)}`,
          }}
        >
          {/* VIDER EST UN GESTE À PART, et non « décocher les trois ».
              Sans lui, revenir à « tout » demande autant de clics qu'on
              en a faits. Absent quand il n'y a rien à vider. */}
          {chosen.length > 0 && (
            <button
              onClick={() => onChange([])}
              style={{
                ...bare,
                ...tap,
                display: "flex",
                width: "100%",
                justifyContent: "flex-start",
                padding: "5px 7px",
                cursor: "pointer",
                fontFamily: F.mono,
                fontSize: 10,
                color: C.burgundy,
              }}
            >
              {t("sieve.clear")}
            </button>
          )}
          {options.map((o) => {
            const on = chosen.includes(o.value);
            return (
              <button
                key={o.value}
                role="option"
                aria-selected={on}
                onClick={() => toggle(o.value)}
                style={{
                  ...bare,
                  ...tap,
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 7,
                  padding: "5px 7px",
                  cursor: "pointer",
                  fontFamily: F.body,
                  fontSize: 14,
                  color: o.ink ?? C.ink,
                  background: on ? alpha(o.ink ?? C.ink, 0.1) : "transparent",
                }}
              >
                {/* La coche occupe sa place même éteinte : sans cela, la
                    liste entière se décale au premier clic. */}
                <span style={{ width: 13, flexShrink: 0, display: "flex" }}>
                  {on && <Check size={13} />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
