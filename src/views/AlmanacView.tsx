/* ============================================================
   VIEW — THE ALMANAC, in four boards one leafs through
   ============================================================

   An archivist's page of accounts: what the year contained, kept by hand
   on cards laid askew, and not a grid of counters. The whole computation
   lives in `domain/almanac` — this view only draws what it returns, and
   therefore has no rule of its own.

   WHY SEVERAL BOARDS, AND NO SCROLLING.

   A page of an almanac is looked at, it does not unroll: what goes past
   the edge does not exist for the reader, and a scrollbar to the right
   of a yearly account confesses that composing it was given up. But an
   account that fits in one screen does not say much.

   Hence the booklet. Each board takes up EXACTLY the available height,
   and one turns the page — with the arrow, with the keyboard, or by
   clicking a pill. Four boards are worth four times the room without
   costing a single pixel of scrolling.

   WHAT GUARANTEES THAT NONE OVERFLOWS. The boards are grids with fixed
   rows, never flows: the height is decided in advance and shared out,
   instead of being suffered. And above all, what could be long is
   truncated BY THE COMPUTATION — a ranking returns four lines, not
   forty. An `overflow: hidden` would have hidden the data without saying
   so, which is worse than a scrollbar.

   THE BARS ARE DRAWN, NOT DRAWN-BY-A-LIBRARY. Twelve rectangles with an
   irregular stroke are worth more than a charting dependency, and they
   are the only ones able to hold on the fourteen skins: their ink is a
   token, not a colour.

   NOT ONE HARD-CODED COLOUR HERE. A single one would suffice to break
   half the skins — the control board (`views/dev/SkinLab`) is there to
   see it coming. */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { tap, tapSquare } from "../theme/styles";
import {
  almanacFor,
  driftHighlights,
  filmsOfYear,
  yearsCovered,
  type Almanac,
  type Drift,
  type Period,
} from "../domain/almanac";
import { drawYearInBox, download, type BoxPalette } from "../services/yearInBox";
import { hash, seededRand, tiltOf } from "../domain/seeded";
import { CoffeeRing, InkUnderline, PushPin, StampCorner, Tape } from "../components/atmosphere";
import { InkStars, Label, Tally } from "../components/ui";
import { motifById } from "../domain/motifs";
import { languageName, countryName } from "../names";
import type { Film } from "../types";

const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MOIS_LONG = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/* "2024-03-07" → "7 mars". The year is left unsaid because it is
   already in the page's title — but only when the title IS a year: "du
   25 janvier au 24 décembre" on an account covering seven years makes
   one believe in a single year, and that is precisely the thing this
   account must deny. */
const enClair = (iso: string | null, avecAnnée = false): string => {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-");
  const jour = `${Number(j)} ${MOIS_LONG[Number(m) - 1] || ""}`.trim();
  return avecAnnée ? `${jour} ${a}` : jour;
};

/** 5,430 minutes → "90 h 30". Nobody reads an account in minutes. */
const enHeures = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

/* The names of countries and languages are translated in `namesIn`, and
   not in the domain: `geography` returns ISO codes because it does not
   know in which language it will be read. The film card uses it too. */

/* ------------------------------------------------------------
   THE CARD — the piece every board reuses
   ------------------------------------------------------------ */
