/* ============================================================
   VUE — L'ALMANACH
   ============================================================

   La page de comptes d'un archiviste : ce que l'année a contenu, tenu à
   la main sur des cartons posés de travers, et non une grille de
   compteurs. Le calcul entier vit dans `domain/almanac` — cette vue ne
   fait que dessiner ce qu'il rend, et n'a donc aucune règle à elle.

   LES BARRES SONT TRACÉES, PAS TRACÉES-PAR-UNE-BIBLIOTHÈQUE. Douze
   rectangles au trait irrégulier valent mieux qu'une dépendance de
   graphiques, et ils sont les seuls à pouvoir tenir sur les quatorze
   peaux : leur encre est un jeton, pas une couleur.

   PAS UNE COULEUR EN DUR ICI. Une seule suffirait à casser la moitié des
   peaux — la planche de contrôle (`views/dev/SkinLab`) est là pour le
   voir venir. */
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import {
  almanacFor,
  driftHighlights,
  filmsOfYear,
  yearsCovered,
  type Almanac,
} from "../domain/almanac";
import { drawYearInBox, telecharger, type BoxPalette } from "../services/yearInBox";
import { hash, seededRand, tiltOf } from "../domain/seeded";
import { CoffeeRing, InkUnderline, PushPin, StampCorner, Tape } from "../components/atmosphere";
import { InkStars, Label, Tally } from "../components/ui";
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

/** « 2024-03-07 » → « 7 mars ». L'année est déjà dans le titre de la page. */
const enClair = (iso: string | null): string => {
  if (!iso) return "—";
  const [, m, j] = iso.split("-");
  return `${Number(j)} ${MOIS_LONG[Number(m) - 1] || ""}`.trim();
};

/* ------------------------------------------------------------
   LE CARTON — la pièce que toute la page réemploie
   ------------------------------------------------------------ */
