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
import { useTranslation } from "react-i18next";
import { motifById } from "../domain/motifs";
import { languageName, countryName } from "../names";
import type { Film } from "../types";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
/* THE MONTHS ARE NOT IN THE CATALOGUE, and deliberately so: `Intl` knows
   them in every language, keeps each one's capitalisation rules, and will
   go on being right the day a third language arrives. Writing twelve
   names twice by hand would be twelve chances of writing one wrong. */
const monthsLong = (lang: string): string[] =>
  Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { month: "long" }).format(new Date(Date.UTC(2000, i, 1)))
  );

/* "2024-03-07" → "7 mars". The year is left unsaid because it is
   already in the page's title — but only when the title IS a year: "du
   25 janvier au 24 décembre" on an account covering seven years makes
   one believe in a single year, and that is precisely the thing this
   account must deny. */
const spellDate = (iso: string | null, lang: string, withYear = false): string => {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-");
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(Date.UTC(Number(a), Number(m) - 1, Number(j))));
};

/** 5,430 minutes → "90 h 30". Nobody reads an account in minutes. */
const inHours = (minutes: number): string => {
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
  title,
  seed,
  children,
  style,
}: {
  title: string;
  /** Enough to draw a STABLE lean: a card that wriggles on a re-render
      no longer looks like a laid object. */
  seed: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const leans = tiltOf(seed);
  const pin = Math.abs(hash(seed)) % 3 === 0;
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
        transform: `rotate(${Number(leans) / 7}deg)`,
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
      {pin ? (
        <PushPin style={{ top: -6, right: 16 }} />
      ) : (
        <Tape color={C.ochre} width={52} style={{ top: -9, right: 20 }} rotate={5} />
      )}
      <Label>{title}</Label>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** What is written when a card has nothing to show. */
function Nothing({ what }: { what: string }) {
  return <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>{what}</div>;
}

/* A large number, with its caption below. The piece that carries the
   boards: it is what one reads in three seconds. */
function Figure({
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
function Bars({
  values,
  legends,
  seed,
}: {
  values: number[];
  legends: string[];
  seed: string | number;
}) {
  const W = 300;
  const H = 108;
  const max = Math.max(1, ...values);
  const step = W / Math.max(1, values.length);
  const width = step * 0.56;
  /* Beyond eight columns, a four-figure year bumps into its neighbour:
     we keep only the last two, which are enough to follow a decade. */
  const narrow = values.length > 8;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H + 16}`}
      preserveAspectRatio="none"
      style={{ display: "block", marginTop: 6 }}
    >
      {values.map((n, i) => {
        const g = i * step + (step - width) / 2;
        const d = g + width;
        const top = H - (n / max) * (H - 6);
        const jitter = (k: number) => (seededRand(hash(`${seed}-${i}-${k}`)) - 0.5) * 2.2;
        return (
          <g key={i}>
            {n > 0 && (
              <path
                d={`M${g + jitter(1)} ${H} L${g + jitter(2)} ${top + jitter(3)} L${d + jitter(4)} ${top + jitter(5)} L${d + jitter(6)} ${H} Z`}
                fill={alpha(C.burgundy, 0.72)}
                stroke={C.burgundy}
                strokeWidth="0.9"
                strokeLinejoin="round"
              />
            )}
            {/* The count above the bar, but only when there is room:
                twelve numbers squeezed together cannot be read. */}
            {n > 0 && n >= max * 0.34 && (
              <text
                x={(g + d) / 2}
                y={top - 3}
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
              style={{ fontFamily: F.mono, fontSize: narrow ? 7 : 8, fill: C.inkFaded }}
            >
              {narrow ? (legends[i] || "").slice(-2) : legends[i]}
            </text>
          </g>
        );
      })}
      {/* the ground line, drawn freehand */}
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
function Honours({
  items,
  total,
  ink = C.ochre,
  empty,
  onPick,
}: {
  items: { name: string; n: number }[];
  total: number;
  ink?: string;
  /** What to say when there is nothing. Omitted: a plain "nothing to note". */
  empty?: string;
  /** Makes each name clickable. Absent: the ranking stays plain text. */
  onPick?: (name: string) => void;
}) {
  const { t } = useTranslation();
  if (items.length === 0) return <Nothing what={empty ?? t("almanac.nothingToNote")} />;
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
function PlateCount({ a }: { a: Almanac }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const r = a.rhythm;
  const key = String(a.period);
  const always = a.period === "always";
  /* The days actually covered, so as to say "one screening every so
     many days" without assuming a calendar year. */
  const span = r.density > 0 ? (r.days / r.density) * 100 : 365;
  return (
    <div style={GRID_2x2}>
      <Cardstock title="Le compte" seed={`count-${key}`}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px 6px",
            marginTop: 8,
          }}
        >
          <Figure valeur={a.count} legende={t("almanac.viewings")} ink={C.burgundy} />
          <Figure valeur={a.titles} legende="FILMS" />
          <Figure valeur={a.rewatches} legende="REVOYURES" />
          <Figure valeur={a.longestStreak} legende={t("almanac.daysInARow")} />
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
          {t("almanac.fromTo", {
            from: spellDate(a.firstWatch, lang, always),
            to: spellDate(a.lastWatch, lang, always),
          })}
        </div>
      </Cardstock>

      {/* Twelve months for a year, one column per year for a whole
          practice: it is the same bar, and the graduation changes by
          itself. */}
      {/* NO MORE `gridColumn: "span 2"`: it was the counterpart of the
          three columns, where it served to fill the first row up. On a
          real 2×2 it would push the two bottom cards into a third row
          the grid does not declare — and the board would start
          overflowing again through the very place we had just closed. */}
      <Cardstock
        title={always ? t("almanac.theYears") : t("almanac.theMonths")}
        seed={`mois-${key}`}
      >
        {always ? (
          <Bars
            values={a.byYear.map((y) => y.screenings)}
            legends={a.byYear.map((y) => String(y.year))}
            seed={key}
          />
        ) : (
          <Bars values={a.byMonth} legends={MONTHS} seed={key} />
        )}
      </Cardstock>

      <Cardstock title="Le rythme" seed={`rythme-${key}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
          <Tally label={t("almanac.daysWithViewing")} value={r.days} ink={C.pine} />
          <Tally
            label={always ? t("almanac.ofThePeriod") : t("almanac.ofTheYear")}
            value={`${r.density.toFixed(1)} %`}
          />
          <Tally label="Plus longue drought" value={`${r.drought} j`} />
          <Tally
            label="Mois le plus dense"
            value={r.moisLePlusDense ? monthsLong(lang)[r.moisLePlusDense - 1] || "—" : "—"}
          />
        </div>
        <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
          {r.days > 0 ? t("almanac.oneEvery", { days: (span / r.days).toFixed(1) }) : ""}
        </div>
      </Cardstock>

      <Cardstock title={t("almanac.hoursOfCinema")} seed={`heures-${key}`}>
        {a.screenTime.minutes === 0 ? (
          <Nothing what={t("almanac.noRuntimes")} />
        ) : (
          <>
            <div style={{ marginTop: 8 }}>
              <Figure
                valeur={inHours(a.screenTime.minutes)}
                legende={t("almanac.inFrontOfAScreen")}
                ink={C.burgundy}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              <Tally
                label="Screening moyenne"
                value={a.screenTime.moyenne ? `${Math.round(a.screenTime.moyenne)} min` : "—"}
              />
              {a.screenTime.longest && (
                <Tally
                  label="Le plus long"
                  value={`${a.screenTime.longest.runtime} min`}
                  ink={C.slate}
                />
              )}
            </div>
            {/* THE TITLE WENT WITH THE RUNTIME, AND WAS NOT WRITTEN.
                `plusLong` has always carried the whole film; we only
                showed the number of minutes, which says nothing on its
                own. */}
            {a.screenTime.longest && (
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
                {a.screenTime.longest.film.title}
              </div>
            )}
            {/* A TOTAL THAT ANNOUNCES ITSELF AS A FLOOR. Saying nothing
                of the screenings with no runtime would give a false
                figure with the poise of a right one. */}
            {a.screenTime.noRuntime > 0 && (
              <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
                {t("almanac.atLeast", { count: a.screenTime.noRuntime })}
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
function PlateTastes({ a, drifts }: { a: Almanac; drifts: Drift[] }) {
  const { t } = useTranslation();
  const maxHisto = Math.max(1, ...a.ratingHistogram);
  const key = String(a.period);
  const always = a.period === "always";
  return (
    <div style={GRID_2x2}>
      <Cardstock title="Les notes" seed={`notes-${key}`}>
        {a.ratingAvg == null ? (
          <Nothing
            what={always ? t("almanac.noRatedViewing") : t("almanac.noRatedViewingThisYear")}
          />
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
                    title={t("almanac.starViewings", { stars: i / 2, count: n })}
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
            {/* THE GAP TO THE CROWD, under your own ratings — it is the
                same subject, and the board cannot carry one more card
                without overflowing. `tmdbRating` had been stored from the
                start for exactly this measure, and had never served. */}
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
                {/* Two botched substitutions used to read here —
                    "d'accord withCrew le public, sur 12 screenings". The
                    sentence is one string per language now, and half of it
                    can no longer be rewritten without the other. */}
                {Math.abs(a.gap.gap) < 0.15
                  ? t("almanac.agreeWithPublic", { count: a.gap.n })
                  : t(a.gap.gap > 0 ? "almanac.gentlerThan" : "almanac.harsherThan", {
                      points: Math.abs(a.gap.gap).toFixed(1),
                      count: a.gap.n,
                    })}
              </div>
            )}
          </>
        )}
      </Cardstock>

      <Cardstock title="L'âge de ce que vous regardez" seed={`age-${key}`}>
        {a.age.mean == null ? (
          <Nothing what={t("almanac.noReleaseYear")} />
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
              <Figure valeur={`${Math.round(a.age.mean)} ans`} legende="EN MOYENNE" ink={C.pine} />
              <Figure
                valeur={`${Math.round(a.age.heritageShare ?? 0)} %`}
                legende="DE PLUS DE 20 ANS"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              <Tally
                label={t("almanac.median")}
                value={t("almanac.yearsOld", { count: a.age.median })}
              />
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

      <Cardstock title={t("almanac.decadesVisited")} seed={`decennies-${key}`}>
        {a.decades.length === 0 ? (
          <Nothing what={t("almanac.noReleaseYear")} />
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
                  {/* A MEAN WITHOUT ITS SAMPLE SIZE IS A FIGURE THAT
                      BLUFFS: "4,5" on a single screening displayed
                      exactly like "4,5" on forty. `n` has been computed
                      since the first day and had never been written. */}
                  <div
                    style={{ fontFamily: F.mono, fontSize: 8.5, color: C.burgundy }}
                    title={note ? t("almanac.ratedViewings", { count: note.n }) : undefined}
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

      {/* WHAT HAS MOVED — outside the year, and that is deliberate: a
          film one re-rates does so over a decade, not over twelve
          months. */}
      <Cardstock title={t("almanac.changedMind")} seed="drift">
        {drifts.length === 0 ? (
          <Nothing what={t("almanac.noDrift")} />
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
              {t("almanac.allYearsTogether")}
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
function PlatePeople({ a, onOpenPerson }: { a: Almanac; onOpenPerson?: (name: string) => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const g = a.geography;
  const key = String(a.period);
  const always = a.period === "always";
  return (
    <div style={GRID_2x2}>
      <Cardstock title={t("almanac.filmmakers")} seed={`cineastes-${key}`}>
        {/* The names lead to the credits: the almanac says who comes
            back, the folder says what one has of that person. Two
            neighbouring questions that had no path towards each
            other. */}
        <Honours items={a.topDirectors.slice(0, 4)} total={a.count} onPick={onOpenPerson} />
      </Cardstock>

      <Cardstock title="Les genres" seed={`genres-${key}`}>
        <Honours items={a.topGenres.slice(0, 4)} total={a.count} ink={C.moss} />
      </Cardstock>

      <Cardstock
        title={always ? t("almanac.loyalties") : t("almanac.loyaltiesAndFinds")}
        seed={`gens-${key}`}
      >
        {/* THREE TIMES IN A YEAR IS NOT AN ACCIDENT: it is a crossing
            of a body of work, and that is what a film lover wants to see
            named. The discoveries are the other side — the names whose
            first appearance in the log this is, all years taken
            together.

            On "toujours", that second side dissolves: everybody was
            discovered one day. `newDirectors` then returns an empty
            list, and the card closes on the loyalties alone — whose
            threshold, for its part, has risen. */}
        {a.loyalties.directors.length === 0 &&
        a.loyalties.actors.length === 0 &&
        a.newDirectors.length === 0 ? (
          <Nothing
            what={
              always
                ? `personne ne revient ${THRESHOLD_ALWAYS} fois ou plus`
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
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
                  {t("almanac.metAgain")}
                </div>
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
                  {t("almanac.discovered", { count: a.newDirectors.length })}
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

      <Cardstock title={t("almanac.worldCrossed")} seed={`monde-${key}`}>
        {g.countryCount === 0 ? (
          <Nothing what={t("almanac.noCountry")} />
        ) : (
          <>
            <div style={{ marginTop: 6 }}>
              <Figure
                valeur={g.countryCount}
                legende={t("almanac.countriesCrossed")}
                ink={C.cobalt}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <Honours
                items={g.countries
                  .slice(0, 3)
                  .map((p) => ({ name: countryName(p.name, lang), n: p.n }))}
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
                    .map((l) => languageName(l.name, lang))
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
function PlateSubjects({ a }: { a: Almanac }) {
  const { t } = useTranslation();
  const key = String(a.period);
  const s = a.subjects;
  const ar = a.craftspeople;
  return (
    <div style={GRID_2x2}>
      <Cardstock title="Les sujets" seed={`subjects-${key}`}>
        <Honours
          items={s.keywords.slice(0, 5)}
          total={a.count}
          ink={C.ochre}
          empty={t("almanac.noKeyword")}
        />
      </Cardstock>

      <Cardstock title="Les motifs suivis" seed={`motifs-${key}`}>
        {/* The domain returns IDENTIFIERS, as it returns country codes:
            it is here that they are read in French. A pattern removed
            from the catalogue since then keeps its identifier rather
            than vanish — the same rule as on the card. */}
        <Honours
          items={s.motifs
            .slice(0, 5)
            .map((m) => ({ name: motifById(m.name)?.label ?? m.name, n: m.n }))}
          total={a.count}
          ink={C.pine}
          empty={t("almanac.noMotif")}
        />
      </Cardstock>

      <Cardstock title={t("almanac.craftspeople")} seed={`craftspeople-${key}`}>
        {/* With no threshold, unlike the loyalties: nobody says to
            themselves "I follow a cinematographer's work", and that is
            precisely why showing it teaches something. We only keep what
            COMES BACK — a name seen once is not a loyalty, it is a
            credit list. */}
        <TradeFollowed label={t("roles.image").toUpperCase()} people={ar.image} />
        <TradeFollowed label={t("roles.musique").toUpperCase()} people={ar.musique} />
        <TradeFollowed label={t("roles.scénario").toUpperCase()} people={ar.scénario} />
        {[ar.image, ar.musique, ar.scénario].every(
          (g) => g.filter((x) => x.n > 1).length === 0
        ) && <Nothing what={t("almanac.noRecurringCrew")} />}
      </Cardstock>

      <Cardstock title={t("almanac.gentlerHarsher")} seed={`ecart-${key}`}>
        {a.gap.n === 0 ? (
          <Nothing what={t("almanac.noPublicScore")} />
        ) : (
          <>
            {/* THE TWO MEANS IN THE CLEAR. The tastes board already
                says "plus tendre de 0,3 point"; it did not say from what
                to what. Both numbers had been computed since the first
                day and had never been written. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px 6px",
                marginTop: 8,
              }}
            >
              <Figure
                valeur={a.gap.you?.toFixed(1) ?? "—"}
                legende={t("almanac.youOutOfTen")}
                ink={C.burgundy}
              />
              <Figure valeur={a.gap.public?.toFixed(1) ?? "—"} legende={t("almanac.thePublic")} />
            </div>
            <div style={{ marginTop: 9 }}>
              <GapList
                label={t("almanac.yourIndulgences")}
                films={a.gap.mostGenerous}
                ink={C.moss}
              />
              <GapList
                label={t("almanac.yourSeverities")}
                films={a.gap.mostSevere}
                ink={C.vermillion}
              />
            </div>
          </>
        )}
      </Cardstock>
    </div>
  );
}

/** One trade of `crew` — mute when nobody comes back to it twice. */
function TradeFollowed({
  label,
  people,
}: {
  label: string;
  people: { name: string; n: number }[];
}) {
  const followed = people.filter((g) => g.n > 1).slice(0, 3);
  if (followed.length === 0) return null;
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{label}</div>
      <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink }}>
        {followed.map((g) => `${g.name} (${g.n})`).join(" · ")}
      </div>
    </div>
  );
}

/** Three films and their gap to the crowd, in points out of ten. */
function GapList({
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
const GRID_2x2: CSSProperties = {
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

/* `title` holds a catalogue key: the plates are ours to name. */
const PLATES = [
  { title: "almanac.plate1", stamp: "I" },
  { title: "almanac.plate2", stamp: "II" },
  { title: "almanac.plate3", stamp: "III" },
  { title: "almanac.plate4", stamp: "IV" },
];

/* The height the header reserves for itself. Hard-coded, and that is
   the price of not scrolling: the board takes "all the rest", and "the
   rest" must be a number. Measuring the header on every render would
   cost a resize observer to gain a few pixels. */
const HEADER = 178;

/* The loyalty threshold over a whole practice — the domain sets it, the
   view says it again when there is nothing to show. Copied out, yes:
   writing it in full in the sentence "nobody comes back six times" is
   worth more than a number imported for a single sentence. */
const THRESHOLD_ALWAYS = 6;

export function AlmanacView({
  films,
  onOpenPerson,
}: {
  films: Film[];
  /** Opens the folder of somebody in the credits. */
  onOpenPerson?: (name: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const years = useMemo(() => yearsCovered(films), [films]);

  /* THE PERIODS ONE CAN LEAF THROUGH: "toujours" first, then the years
     from the most recent to the oldest.

     At the head and not at the end: it is the booklet's title page, the
     one that says what the whole is made of before going into the detail
     of one year. It only appears from two covered years on — with a
     single one, "toujours" and "cette année" are the same page, and
     offering it twice would only make a duplicate to leaf through. */
  const periods: Period[] = useMemo(
    () => (years.length > 1 ? ["always", ...years] : years),
    [years]
  );

  const [choisie, setChoisie] = useState<Period | null>(null);
  /* The period being looked at: the one chosen as long as it still
     exists — deleting the last screening of a year makes it disappear
     from the list, and one must not stay on a page that no longer
     exists. */
  const period = choisie != null && periods.includes(choisie) ? choisie : (periods[0] ?? null);

  const [plate, setPlate] = useState(0);

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
      const target = e.target as HTMLElement | null;
      // do not steal the arrow from somebody who is typing
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "ArrowRight") setPlate((p) => Math.min(p + 1, PLATES.length - 1));
      if (e.key === "ArrowLeft") setPlate((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* THE IMAGE TO TAKE AWAY. "en cours" rather than a boolean: the
     drawing waits for the posters to load, and a button that says
     nothing for two seconds passes for broken. */
  const [box, setBox] = useState<"repos" | "en cours" | "raté">("repos");
  const takeAway = async () => {
    /* THE IMAGE IS COMPOSED AROUND A VINTAGE — it is written on it in
       large characters. On "toujours" there is none, and the button does
       not appear: better offer nothing than an image that would invent a
       year. */
    if (typeof period !== "number" || a == null) return;
    setBox("en cours");
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
          country: a.geography.countries[0]
            ? countryName(a.geography.countries[0].name, i18n.language)
            : null,
          ageMean: a.age.mean,
        },
        skinApplied(),
        t
      );
      download(blob, `cine-hub-${period}.png`);
      setBox("repos");
    } catch (e) {
      console.error(e);
      setBox("raté");
    }
  };

  if (period == null || a == null) {
    return (
      <div style={{ padding: "34px 44px 70px", maxWidth: 760, position: "relative" }}>
        <StampCorner text="ALMANACH" />
        <Title />
        <div
          style={{
            marginTop: 26,
            fontFamily: F.hand,
            fontSize: 21,
            color: C.inkFaded,
            lineHeight: 1.5,
          }}
        >
          {t("almanac.emptyTitle")}
          <br />
          {t("almanac.emptyBody")}
        </div>
      </div>
    );
  }

  /* The rank is taken from the PERIODS and not from the years: the
     arrows must be able to reach "toujours", which opens the
     booklet. */
  const rank = periods.indexOf(period);
  const goToYear = (step: number) => {
    const nextOne = periods[rank + step];
    if (nextOne != null) setChoisie(nextOne);
  };
  const always = period === "always";

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
           broke it: it goes through `Layer`, precisely so as to
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

      {/* ---- THE HEADER, of settled height ---- */}
      <div style={{ flexShrink: 0, height: HEADER, boxSizing: "border-box" }}>
        <Title />

        <div
          data-tour="almanac-year"
          style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}
        >
          <button
            onClick={() => goToYear(1)}
            disabled={rank >= periods.length - 1}
            aria-label={t("almanac.previousPeriod")}
            style={arrowStyle(rank < periods.length - 1)}
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
              fontSize: always ? 30 : 42,
              fontStyle: always ? "italic" : "normal",
              color: C.burgundy,
              lineHeight: 1,
              minWidth: 118,
              textAlign: "center",
            }}
          >
            {always ? "always" : period}
          </div>
          <button
            onClick={() => goToYear(-1)}
            disabled={rank <= 0}
            aria-label={t("almanac.nextPeriod")}
            style={arrowStyle(rank > 0)}
          >
            <ChevronRight size={17} />
          </button>

          {/* THE PILLS HOLD ON ONE LINE, AND THAT IS A FIX.

              They were in `flexWrap: "wrap"` under a width of three
              hundred and eighty pixels: beyond eight covered years they
              went onto two lines, beyond fourteen onto three. The
              header, though, has a SETTLED height (`ENTETE`) — so
              nothing bounded that overflow, and the board, which carries
              `zIndex: 2`, passed over the pills and the board buttons.
              They became unclickable with nothing to explain why.

              One line that scrolls rather than a header that grows: it
              is the page's no-scrolling stance that is preserved here,
              and it alone that justifies a hard-coded height above. */}
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
            {periods.map((p) => (
              <button
                key={String(p)}
                onClick={() => setChoisie(p)}
                aria-pressed={p === period}
                style={yearStyle(p === period)}
              >
                {p === "always" ? "TOUJOURS" : p}
              </button>
            ))}
          </div>

          {/* THE YEAR IN A BOX — the only thing here that leaves the
              browser, and which exists only for one year: the image is
              built around a vintage written large. */}
          {!always && (
            <button
              onClick={takeAway}
              data-tour="almanac-export"
              disabled={box === "en cours"}
              title={t("almanac.exportHint")}
              style={{
                all: "unset",
                ...tap,
                cursor: box === "en cours" ? "progress" : "pointer",
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
                opacity: box === "en cours" ? 0.6 : 1,
              }}
            >
              <Download size={14} />
              {box === "en cours"
                ? t("almanac.developing")
                : box === "raté"
                  ? t("almanac.exportFailed")
                  : t("almanac.yearInABox")}
            </button>
          )}
        </div>

        {/* ---- LE FEUILLETAGE ---- */}
        <div
          data-tour="almanac-plates"
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}
        >
          <button
            onClick={() => setPlate((p) => Math.max(p - 1, 0))}
            disabled={plate === 0}
            aria-label={t("almanac.previousPlate")}
            style={arrowStyle(plate > 0)}
          >
            <ChevronLeft size={16} />
          </button>
          {PLATES.map((p, i) => (
            <button
              key={p.stamp}
              onClick={() => setPlate(i)}
              aria-pressed={i === plate}
              style={plateStyle(i === plate)}
            >
              {p.stamp} · {p.title}
            </button>
          ))}
          <button
            onClick={() => setPlate((p) => Math.min(p + 1, PLATES.length - 1))}
            disabled={plate === PLATES.length - 1}
            aria-label={t("almanac.nextPlate")}
            style={arrowStyle(plate < PLATES.length - 1)}
          >
            <ChevronRight size={16} />
          </button>
          <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginLeft: 4 }}>
            {t("almanac.orArrows")}
          </span>
        </div>
      </div>

      {/* ---- LA PLANCHE ---- */}
      <div
        /* `key`: without it React reuses the same node and the entry
           animation never replays. See the same pattern in `App`. */
        key={`${period}:${plate}`}
        data-enters
        style={{ flex: 1, minHeight: 0, paddingBottom: 22, position: "relative", zIndex: 2 }}
      >
        {plate === 0 && <PlateCount a={a} />}
        {plate === 1 && <PlateTastes a={a} drifts={drifts} />}
        {plate === 2 && <PlatePeople a={a} onOpenPerson={onOpenPerson} />}
        {plate === 3 && <PlateSubjects a={a} />}
      </div>
    </div>
  );
}

function Title() {
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
function skinApplied(): BoxPalette {
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

const arrowStyle = (active: boolean): CSSProperties => ({
  all: "unset",
  ...tapSquare,
  cursor: active ? "pointer" : "default",
  opacity: active ? 1 : 0.28,
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

const yearStyle = (active: boolean): CSSProperties => ({
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
  color: active ? C.card : C.inkFaded,
  background: active ? C.burgundy : "transparent",
  border: `1px solid ${active ? C.burgundy : C.line}`,
  borderRadius: "var(--tag-radius)",
});

const plateStyle = (active: boolean): CSSProperties => ({
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: "var(--tag-tracking)",
  textTransform: "var(--tag-transform)" as never,
  padding: "5px 11px",
  color: active ? C.card : C.inkFaded,
  background: active ? C.slate : "transparent",
  border: `1px solid ${active ? C.slate : C.line}`,
  borderRadius: "var(--tag-radius)",
});