function Cardstock({
  titre,
  seed,
  children,
  style,
}: {
  titre: string;
  /** Enough to draw a STABLE lean: a card that wriggles on a re-render
      no longer looks like a laid object. */
  seed: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const penche = tiltOf(seed);
  const punaise = Math.abs(hash(seed)) % 3 === 0;
  return (
    <div
      /* A card is not cut in two between two pages: see
         `theme/print.css`, which hooks onto this attribute. */
      data-print-block
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "3px 5px 12px rgba(30,20,10,0.22)",
        padding: "13px 15px 12px",
        transform: `rotate(${Number(penche) / 7}deg)`,
        /* `minHeight: 0` is what really allows a grid cell to tighten.
           Without it, a grid child refuses to go below the size of its
           content, and it is the BOARD that grows — hence the page that
           scrolls, precisely what is forbidden. */
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {punaise ? (
        <PushPin style={{ top: -6, right: 16 }} />
      ) : (
        <Tape color={C.ochre} width={52} style={{ top: -9, right: 20 }} rotate={5} />
      )}
      <Label>{titre}</Label>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** What is written when a card has nothing to show. */
function Rien({ quoi }: { quoi: string }) {
  return <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>{quoi}</div>;
}

/* A large number, with its caption below. The piece that carries the
   boards: it is what one reads in three seconds. */
function Chiffre({
  valeur,
  legende,
  ink = C.ink,
}: {
  valeur: string | number;
  legende: string;
  ink?: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: F.title,
          fontWeight: 700,
          fontSize: "clamp(22px, 2.6vh, 34px)",
          color: ink,
          lineHeight: 1.05,
        }}
      >
        {valeur}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, letterSpacing: 0.6 }}>
        {legende}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   THE TWELVE MONTHS, IN INK
   ------------------------------------------------------------

   Each bar is a quadrilateral whose four corners move by a hair — drawn
   from the year and the month, hence always the same. A perfect
   rectangle in a handwritten page shows at once; a rectangle that
   trembles does not show at all, which is the point. */
/* Twelve months or seven years: it is the same bar, and the same
   drawing. The chart knows only values and their captions — making it
   believe it was counting months would have forced writing it twice the
   day we wanted to read a whole practice. */
function Barres({
  values,
  légendes,
  graine,
}: {
  values: number[];
  légendes: string[];
  graine: string | number;
}) {
  const W = 300;
  const H = 108;
  const max = Math.max(1, ...values);
  const pas = W / Math.max(1, values.length);
  const largeur = pas * 0.56;
  /* Beyond eight columns, a four-figure year bumps into its neighbour:
     we keep only the last two, which are enough to follow a decade. */
  const étroit = values.length > 8;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H + 16}`}
      preserveAspectRatio="none"
      style={{ display: "block", marginTop: 6 }}
    >
      {values.map((n, i) => {
        const g = i * pas + (pas - largeur) / 2;
        const d = g + largeur;
        const haut = H - (n / max) * (H - 6);
        const jitter = (k: number) => (seededRand(hash(`${graine}-${i}-${k}`)) - 0.5) * 2.2;
        return (
          <g key={i}>
            {n > 0 && (
              <path
                d={`M${g + jitter(1)} ${H} L${g + jitter(2)} ${haut + jitter(3)} L${d + jitter(4)} ${haut + jitter(5)} L${d + jitter(6)} ${H} Z`}
                fill={alpha(C.burgundy, 0.72)}
                stroke={C.burgundy}
                strokeWidth="0.9"
                strokeLinejoin="round"
              />
            )}
            {/* Le count au-dessus de la barre, mais seulement quand il y
                a la place : douze nombres serrés ne se lisent pas. */}
            {n > 0 && n >= max * 0.34 && (
              <text
                x={(g + d) / 2}
                y={haut - 3}
                textAnchor="middle"
                style={{ fontFamily: F.mono, fontSize: 7.5, fill: C.inkFaded }}
              >
                {n}
              </text>
            )}
            <text
              x={(g + d) / 2}
              y={H + 11}
              textAnchor="middle"
              style={{ fontFamily: F.mono, fontSize: étroit ? 7 : 8, fill: C.inkFaded }}
            >
              {étroit ? (légendes[i] || "").slice(-2) : légendes[i]}
            </text>
          </g>
        );
      })}
      {/* la ligne de sol, tracée à main levée */}
      <path
        d={`M0 ${H} C ${W * 0.3} ${H - 1.2}, ${W * 0.6} ${H + 1.2}, ${W} ${H}`}
        fill="none"
        stroke={C.line}
        strokeWidth="1.1"
      />
    </svg>
  );
}

/* A small horizontal rule: the share of each entry of a ranking.

   The number of lines is TRUNCATED BY THE CALLER, never hidden here:
   that is what guarantees a board does not overflow without anyone
   knowing. */
function Palmares({
  items,
  total,
  ink = C.ochre,
  vide = "rien à noter",
  onPick,
}: {
  items: { name: string; n: number }[];
  total: number;
  ink?: string;
  vide?: string;
  /** Makes each name clickable. Absent: the ranking stays plain text. */
  onPick?: (name: string) => void;
}) {
  if (items.length === 0) return <Rien quoi={vide} />;
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
                title={`Ce que j'ai de ${it.name}`}
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

/* ------------------------------------------------------------
   BOARD I — THE COUNT AND THE RHYTHM
   ------------------------------------------------------------ */
function PlancheCompte({ a }: { a: Almanac }) {
  const r = a.rhythm;
  const clé = String(a.period);
  const toujours = a.period === "always";
  /* The days actually covered, so as to say "one screening every so
     many days" without assuming a calendar year. */
  const span = r.density > 0 ? (r.days / r.density) * 100 : 365;
  return (
    <div style={GRILLE_2x2}>
      <Cardstock titre="Le count" seed={`count-${clé}`}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px 6px",
            marginTop: 8,
          }}
        >
          <Chiffre valeur={a.count} legende="SÉANCES" ink={C.burgundy} />
          <Chiffre valeur={a.titles} legende="FILMS" />
          <Chiffre valeur={a.rewatches} legende="REVOYURES" />
          <Chiffre valeur={a.longestStreak} legende="JOURS D'AFFILÉE" />
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            textAlign: "center",
          }}
        >
          du {enClair(a.firstWatch, toujours)} au {enClair(a.lastWatch, toujours)}
        </div>
      </Cardstock>

      {/* Douze mois pour une year, une colonne par year pour toute une
          pratique : c'est la même barre, et la graduation change seule. */}
      {/* PLUS DE `gridColumn: "span 2"` : il était la contrepartie des
          trois colonnes, où il servait à combler la firstSeen rangée. Sur
          un vrai 2×2, il pousserait les deux cartons du bas dans une
          troisième rangée que la grille ne déclare pas — et la planche
          se remettrait à déborder par où on venait de la refermer. */}
      <Cardstock titre={toujours ? "Les années" : "Les mois"} seed={`mois-${clé}`}>
        {toujours ? (
          <Barres
            values={a.byYear.map((y) => y.screenings)}
            légendes={a.byYear.map((y) => String(y.year))}
            graine={clé}
          />
        ) : (
          <Barres values={a.byMonth} légendes={MOIS} graine={clé} />
        )}
      </Cardstock>

      <Cardstock titre="Le rythme" seed={`rythme-${clé}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
          <Tally label="Jours avec séance" value={r.days} ink={C.pine} />
          <Tally
            label={toujours ? "De la period" : "De l'year"}
            value={`${r.density.toFixed(1)} %`}
          />
          <Tally label="Plus longue drought" value={`${r.drought} j`} />
          <Tally
            label="Mois le plus dense"
            value={r.moisLePlusDense ? MOIS_LONG[r.moisLePlusDense - 1] || "—" : "—"}
          />
        </div>
        <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
          {r.days > 0 ? `une séance tous les ${(span / r.days).toFixed(1)} days` : ""}
        </div>
      </Cardstock>

      <Cardstock titre="Les heures de cinéma" seed={`heures-${clé}`}>
        {a.screenTime.minutes === 0 ? (
          <Rien quoi="aucune durée connue — le bouton « compléter les fiches », dans l'onglet Import, va les chercher" />
        ) : (
          <>
            <div style={{ marginTop: 8 }}>
              <Chiffre
                valeur={enHeures(a.screenTime.minutes)}
                legende="DEVANT UN ÉCRAN"
                ink={C.burgundy}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              <Tally
                label="Screening moyenne"
                value={a.screenTime.moyenne ? `${Math.round(a.screenTime.moyenne)} min` : "—"}
              />
              {a.screenTime.plusLong && (
                <Tally
                  label="Le plus long"
                  value={`${a.screenTime.plusLong.runtime} min`}
                  ink={C.slate}
                />
              )}
            </div>
            {/* LE TITRE ALLAIT AVEC LA DURÉE, ET N'ÉTAIT PAS ÉCRIT.
                `plusLong` porte le film entier depuis toujours ; on n'en
                montrait que le nombre de minutes, qui ne dit rien tout
                seul. */}
            {a.screenTime.plusLong && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: F.hand,
                  fontSize: 15,
                  color: C.inkFaded,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.screenTime.plusLong.film.title}
              </div>
            )}
            {/* UN TOTAL QUI S'ANNONCE COMME UN PLANCHER. Taire les screenings
                sans durée donnerait un chiffre faux avec l'aplomb d'un
                chiffre juste. */}
            {a.screenTime.sansDuree > 0 && (
              <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
                au moins — {a.screenTime.sansDuree} séance(s) sans durée connue
              </div>
            )}
          </>
        )}
      </Cardstock>
    </div>
  );
}

/* ------------------------------------------------------------
   BOARD II — TASTES
   ------------------------------------------------------------ */
function PlancheGouts({ a, drifts }: { a: Almanac; drifts: Drift[] }) {
  const maxHisto = Math.max(1, ...a.ratingHistogram);
  const clé = String(a.period);
  const toujours = a.period === "always";
  return (
    <div style={GRILLE_2x2}>
      <Cardstock titre="Les notes" seed={`notes-${clé}`}>
        {a.ratingAvg == null ? (
          <Rien quoi={toujours ? "aucune séance notée" : "aucune séance notée cette year"} />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginTop: 8,
                justifyContent: "center",
              }}
            >
              <InkStars value={Math.round(a.ratingAvg * 2) / 2} size={17} />
              <span style={{ fontFamily: F.mono, fontSize: 14, color: C.ink }}>
                {a.ratingAvg.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginTop: 12 }}>
              {a.ratingHistogram.map((n, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    title={`${i / 2} — ${n} séance${n > 1 ? "s" : ""}`}
                    style={{
                      height: Math.round((n / maxHisto) * 44) + (n > 0 ? 2 : 0),
                      background: n > 0 ? C.slate : alpha(C.line, 0.5),
                      minHeight: 2,
                    }}
                  />
                  {i % 2 === 0 && (
                    <div style={{ fontFamily: F.mono, fontSize: 8, color: C.inkFaded }}>
                      {i / 2}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* L'ÉCART À LA FOULE, sous vos propres notes — c'est le même
                sujet, et la planche ne peut pas porter un carton de plus
                sans déborder. `tmdbRating` était stocké depuis le début
                pour cette mesure exactement, et n'avait jamais servi. */}
            {a.gap.gap != null && (
              <div
                style={{
                  marginTop: 9,
                  fontFamily: F.hand,
                  fontSize: 15,
                  color: C.inkFaded,
                  textAlign: "center",
                }}
              >
                {Math.abs(a.gap.gap) < 0.15 ? (
                  <>d'accord avec le public, sur {a.gap.n} screenings</>
                ) : (
                  <>
                    plus{" "}
                    <span style={{ color: a.gap.gap > 0 ? C.moss : C.vermillion }}>
                      {a.gap.gap > 0 ? "tendre" : "sévère"}
                    </span>{" "}
                    que le public de {Math.abs(a.gap.gap).toFixed(1)} point
                    {Math.abs(a.gap.gap) >= 2 ? "s" : ""}, sur {a.gap.n} screenings
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Cardstock>

      <Cardstock titre="L'âge de ce que you regardez" seed={`age-${clé}`}>
        {a.age.mean == null ? (
          <Rien quoi="aucune year de release renseignée" />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 6px",
                marginTop: 8,
              }}
            >
              <Chiffre
                valeur={`${Math.round(a.age.mean)} years`}
                legende="EN MOYENNE"
                ink={C.pine}
              />
              <Chiffre
                valeur={`${Math.round(a.age.heritageShare ?? 0)} %`}
                legende="DE PLUS DE 20 ANS"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              <Tally label="Médiane" value={`${a.age.median} years`} />
              {a.age.oldest && (
                <Tally label="Le plus ancien" value={a.age.oldest.year} ink={C.burgundy} />
              )}
            </div>
            {a.age.oldest && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: F.hand,
                  fontSize: 15,
                  color: C.inkFaded,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.age.oldest.film.title}
              </div>
            )}
          </>
        )}
      </Cardstock>

      <Cardstock titre="Les décennies visitées" seed={`decennies-${clé}`}>
        {a.decades.length === 0 ? (
          <Rien quoi="aucune year de release renseignée" />
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 10 }}>
            {a.decades.map((d) => {
              const max = Math.max(...a.decades.map((x) => x.n));
              /* The decade's average rating, under its bar: it is that
                 juxtaposition — how many, and loved how much — that shows
                 a bias one does not know one has. */
              const note = a.ratingByDecade.find((x) => x.decade === d.decade);
              return (
                <div key={d.decade} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{d.n}</div>
                  <div
                    style={{
                      height: Math.round((d.n / max) * 46) + 3,
                      background: C.pine,
                      opacity: 0.8,
                    }}
                  />
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.inkFaded }}>
                    {String(d.decade).slice(2)}
                  </div>
                  {/* UNE MOYENNE SANS SON EFFECTIF EST UN CHIFFRE QUI
                      BLUFFE : « 4,5 » sur une seule séance s'affichait
                      exactement comme « 4,5 » sur quarante. `n` est
                      calculé depuis le premier jour et n'avait jamais
                      été écrit. */}
                  <div
                    style={{ fontFamily: F.mono, fontSize: 8.5, color: C.burgundy }}
                    title={note ? `${note.n} séance${note.n > 1 ? "s" : ""} notée(s)` : undefined}
                  >
                    {note ? note.avg.toFixed(1) : "—"}
                  </div>
                  {note && (
                    <div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.inkFaded }}>
                      /{note.n}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Cardstock>

      {/* CE QUI A BOUGÉ — hors de l'year, et c'est délibéré : un film
          qu'on réévalue le fait sur une décennie, pas sur douze mois. */}
      <Cardstock titre="Ce qui a changé d'avis" seed="drift">
        {drifts.length === 0 ? (
          <Rien quoi="aucune note n'a bougé entre deux screenings" />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {drifts.map((d) => (
                <div
                  key={d.film.id}
                  style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}
                >
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 12,
                      color: d.delta > 0 ? C.moss : C.vermillion,
                      minWidth: 26,
                    }}
                  >
                    {d.delta > 0 ? "+" : "−"}
                    {Math.abs(d.delta)}
                  </span>
                  <span
                    style={{
                      fontFamily: F.body,
                      color: C.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.film.title}
                  </span>
                  <span
                    style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, alignSelf: "center" }}
                  />
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 10.5,
                      color: C.inkFaded,
                      flexShrink: 0,
                    }}
                  >
                    {d.from} → {d.to}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
              all années confondues — on ne se ravise pas en douze mois
            </div>
          </>
        )}
      </Cardstock>
    </div>
  );
}

/* ------------------------------------------------------------
   BOARD III — THE PEOPLE AND THE WORLD
   ------------------------------------------------------------ */
function PlancheGens({ a, onOpenPerson }: { a: Almanac; onOpenPerson?: (name: string) => void }) {
  const g = a.geography;
  const clé = String(a.period);
  const toujours = a.period === "always";
  return (
    <div style={GRILLE_2x2}>
      <Cardstock titre="Les cinéastes" seed={`cineastes-${clé}`}>
        {/* Les namesIn mènent au générique : l'almanach dit qui revient,
            le dossier dit ce qu'on a de cette personne. Deux questions
            voisines qui n'avaient aucun chemin l'une vers l'autre. */}
        <Palmares items={a.topDirectors.slice(0, 4)} total={a.count} onPick={onOpenPerson} />
      </Cardstock>

      <Cardstock titre="Les genres" seed={`genres-${clé}`}>
        <Palmares items={a.topGenres.slice(0, 4)} total={a.count} ink={C.moss} />
      </Cardstock>

      <Cardstock
        titre={toujours ? "Les fidélités" : "Fidélités et découvertes"}
        seed={`gens-${clé}`}
      >
        {/* TROIS FOIS DANS UNE ANNÉE N'EST PAS UN HASARD : c'est une
            traversée d'œuvre, et c'est ce qu'un cinéphile veut voir
            nommé. Les découvertes sont l'autre face — les namesIn dont
            c'est la firstSeen apparition au journal, all années
            confondues.

            Sur « toujours », cette seconde face se dissout : tout le
            monde a été découvert un jour. `newDirectors` rend alors une
            list vide, et le carton se referme sur les seules
            fidélités — dont le threshold, lui, a monté. */}
        {a.loyalties.directors.length === 0 &&
        a.loyalties.actors.length === 0 &&
        a.newDirectors.length === 0 ? (
          <Rien
            quoi={
              toujours
                ? `personne ne revient ${SEUIL_TOUJOURS} fois ou plus`
                : "rien qui revienne trois fois, ni aucun name nouveau"
            }
          />
        ) : (
          <div style={{ marginTop: 4 }}>
            {a.loyalties.directors.length > 0 && (
              <div style={{ marginBottom: 7 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>SUIVIS</div>
                <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink }}>
                  {a.loyalties.directors
                    .slice(0, 3)
                    .map((d) => `${d.name} (${d.n})`)
                    .join(" · ")}
                </div>
              </div>
            )}
            {a.loyalties.actors.length > 0 && (
              <div style={{ marginBottom: 7 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>RETROUVÉS</div>
                <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink }}>
                  {a.loyalties.actors
                    .slice(0, 3)
                    .map((d) => `${d.name} (${d.n})`)
                    .join(" · ")}
                </div>
              </div>
            )}
            {a.newDirectors.length > 0 && (
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
                  DÉCOUVERTS ({a.newDirectors.length})
                </div>
                <div
                  style={{
                    fontFamily: F.hand,
                    fontSize: 16,
                    color: C.burgundy,
                    lineHeight: 1.25,
                  }}
                >
                  {a.newDirectors.slice(0, 6).join(", ")}
                  {a.newDirectors.length > 6 ? "…" : ""}
                </div>
              </div>
            )}
          </div>
        )}
      </Cardstock>

      <Cardstock titre="Le monde traversé" seed={`monde-${clé}`}>
        {g.countryCount === 0 ? (
          <Rien quoi="aucun countries renseigné — « compléter les fiches », dans l'onglet Import, va les chercher" />
        ) : (
          <>
            <div style={{ marginTop: 6 }}>
              <Chiffre valeur={g.countryCount} legende="PAYS TRAVERSÉS" ink={C.cobalt} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Palmares
                items={g.countries.slice(0, 3).map((p) => ({ name: countryName(p.name), n: p.n }))}
                total={a.count}
                ink={C.cobalt}
              />
            </div>
            {g.languages.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>LANGUES</div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink }}>
                  {g.languages
                    .slice(0, 4)
                    .map((l) => languageName(l.name))
                    .join(" · ")}
                </div>
              </div>
            )}
          </>
        )}
      </Cardstock>
    </div>
  );
}

/* ------------------------------------------------------------
   BOARD IV — WHAT IT WAS ABOUT, AND WHO MADE IT
   ------------------------------------------------------------

   The first three boards say HOW MANY, HOW RATED and BY WHOM — genres,
   countries, languages, film-makers, performers. None said ABOUT WHAT,
   although the card has carried keywords from TMDB and patterns from the
   common catalogue; nor BY WHOM ELSE, although `crew` carries the
   photography, the music and the screenplay. This board is made of the
   two axes that were missing, plus the half of the gap to the public
   that was never shown. */
function PlancheSujets({ a }: { a: Almanac }) {
  const clé = String(a.period);
  const s = a.subjects;
  const ar = a.craftspeople;
  return (
    <div style={GRILLE_2x2}>
      <Cardstock titre="Les subjects" seed={`subjects-${clé}`}>
        <Palmares
          items={s.keywords.slice(0, 5)}
          total={a.count}
          ink={C.ochre}
          vide="aucun mot-clé — « compléter les fiches », dans l'onglet Import, va les chercher"
        />
      </Cardstock>

      <Cardstock titre="Les motifs suivis" seed={`motifs-${clé}`}>
        {/* Le domaine rend des IDENTIFIANTS, comme il rend des codes
            countries : c'est ici qu'on les lit en français. Un motif retiré
            du catalogue depuis keep son identifiant plutôt que de
            disparaître — la même règle que sur la fiche. */}
        <Palmares
          items={s.motifs
            .slice(0, 5)
            .map((m) => ({ name: motifById(m.name)?.label ?? m.name, n: m.n }))}
          total={a.count}
          ink={C.pine}
          vide="aucun motif posé — ils se choisissent sur une fiche, sous la critique"
        />
      </Cardstock>

      <Cardstock titre="Les craftspeople" seed={`craftspeople-${clé}`}>
        {/* Sans threshold, contrairement aux fidélités : personne ne se dit
            « je suis le travail d'un chef opérateur », et c'est justement
            pour cela que le montrer apprend quelque chose. On ne keep
            que ce qui REVIENT — un name vu une seule fois n'est pas une
            fidélité, c'est un générique. */}
        <MétierSuivi label="IMAGE" gens={ar.image} />
        <MétierSuivi label="MUSIQUE" gens={ar.musique} />
        <MétierSuivi label="SCÉNARIO" gens={ar.scénario} />
        {[ar.image, ar.musique, ar.scénario].every(
          (g) => g.filter((x) => x.n > 1).length === 0
        ) && (
          <Rien quoi="personne ne revient deux fois derrière la caméra — « compléter les fiches », dans l'onglet Import, remplit les équipes" />
        )}
      </Cardstock>

      <Cardstock titre="Plus tendre, plus sévère" seed={`ecart-${clé}`}>
        {a.gap.n === 0 ? (
          <Rien quoi="aucune séance notée dont on connaisse aussi la note publique" />
        ) : (
          <>
            {/* LES DEUX MOYENNES EN CLAIR. La planche des goûts dit already
                « plus tendre de 0,3 point » ; elle ne disait pas de quoi
                à quoi. Les deux nombres étaient calculés depuis le
                premier jour et n'avaient jamais été écrits. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 6px",
                marginTop: 8,
              }}
            >
              <Chiffre
                valeur={a.gap.you?.toFixed(1) ?? "—"}
                legende="VOUS, SUR 10"
                ink={C.burgundy}
              />
              <Chiffre valeur={a.gap.public?.toFixed(1) ?? "—"} legende="LE PUBLIC" />
            </div>
            <div style={{ marginTop: 9 }}>
              <ÉcartListe label="VOS INDULGENCES" films={a.gap.mostGenerous} ink={C.moss} />
              <ÉcartListe label="VOS SÉVÉRITÉS" films={a.gap.mostSevere} ink={C.vermillion} />
            </div>
          </>
        )}
      </Cardstock>
    </div>
  );
}

/** One trade of `crew` — mute when nobody comes back to it twice. */
function MétierSuivi({ label, gens }: { label: string; gens: { name: string; n: number }[] }) {
  const suivis = gens.filter((g) => g.n > 1).slice(0, 3);
  if (suivis.length === 0) return null;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{label}</div>
      <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink }}>
        {suivis.map((g) => `${g.name} (${g.n})`).join(" · ")}
      </div>
    </div>
  );
}

/** Three films and their gap to the crowd, in points out of ten. */
function ÉcartListe({
  label,
  films,
  ink,
}: {
  label: string;
  films: { film: Film; delta: number }[];
  ink: string;
}) {
  if (films.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{label}</div>
      {films.map(({ film, delta }) => (
        <div
          key={film.id}
          style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, marginTop: 2 }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 11, color: ink, minWidth: 30 }}>
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta).toFixed(1)}
          </span>
          <span
            style={{
              fontFamily: F.body,
              color: C.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {film.title}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Two columns, two rows — and rows IN FRACTIONS, which is the whole
   trick: `1fr` shares out the available height instead of asking the
   content for it. So the board is exactly the size it is given, whatever
   it contains.

   IT ANNOUNCED TWO AND LAID THREE. `repeat(3, 1fr)` under a comment that
   said "two columns": the boards therefore filled up with three cards on
   top and a single one below, two empty cells behind, and each card was
   a third smaller than what its content had been written for. That is
   where the truncations everywhere came from — the rankings, the titles,
   "Fidélités et découvertes". Restoring the 2×2 makes them disappear on
   their own, without bounding anything. */
const GRILLE_2x2: CSSProperties = {
  height: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gridTemplateRows: "1fr 1fr",
  gap: 18,
  alignItems: "stretch",
};

/* ------------------------------------------------------------
   LE LIVRET
   ------------------------------------------------------------ */

const PLANCHES = [
  { titre: "Le count et le rythme", tampon: "I" },
  { titre: "Les goûts", tampon: "II" },
  { titre: "Les gens et le monde", tampon: "III" },
  { titre: "Les subjects et les craftspeople", tampon: "IV" },
];

/* The height the header reserves for itself. Hard-coded, and that is
   the price of not scrolling: the board takes "all the rest", and "the
   rest" must be a number. Measuring the header on every render would
   cost a resize observer to gain a few pixels. */
const ENTETE = 178;

/* The loyalty threshold over a whole practice — the domain sets it, the
   view says it again when there is nothing to show. Copied out, yes:
   writing it in full in the sentence "nobody comes back six times" is
   worth more than a number imported for a single sentence. */
const SEUIL_TOUJOURS = 6;

export function AlmanacView({
  films,
  onOpenPerson,
}: {
  films: Film[];
  /** Opens the folder of somebody in the credits. */
  onOpenPerson?: (name: string) => void;
}) {
  const années = useMemo(() => yearsCovered(films), [films]);

  /* THE PERIODS ONE CAN LEAF THROUGH: "toujours" first, then the years
     from the most recent to the oldest.

     At the head and not at the end: it is the booklet's title page, the
     one that says what the whole is made of before going into the detail
     of one year. It only appears from two covered years on — with a
     single one, "toujours" and "cette année" are the same page, and
     offering it twice would only make a duplicate to leaf through. */
  const périodes: Period[] = useMemo(
    () => (années.length > 1 ? ["always", ...années] : années),
    [années]
  );

  const [choisie, setChoisie] = useState<Period | null>(null);
  /* The period being looked at: the one chosen as long as it still
     exists — deleting the last screening of a year makes it disappear
     from the list, and one must not stay on a page that no longer
     exists. */
  const period = choisie != null && périodes.includes(choisie) ? choisie : (périodes[0] ?? null);

  const [planche, setPlanche] = useState(0);

  const a: Almanac | null = useMemo(
    () => (period == null ? null : almanacFor(films, period)),
    [films, period]
  );
  const drifts = useMemo(() => driftHighlights(films, 4), [films]);

  /* THE KEYBOARD ARROWS TURN THE PAGE. It is a booklet's gesture, and
     it costs nothing to whoever does not know it. They do NOT change the
     year: two directions of navigation on the same key would be
     unguessable, and the year has its own pills. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      // do not steal the arrow from somebody who is typing
      if (cible && /^(INPUT|TEXTAREA)$/.test(cible.tagName)) return;
      if (cible?.isContentEditable) return;
      if (e.key === "ArrowRight") setPlanche((p) => Math.min(p + 1, PLANCHES.length - 1));
      if (e.key === "ArrowLeft") setPlanche((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* THE IMAGE TO TAKE AWAY. "en cours" rather than a boolean: the
     drawing waits for the posters to load, and a button that says
     nothing for two seconds passes for broken. */
  const [boîte, setBoîte] = useState<"repos" | "en cours" | "raté">("repos");
  const emporter = async () => {
    /* THE IMAGE IS COMPOSED AROUND A VINTAGE — it is written on it in
       large characters. On "toujours" there is none, and the button does
       not appear: better offer nothing than an image that would invent a
       year. */
    if (typeof period !== "number" || a == null) return;
    setBoîte("en cours");
    try {
      const blob = await drawYearInBox(
        {
          year: period,
          films: filmsOfYear(films, period),
          count: a.count,
          titles: a.titles,
          rewatches: a.rewatches,
          ratingAvg: a.ratingAvg,
          topDirector: a.topDirectors[0]?.name ?? null,
          minutes: a.screenTime.minutes,
          decade: a.decades.length ? a.decades.reduce((m, d) => (d.n > m.n ? d : m)).decade : null,
          country: a.geography.countries[0] ? countryName(a.geography.countries[0].name) : null,
          ageMean: a.age.mean,
        },
        peauPosée()
      );
      download(blob, `cine-hub-${period}.png`);
      setBoîte("repos");
    } catch (e) {
      console.error(e);
      setBoîte("raté");
    }
  };

  if (period == null || a == null) {
    return (
      <div style={{ padding: "34px 44px 70px", maxWidth: 760, position: "relative" }}>
        <StampCorner text="ALMANACH" />
        <Titre />
        <div
          style={{
            marginTop: 26,
            fontFamily: F.hand,
            fontSize: 21,
            color: C.inkFaded,
            lineHeight: 1.5,
          }}
        >
          Aucune séance datée pour l&apos;instant.
          <br />
          L&apos;almanach se remplit tout seul dès qu&apos;une fiche porte une date — en notant une
          séance sur une fiche, ou en relevant son journal depuis l&apos;onglet d&apos;import.
        </div>
      </div>
    );
  }

  /* The rank is taken from the PERIODS and not from the years: the
     arrows must be able to reach "toujours", which opens the
     booklet. */
  const rang = périodes.indexOf(period);
  const allerAnnée = (pas: number) => {
    const suivante = périodes[rang + pas];
    if (suivante != null) setChoisie(suivante);
  };
  const toujours = period === "always";

  return (
    <div
      style={{
        padding: "22px 34px 0",
        position: "relative",
        /* The whole page fits in the window: it is here that the
           absence of scrolling is decided, and nowhere else.

           `100vh` ASSUMES THE ALMANAC STARTS AT THE TOP OF THE COLUMN,
           and that assumption is only true because nothing is ever laid
           above it in the flow. The example collection's banner nearly
           broke it: it goes through `Calque`, precisely so as to
           displace nothing. */
        height: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <StampCorner text="ALMANACH" />
      <CoffeeRing style={{ left: 420, top: 210 }} rotate={-24} />

      {/* ---- L'EN-TÊTE, de hauteur arrêtée ---- */}
      <div style={{ flexShrink: 0, height: ENTETE, boxSizing: "border-box" }}>
        <Titre />

        <div
          data-tour="almanac-year"
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}
        >
          <button
            onClick={() => allerAnnée(1)}
            disabled={rang >= périodes.length - 1}
            aria-label="period précédente"
            style={flecheStyle(rang < périodes.length - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <div
            style={{
              fontFamily: F.title,
              fontWeight: 700,
              /* "TOUJOURS" is longer than a vintage: it fits in the
                 same width by going down one size, rather than by
                 pushing the pills to the right. */
              fontSize: toujours ? 30 : 42,
              fontStyle: toujours ? "italic" : "normal",
              color: C.burgundy,
              lineHeight: 1,
              minWidth: 118,
              textAlign: "center",
            }}
          >
            {toujours ? "always" : period}
          </div>
          <button
            onClick={() => allerAnnée(-1)}
            disabled={rang <= 0}
            aria-label="period suivante"
            style={flecheStyle(rang > 0)}
          >
            <ChevronRight size={17} />
          </button>

          {/* LES PASTILLES TIENNENT SUR UNE LIGNE, ET C'EST UNE CORRECTION.

              Elles étaient en `flexWrap: "wrap"` sous une largeur de
              trois cent quatre-vingts pixels : au-delà de huit années
              couvertes elles passaient sur deux lignes, au-delà de
              quatorze sur trois. L'en-tête, lui, a une hauteur ARRÊTÉE
              (`ENTETE`) — rien ne bornait donc ce débordement, et la
              planche, qui porte `zIndex: 2`, passait par-dessus les
              pastilles et les boutons de planche. Ils devenaient
              incliquables sans que rien n'explique pourquoi.

              Une ligne qui défile plutôt qu'un en-tête qui grandit :
              c'est le parti pris du non-défilement de la page qu'on
              préserve ici, et lui seul qui justifie une hauteur en dur
              au-dessus. */}
          <div
            style={{
              display: "flex",
              gap: 5,
              marginLeft: 8,
              maxWidth: 380,
              overflowX: "auto",
              overflowY: "hidden",
              /* Without this, a flex item lets itself be pushed by its
                 content instead of scrolling. */
              minWidth: 0,
              paddingBottom: 2,
              scrollbarWidth: "thin",
            }}
          >
            {périodes.map((p) => (
              <button
                key={String(p)}
                onClick={() => setChoisie(p)}
                aria-pressed={p === period}
                style={anneeStyle(p === period)}
              >
                {p === "always" ? "TOUJOURS" : p}
              </button>
            ))}
          </div>

          {/* L'ANNÉE EN BOÎTE — la seule chose d'ici qui sorte du
              navigateur, et qui n'existe que pour une year : l'image
              est bâtie autour d'un millésime écrit en gros. */}
          {!toujours && (
            <button
              onClick={emporter}
              data-tour="almanac-export"
              disabled={boîte === "en cours"}
              title="Une image de cette year, à garder ou à montrer"
              style={{
                all: "unset",
                ...tap,
                cursor: boîte === "en cours" ? "progress" : "pointer",
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 13px",
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: "var(--tag-tracking)",
                color: C.card,
                background: C.burgundy,
                borderRadius: "var(--tag-radius)",
                boxShadow: "2px 3px 7px rgba(0,0,0,0.28)",
                opacity: boîte === "en cours" ? 0.6 : 1,
              }}
            >
              <Download size={14} />
              {boîte === "en cours"
                ? "on développe…"
                : boîte === "raté"
                  ? "raté — réessayer"
                  : "l'year en boîte"}
            </button>
          )}
        </div>

        {/* ---- LE FEUILLETAGE ---- */}
        <div
          data-tour="almanac-plates"
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}
        >
          <button
            onClick={() => setPlanche((p) => Math.max(p - 1, 0))}
            disabled={planche === 0}
            aria-label="planche précédente"
            style={flecheStyle(planche > 0)}
          >
            <ChevronLeft size={16} />
          </button>
          {PLANCHES.map((p, i) => (
            <button
              key={p.tampon}
              onClick={() => setPlanche(i)}
              aria-pressed={i === planche}
              style={plancheStyle(i === planche)}
            >
              {p.tampon} · {p.titre}
            </button>
          ))}
          <button
            onClick={() => setPlanche((p) => Math.min(p + 1, PLANCHES.length - 1))}
            disabled={planche === PLANCHES.length - 1}
            aria-label="planche suivante"
            style={flecheStyle(planche < PLANCHES.length - 1)}
          >
            <ChevronRight size={16} />
          </button>
          <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginLeft: 4 }}>
            ou les flèches du clavier
          </span>
        </div>
      </div>

      {/* ---- LA PLANCHE ---- */}
      <div
        /* `key`: without it React reuses the same node and the entry
           animation never replays. See the same pattern in `App`. */
        key={`${period}:${planche}`}
        data-enters
        style={{ flex: 1, minHeight: 0, paddingBottom: 22, position: "relative", zIndex: 2 }}
      >
        {planche === 0 && <PlancheCompte a={a} />}
        {planche === 1 && <PlancheGouts a={a} drifts={drifts} />}
        {planche === 2 && <PlancheGens a={a} onOpenPerson={onOpenPerson} />}
        {planche === 3 && <PlancheSujets a={a} />}
      </div>
    </div>
  );
}

function Titre() {
  return (
    <>
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 36,
          color: C.ink,
          lineHeight: 1.1,
        }}
      >
        L&apos;almanach
      </div>
      <InkUnderline width={200} />
    </>
  );
}

/* THE SKIN IN PLACE, IN RESOLVED VALUES.

   The tokens are references: `C.paper` is the string "var(--c-paper)",
   which means nothing to a canvas. So we ask the document what they are
   worth AT THE MOMENT of the click — the image thus comes out in the
   skin that was laid on, including a night skin.

   Read here and not in the service: it is the view that has the right to
   look at the document. */
function peauPosée(): BoxPalette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, repli: string) => s.getPropertyValue(name).trim() || repli;
  return {
    paper: v("--c-paper", "#EEE3CC"),
    card: v("--c-card", "#F6EFDE"),
    ink: v("--c-ink", "#2B2620"),
    inkFaded: v("--c-ink-faded", "#6E6153"),
    accent: v("--c-burgundy", "#8C3A34"),
    line: v("--c-line", "#C9B98F"),
    title: v("--f-title", "serif"),
    body: v("--f-body", "serif"),
    mono: v("--f-mono", "monospace"),
  };
}

const flecheStyle = (actif: boolean): CSSProperties => ({
  all: "unset",
  ...tapSquare,
  cursor: actif ? "pointer" : "default",
  opacity: actif ? 1 : 0.28,
  color: C.inkFaded,
  border: `1px solid ${C.line}`,
  borderRadius: "50%",
  width: 26,
  height: 26,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const anneeStyle = (actif: boolean): CSSProperties => ({
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: "var(--tag-tracking)",
  padding: "3px 7px",
  /* The bar scrolls: a pill that lets itself be squeezed would give
     "20…" instead of a vintage. */
  flexShrink: 0,
  whiteSpace: "nowrap",
  color: actif ? C.card : C.inkFaded,
  background: actif ? C.burgundy : "transparent",
  border: `1px solid ${actif ? C.burgundy : C.line}`,
  borderRadius: "var(--tag-radius)",
});

const plancheStyle = (actif: boolean): CSSProperties => ({
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: "var(--tag-tracking)",
  textTransform: "var(--tag-transform)" as never,
  padding: "5px 11px",
  color: actif ? C.card : C.inkFaded,
  background: actif ? C.slate : "transparent",
  border: `1px solid ${actif ? C.slate : C.line}`,
  borderRadius: "var(--tag-radius)",
});