function Carton({
  titre,
  seed,
  children,
  style,
}: {
  titre: string;
  /** De quoi tirer une inclinaison STABLE : un carton qui gigote au re-rendu
      ne ressemble plus à un objet posé. */
  seed: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const penche = tiltOf(seed);
  const punaise = Math.abs(hash(seed)) % 3 === 0;
  return (
    <div
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "3px 5px 12px rgba(30,20,10,0.22)",
        padding: "17px 18px 15px",
        transform: `rotate(${Number(penche) / 5}deg)`,
        ...style,
      }}
    >
      {punaise ? (
        <PushPin style={{ top: -6, right: 16 }} />
      ) : (
        <Tape color={C.ochre} width={58} style={{ top: -10, right: 22 }} rotate={5} />
      )}
      <Label>{titre}</Label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------
   LES DOUZE MOIS, À L'ENCRE
   ------------------------------------------------------------

   Chaque barre est un quadrilatère dont les quatre coins bougent d'un
   cheveu — tiré de l'année et du mois, donc toujours le même. Un
   rectangle parfait dans une page manuscrite se voit tout de suite ;
   un rectangle qui tremble ne se voit pas du tout, ce qui est le but. */
function BarresDesMois({ byMonth, year }: { byMonth: number[]; year: number }) {
  const W = 300;
  const H = 108;
  const max = Math.max(1, ...byMonth);
  const pas = W / 12;
  const largeur = pas * 0.56;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} style={{ display: "block", marginTop: 8 }}>
      {byMonth.map((n, i) => {
        const g = i * pas + (pas - largeur) / 2;
        const d = g + largeur;
        const haut = H - (n / max) * (H - 6);
        const jitter = (k: number) => (seededRand(hash(`${year}-${i}-${k}`)) - 0.5) * 2.2;
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
            {/* Le compte au-dessus de la barre, mais seulement quand il y
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
              style={{ fontFamily: F.mono, fontSize: 8, fill: C.inkFaded }}
            >
              {MOIS[i]}
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

/** Une petite règle horizontale : la part de chaque entrée d'un palmarès. */
function Palmares({ items, total }: { items: { nom: string; n: number }[]; total: number }) {
  if (items.length === 0)
    return <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded }}>rien à noter</div>;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
      {items.map((it) => (
        <div key={it.nom}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontFamily: F.body,
              fontSize: 13,
              color: C.ink,
            }}
          >
            <span
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={it.nom}
            >
              {it.nom}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.inkFaded }}>
              {it.n}
              {total > 0 ? ` · ${Math.round((it.n / total) * 100)}%` : ""}
            </span>
          </div>
          <div style={{ height: 4, background: alpha(C.line, 0.5), marginTop: 3 }}>
            <div style={{ height: "100%", width: `${(it.n / max) * 100}%`, background: C.ochre }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* LA PEAU POSÉE, EN VALEURS RÉSOLUES.

   Les jetons sont des renvois : `C.paper` vaut la chaîne
   « var(--c-paper) », qui ne veut rien dire pour un canevas. On demande
   donc au document ce qu'elles valent AU MOMENT du clic — l'image sort
   ainsi dans la peau qu'on avait posée, y compris une peau de nuit.

   Lu ici et non dans le service : c'est la vue qui a le droit de
   regarder le document. */
function peauPosée(): BoxPalette {
  const s = getComputedStyle(document.documentElement);
  const v = (nom: string, repli: string) => s.getPropertyValue(nom).trim() || repli;
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

/* ------------------------------------------------------------
   LA PAGE
   ------------------------------------------------------------ */
export function AlmanacView({ films }: { films: Film[] }) {
  const années = useMemo(() => yearsCovered(films), [films]);
  const [choisie, setChoisie] = useState<number | null>(null);
  /* L'année regardée : celle qu'on a choisie tant qu'elle existe encore
     — supprimer la dernière séance d'une année la fait disparaître de la
     liste, et on ne doit pas rester sur une page qui n'existe plus. */
  const année = choisie != null && années.includes(choisie) ? choisie : (années[0] ?? null);

  const a: Almanac | null = useMemo(
    () => (année == null ? null : almanacFor(films, année)),
    [films, année]
  );
  const drifts = useMemo(() => driftHighlights(films, 4), [films]);

  /* L'IMAGE À EMPORTER. « prête » plutôt qu'un booléen : le dessin
     attend le chargement des affiches, et un bouton qui ne dit rien
     pendant deux secondes passe pour cassé. */
  const [boîte, setBoîte] = useState<"repos" | "en cours" | "raté">("repos");
  const emporter = async () => {
    if (année == null || a == null) return;
    setBoîte("en cours");
    try {
      const blob = await drawYearInBox(
        {
          year: année,
          films: filmsOfYear(films, année),
          count: a.count,
          titles: a.titles,
          rewatches: a.rewatches,
          ratingAvg: a.ratingAvg,
          topDirector: a.topDirectors[0]?.nom ?? null,
        },
        peauPosée()
      );
      telecharger(blob, `cine-hub-${année}.png`);
      setBoîte("repos");
    } catch (e) {
      console.error(e);
      setBoîte("raté");
    }
  };

  if (année == null || a == null) {
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

  const rang = années.indexOf(année);
  const aller = (pas: number) => {
    const suivante = années[rang + pas];
    if (suivante != null) setChoisie(suivante);
  };

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 980, position: "relative" }}>
      <StampCorner text="ALMANACH" />
      <CoffeeRing style={{ left: 420, top: 190 }} rotate={-24} />
      <Titre />

      {/* LE CHOIX DE L'ANNÉE — des flèches, et la liste pour sauter loin */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
        <button
          onClick={() => aller(1)}
          disabled={rang >= années.length - 1}
          aria-label="année précédente"
          style={flecheStyle(rang < années.length - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <div
          style={{
            fontFamily: F.title,
            fontWeight: 700,
            fontSize: 46,
            color: C.burgundy,
            lineHeight: 1,
            minWidth: 130,
            textAlign: "center",
          }}
        >
          {année}
        </div>
        <button
          onClick={() => aller(-1)}
          disabled={rang <= 0}
          aria-label="année suivante"
          style={flecheStyle(rang > 0)}
        >
          <ChevronRight size={17} />
        </button>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginLeft: 10 }}>
          {années.map((an) => (
            <button
              key={an}
              onClick={() => setChoisie(an)}
              aria-pressed={an === année}
              style={anneeStyle(an === année)}
            >
              {an}
            </button>
          ))}
        </div>

        {/* L'ANNÉE EN BOÎTE — la seule chose d'ici qui sorte du navigateur */}
        <button
          onClick={emporter}
          disabled={boîte === "en cours"}
          title="Une image de cette année, à garder ou à montrer"
          style={{
            all: "unset",
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
              : "l'année en boîte"}
        </button>
      </div>

      <div
        style={{
          marginTop: 30,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))",
          gap: 26,
          alignItems: "start",
        }}
      >
        <Carton titre="Le compte" seed={`compte-${année}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            <Tally label="Séances" value={a.count} ink={C.burgundy} />
            <Tally label="Films distincts" value={a.titles} />
            <Tally label="Revoyures" value={a.rewatches} />
            <Tally label="Jours d'affilée" value={a.longestStreak} />
          </div>
          <div
            style={{
              marginTop: 12,
              fontFamily: F.hand,
              fontSize: 17,
              color: C.inkFaded,
              lineHeight: 1.35,
            }}
          >
            du {enClair(a.firstWatch)} au {enClair(a.lastWatch)}
          </div>
        </Carton>

        <Carton titre="Les mois" seed={`mois-${année}`} style={{ gridColumn: "span 2" }}>
          <BarresDesMois byMonth={a.byMonth} year={année} />
        </Carton>

        <Carton titre="Les notes" seed={`notes-${année}`}>
          {a.ratingAvg == null ? (
            <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 6 }}>
              aucune séance notée cette année
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <InkStars value={Math.round(a.ratingAvg * 2) / 2} size={19} />
                <span style={{ fontFamily: F.mono, fontSize: 15, color: C.ink }}>
                  {a.ratingAvg.toFixed(2)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginTop: 14 }}>
                {a.ratingHistogram.map((n, i) => {
                  const max = Math.max(1, ...a.ratingHistogram);
                  return (
                    <div key={i} style={{ flex: 1, textAlign: "center" }}>
                      <div
                        title={`${i / 2} — ${n} séance${n > 1 ? "s" : ""}`}
                        style={{
                          height: Math.round((n / max) * 46) + (n > 0 ? 2 : 0),
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
                  );
                })}
              </div>
            </>
          )}
        </Carton>

        <Carton titre="Les cinéastes" seed={`cineastes-${année}`}>
          <Palmares items={a.topDirectors} total={a.count} />
        </Carton>

        <Carton titre="Les genres" seed={`genres-${année}`}>
          <Palmares items={a.topGenres} total={a.count} />
        </Carton>

        <Carton titre="Les décennies visitées" seed={`decennies-${année}`}>
          {a.decades.length === 0 ? (
            <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded }}>
              aucune année de sortie renseignée
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, marginTop: 10 }}>
              {a.decades.map((d) => {
                const max = Math.max(...a.decades.map((x) => x.n));
                return (
                  <div key={d.decade} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{d.n}</div>
                    <div
                      style={{
                        height: Math.round((d.n / max) * 50) + 3,
                        background: C.pine,
                        opacity: 0.8,
                      }}
                    />
                    <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.inkFaded }}>
                      {String(d.decade).slice(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Carton>

        {/* CE QUI A BOUGÉ — hors de l'année, et c'est délibéré : un film
            qu'on réévalue le fait sur une décennie, pas sur douze mois. */}
        {drifts.length > 0 && (
          <Carton titre="Ce qui a changé d'avis" seed="drift" style={{ gridColumn: "span 2" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 6 }}>
              {drifts.map((d) => (
                <div
                  key={d.film.id}
                  style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 13.5 }}
                >
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 13,
                      color: d.delta > 0 ? C.moss : C.vermillion,
                      minWidth: 30,
                    }}
                  >
                    {d.delta > 0 ? "+" : "−"}
                    {Math.abs(d.delta)}
                  </span>
                  <span style={{ fontFamily: F.body, color: C.ink }}>{d.film.title}</span>
                  <span
                    style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, alignSelf: "center" }}
                  />
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded }}>
                    {d.from} → {d.to}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
              toutes années confondues — on ne se ravise pas en douze mois
            </div>
          </Carton>
        )}
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
          fontSize: 42,
          color: C.ink,
        }}
      >
        L&apos;almanach
      </div>
      <InkUnderline width={230} />
      <div style={{ fontFamily: F.hand, fontSize: 20, color: C.inkFaded, marginTop: 2 }}>
        ce que les années ont contenu, séance par séance
      </div>
    </>
  );
}

const flecheStyle = (actif: boolean): CSSProperties => ({
  all: "unset",
  cursor: actif ? "pointer" : "default",
  opacity: actif ? 1 : 0.28,
  color: C.inkFaded,
  border: `1px solid ${C.line}`,
  borderRadius: "50%",
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const anneeStyle = (actif: boolean): CSSProperties => ({
  all: "unset",
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: "var(--tag-tracking)",
  padding: "3px 7px",
  color: actif ? C.card : C.inkFaded,
  background: actif ? C.burgundy : "transparent",
  border: `1px solid ${actif ? C.burgundy : C.line}`,
  borderRadius: "var(--tag-radius)",
});
