/* ============================================================
   VUE — L'ALMANACH, en trois planches qu'on feuillette
   ============================================================

   La page de comptes d'un archiviste : ce que l'année a contenu, tenu à
   la main sur des cartons posés de travers, et non une grille de
   compteurs. Le calcul entier vit dans `domain/almanac` — cette vue ne
   fait que dessiner ce qu'il rend, et n'a donc aucune règle à elle.

   POURQUOI TROIS PLANCHES, ET AUCUN DÉFILEMENT.

   Une page d'almanach se regarde, elle ne se déroule pas : ce qui
   dépasse du bord n'existe pas pour le lecteur, et une barre de
   défilement à droite d'un bilan annuel avoue qu'on a renoncé à le
   composer. Mais un bilan qui tient dans un écran ne dit pas
   grand-chose.

   D'où le livret. Chaque planche occupe EXACTEMENT la hauteur
   disponible, et l'on tourne la page — à la flèche, au clavier, ou en
   cliquant une pastille. Trois planches valent trois fois la place sans
   coûter un seul pixel de défilement.

   CE QUI GARANTIT QU'AUCUNE NE DÉBORDE. Les planches sont des grilles à
   lignes fixes, jamais des flux : la hauteur est décidée d'avance et
   répartie, au lieu d'être subie. Et surtout, ce qui pourrait être long
   est tronqué PAR LE CALCUL — un palmarès rend quatre lignes, pas
   quarante. Un `overflow: hidden` aurait caché la donnée sans le dire,
   ce qui est pire qu'une barre de défilement.

   LES BARRES SONT TRACÉES, PAS TRACÉES-PAR-UNE-BIBLIOTHÈQUE. Douze
   rectangles au trait irrégulier valent mieux qu'une dépendance de
   graphiques, et ils sont les seuls à pouvoir tenir sur les quatorze
   peaux : leur encre est un jeton, pas une couleur.

   PAS UNE COULEUR EN DUR ICI. Une seule suffirait à casser la moitié des
   peaux — la planche de contrôle (`views/dev/SkinLab`) est là pour le
   voir venir. */
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
  type Période,
} from "../domain/almanac";
import { drawYearInBox, telecharger, type BoxPalette } from "../services/yearInBox";
import { hash, seededRand, tiltOf } from "../domain/seeded";
import { CoffeeRing, InkUnderline, PushPin, StampCorner, Tape } from "../components/atmosphere";
import { InkStars, Label, Tally } from "../components/ui";
import { nomLangue, nomPays } from "../noms";
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

/* « 2024-03-07 » → « 7 mars ». L'année est tue parce qu'elle est déjà
   dans le titre de la page — mais seulement quand le titre EST une
   année : « du 25 janvier au 24 décembre » sur un bilan qui couvre sept
   ans laisse croire à une seule année, et c'est justement la chose que
   ce bilan doit démentir. */
const enClair = (iso: string | null, avecAnnée = false): string => {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-");
  const jour = `${Number(j)} ${MOIS_LONG[Number(m) - 1] || ""}`.trim();
  return avecAnnée ? `${jour} ${a}` : jour;
};

/** 5 430 minutes → « 90 h 30 ». Personne ne lit un bilan en minutes. */
const enHeures = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

/* Les noms de pays et de langues se traduisent dans `noms`, et non dans
   le domaine : `geography` rend des codes ISO parce qu'il ne sait pas
   dans quelle langue on le lira. La fiche s'en sert aussi. */

/* ------------------------------------------------------------
   LE CARTON — la pièce que toutes les planches réemploient
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
      /* Un carton ne se coupe pas en deux entre deux pages : voir
         `theme/print.css`, qui s'accroche à cet attribut. */
      data-print-block
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "3px 5px 12px rgba(30,20,10,0.22)",
        padding: "13px 15px 12px",
        transform: `rotate(${Number(penche) / 7}deg)`,
        /* `minHeight: 0` est ce qui autorise vraiment une case de grille
           à se serrer. Sans lui, un enfant de grille refuse de descendre
           sous la taille de son contenu, et c'est la PLANCHE qui grandit
           — donc la page qui défile, précisément ce qu'on interdit. */
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

/** Ce qu'on écrit quand un carton n'a rien à montrer. */
function Rien({ quoi }: { quoi: string }) {
  return <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>{quoi}</div>;
}

/* Un grand nombre, avec sa légende dessous. La pièce qui porte les
   planches : c'est elle qu'on lit en trois secondes. */
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
   LES DOUZE MOIS, À L'ENCRE
   ------------------------------------------------------------

   Chaque barre est un quadrilatère dont les quatre coins bougent d'un
   cheveu — tiré de l'année et du mois, donc toujours le même. Un
   rectangle parfait dans une page manuscrite se voit tout de suite ;
   un rectangle qui tremble ne se voit pas du tout, ce qui est le but. */
/* Douze mois ou sept années : c'est la même barre, et le même dessin.
   Le graphique ne connaît que des valeurs et leurs légendes — lui faire
   croire qu'il compte des mois aurait obligé à l'écrire deux fois le
   jour où l'on a voulu lire une pratique entière. */
function Barres({
  valeurs,
  légendes,
  graine,
}: {
  valeurs: number[];
  légendes: string[];
  graine: string | number;
}) {
  const W = 300;
  const H = 108;
  const max = Math.max(1, ...valeurs);
  const pas = W / Math.max(1, valeurs.length);
  const largeur = pas * 0.56;
  /* Au-delà de huit colonnes, une année sur quatre chiffres se cogne à
     sa voisine : on ne garde que les deux derniers, qui suffisent à
     suivre une décennie. */
  const étroit = valeurs.length > 8;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H + 16}`}
      preserveAspectRatio="none"
      style={{ display: "block", marginTop: 6 }}
    >
      {valeurs.map((n, i) => {
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

/* Une petite règle horizontale : la part de chaque entrée d'un palmarès.

   Le nombre de lignes est TRONQUÉ PAR L'APPELANT, jamais masqué ici :
   c'est ce qui garantit qu'une planche ne déborde pas sans qu'on le
   sache. */
function Palmares({
  items,
  total,
  ink = C.ochre,
  vide = "rien à noter",
  onPick,
}: {
  items: { nom: string; n: number }[];
  total: number;
  ink?: string;
  vide?: string;
  /** Rend chaque nom cliquable. Absent : le palmarès reste du texte. */
  onPick?: (nom: string) => void;
}) {
  if (items.length === 0) return <Rien quoi={vide} />;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 3 }}>
      {items.map((it) => (
        <div key={it.nom}>
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
              /* Un pointillé d'encre, comme sur la fiche film : le
                 carnet ne souligne pas en bleu ce qu'on peut suivre. */
              <button
                onClick={() => onPick(it.nom)}
                title={`Ce que j'ai de ${it.nom}`}
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
                {it.nom}
              </button>
            ) : (
              <span
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={it.nom}
              >
                {it.nom}
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
   PLANCHE I — LE COMPTE ET LE RYTHME
   ------------------------------------------------------------ */
function PlancheCompte({ a }: { a: Almanac }) {
  const r = a.rhythm;
  const clé = String(a.période);
  const toujours = a.période === "toujours";
  /* Les jours réellement couverts, pour dire « une séance tous les tant
     de jours » sans supposer une année civile. */
  const étendue = r.densite > 0 ? (r.jours / r.densite) * 100 : 365;
  return (
    <div style={GRILLE_2x2}>
      <Carton titre="Le compte" seed={`compte-${clé}`}>
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
      </Carton>

      {/* Douze mois pour une année, une colonne par année pour toute une
          pratique : c'est la même barre, et la graduation change seule. */}
      <Carton
        titre={toujours ? "Les années" : "Les mois"}
        seed={`mois-${clé}`}
        style={{ gridColumn: "span 2" }}
      >
        {toujours ? (
          <Barres
            valeurs={a.byYear.map((y) => y.séances)}
            légendes={a.byYear.map((y) => String(y.year))}
            graine={clé}
          />
        ) : (
          <Barres valeurs={a.byMonth} légendes={MOIS} graine={clé} />
        )}
      </Carton>

      <Carton titre="Le rythme" seed={`rythme-${clé}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
          <Tally label="Jours avec séance" value={r.jours} ink={C.pine} />
          <Tally
            label={toujours ? "De la période" : "De l'année"}
            value={`${r.densite.toFixed(1)} %`}
          />
          <Tally label="Plus longue disette" value={`${r.disette} j`} />
          <Tally
            label="Mois le plus dense"
            value={r.moisLePlusDense ? MOIS_LONG[r.moisLePlusDense - 1] || "—" : "—"}
          />
        </div>
        <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
          {r.jours > 0 ? `une séance tous les ${(étendue / r.jours).toFixed(1)} jours` : ""}
        </div>
      </Carton>

      <Carton titre="Les heures de cinéma" seed={`heures-${clé}`}>
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
                label="Séance moyenne"
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
            {/* UN TOTAL QUI S'ANNONCE COMME UN PLANCHER. Taire les séances
                sans durée donnerait un chiffre faux avec l'aplomb d'un
                chiffre juste. */}
            {a.screenTime.sansDuree > 0 && (
              <div style={{ marginTop: 8, fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
                au moins — {a.screenTime.sansDuree} séance(s) sans durée connue
              </div>
            )}
          </>
        )}
      </Carton>
    </div>
  );
}

/* ------------------------------------------------------------
   PLANCHE II — LES GOÛTS
   ------------------------------------------------------------ */
function PlancheGouts({ a, drifts }: { a: Almanac; drifts: Drift[] }) {
  const maxHisto = Math.max(1, ...a.ratingHistogram);
  const clé = String(a.période);
  const toujours = a.période === "toujours";
  return (
    <div style={GRILLE_2x2}>
      <Carton titre="Les notes" seed={`notes-${clé}`}>
        {a.ratingAvg == null ? (
          <Rien quoi={toujours ? "aucune séance notée" : "aucune séance notée cette année"} />
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
            {a.écart.écart != null && (
              <div
                style={{
                  marginTop: 9,
                  fontFamily: F.hand,
                  fontSize: 15,
                  color: C.inkFaded,
                  textAlign: "center",
                }}
              >
                {Math.abs(a.écart.écart) < 0.15 ? (
                  <>d'accord avec le public, sur {a.écart.n} séances</>
                ) : (
                  <>
                    plus{" "}
                    <span style={{ color: a.écart.écart > 0 ? C.moss : C.vermillion }}>
                      {a.écart.écart > 0 ? "tendre" : "sévère"}
                    </span>{" "}
                    que le public de {Math.abs(a.écart.écart).toFixed(1)} point
                    {Math.abs(a.écart.écart) >= 2 ? "s" : ""}, sur {a.écart.n} séances
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Carton>

      <Carton titre="L'âge de ce que vous regardez" seed={`age-${clé}`}>
        {a.age.moyen == null ? (
          <Rien quoi="aucune année de sortie renseignée" />
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
                valeur={`${Math.round(a.age.moyen)} ans`}
                legende="EN MOYENNE"
                ink={C.pine}
              />
              <Chiffre
                valeur={`${Math.round(a.age.partPatrimoine ?? 0)} %`}
                legende="DE PLUS DE 20 ANS"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              <Tally label="Médiane" value={`${a.age.median} ans`} />
              {a.age.plusAncien && (
                <Tally label="Le plus ancien" value={a.age.plusAncien.year} ink={C.burgundy} />
              )}
            </div>
            {a.age.plusAncien && (
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
                {a.age.plusAncien.film.title}
              </div>
            )}
          </>
        )}
      </Carton>

      <Carton titre="Les décennies visitées" seed={`decennies-${clé}`}>
        {a.decades.length === 0 ? (
          <Rien quoi="aucune année de sortie renseignée" />
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 10 }}>
            {a.decades.map((d) => {
              const max = Math.max(...a.decades.map((x) => x.n));
              /* La note moyenne de la décennie, sous sa barre : c'est ce
                 rapprochement — combien, et aimés comment — qui montre un
                 biais qu'on ne se connaît pas. */
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
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.burgundy }}>
                    {note ? note.avg.toFixed(1) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Carton>

      {/* CE QUI A BOUGÉ — hors de l'année, et c'est délibéré : un film
          qu'on réévalue le fait sur une décennie, pas sur douze mois. */}
      <Carton titre="Ce qui a changé d'avis" seed="drift">
        {drifts.length === 0 ? (
          <Rien quoi="aucune note n'a bougé entre deux séances" />
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
              toutes années confondues — on ne se ravise pas en douze mois
            </div>
          </>
        )}
      </Carton>
    </div>
  );
}

/* ------------------------------------------------------------
   PLANCHE III — LES GENS ET LE MONDE
   ------------------------------------------------------------ */
function PlancheGens({ a, onOpenPerson }: { a: Almanac; onOpenPerson?: (nom: string) => void }) {
  const g = a.geography;
  const clé = String(a.période);
  const toujours = a.période === "toujours";
  return (
    <div style={GRILLE_2x2}>
      <Carton titre="Les cinéastes" seed={`cineastes-${clé}`}>
        {/* Les noms mènent au générique : l'almanach dit qui revient,
            le dossier dit ce qu'on a de cette personne. Deux questions
            voisines qui n'avaient aucun chemin l'une vers l'autre. */}
        <Palmares items={a.topDirectors.slice(0, 4)} total={a.count} onPick={onOpenPerson} />
      </Carton>

      <Carton titre="Les genres" seed={`genres-${clé}`}>
        <Palmares items={a.topGenres.slice(0, 4)} total={a.count} ink={C.moss} />
      </Carton>

      <Carton titre={toujours ? "Les fidélités" : "Fidélités et découvertes"} seed={`gens-${clé}`}>
        {/* TROIS FOIS DANS UNE ANNÉE N'EST PAS UN HASARD : c'est une
            traversée d'œuvre, et c'est ce qu'un cinéphile veut voir
            nommé. Les découvertes sont l'autre face — les noms dont
            c'est la première apparition au journal, toutes années
            confondues.

            Sur « toujours », cette seconde face se dissout : tout le
            monde a été découvert un jour. `newDirectors` rend alors une
            liste vide, et le carton se referme sur les seules
            fidélités — dont le seuil, lui, a monté. */}
        {a.loyalties.directors.length === 0 &&
        a.loyalties.actors.length === 0 &&
        a.newDirectors.length === 0 ? (
          <Rien
            quoi={
              toujours
                ? `personne ne revient ${SEUIL_TOUJOURS} fois ou plus`
                : "rien qui revienne trois fois, ni aucun nom nouveau"
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
                    .map((d) => `${d.nom} (${d.n})`)
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
                    .map((d) => `${d.nom} (${d.n})`)
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
      </Carton>

      <Carton titre="Le monde traversé" seed={`monde-${clé}`}>
        {g.nbPays === 0 ? (
          <Rien quoi="aucun pays renseigné — « compléter les fiches », dans l'onglet Import, va les chercher" />
        ) : (
          <>
            <div style={{ marginTop: 6 }}>
              <Chiffre valeur={g.nbPays} legende="PAYS TRAVERSÉS" ink={C.cobalt} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Palmares
                items={g.pays.slice(0, 3).map((p) => ({ nom: nomPays(p.nom), n: p.n }))}
                total={a.count}
                ink={C.cobalt}
              />
            </div>
            {g.langues.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>LANGUES</div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: C.ink }}>
                  {g.langues
                    .slice(0, 4)
                    .map((l) => nomLangue(l.nom))
                    .join(" · ")}
                </div>
              </div>
            )}
          </>
        )}
      </Carton>
    </div>
  );
}

/* Deux colonnes, deux rangées — et des rangées EN FRACTIONS, ce qui est
   toute l'astuce : `1fr` répartit la hauteur disponible au lieu de la
   demander au contenu. La planche fait donc exactement la taille qu'on
   lui donne, quoi qu'elle contienne. */
const GRILLE_2x2: CSSProperties = {
  height: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gridTemplateRows: "1fr 1fr",
  gap: 18,
  alignItems: "stretch",
};

/* ------------------------------------------------------------
   LE LIVRET
   ------------------------------------------------------------ */

const PLANCHES = [
  { titre: "Le compte et le rythme", tampon: "I" },
  { titre: "Les goûts", tampon: "II" },
  { titre: "Les gens et le monde", tampon: "III" },
];

/* La hauteur que l'en-tête se réserve. En dur, et c'est le prix du
   non-défilement : la planche prend « tout le reste », et « le reste »
   doit être un nombre. Mesurer l'en-tête à chaque rendu coûterait un
   observateur de redimensionnement pour gagner quelques pixels. */
const ENTETE = 178;

/* Le seuil de fidélité sur toute une pratique — le domaine le fixe, la
   vue le redit quand il n'y a rien à montrer. Recopié, oui : l'écrire en
   toutes lettres dans la phrase « personne ne revient six fois » vaut
   mieux qu'un nombre importé pour une seule phrase. */
const SEUIL_TOUJOURS = 6;

export function AlmanacView({
  films,
  onOpenPerson,
}: {
  films: Film[];
  /** Ouvre le dossier de quelqu'un au générique. */
  onOpenPerson?: (nom: string) => void;
}) {
  const années = useMemo(() => yearsCovered(films), [films]);

  /* LES PÉRIODES QU'ON PEUT FEUILLETER : « toujours » d'abord, puis les
     années de la plus récente à la plus ancienne.

     En tête et non à la fin : c'est la page de garde du livret, celle
     qui dit de quoi l'ensemble est fait avant d'entrer dans le détail
     d'une année. Elle ne paraît qu'à partir de deux années couvertes —
     sur une seule, « toujours » et « cette année » sont la même page,
     et l'offrir deux fois ne ferait qu'un doublon à feuilleter. */
  const périodes: Période[] = useMemo(
    () => (années.length > 1 ? ["toujours", ...années] : années),
    [années]
  );

  const [choisie, setChoisie] = useState<Période | null>(null);
  /* La période regardée : celle qu'on a choisie tant qu'elle existe
     encore — supprimer la dernière séance d'une année la fait
     disparaître de la liste, et on ne doit pas rester sur une page qui
     n'existe plus. */
  const période = choisie != null && périodes.includes(choisie) ? choisie : (périodes[0] ?? null);

  const [planche, setPlanche] = useState(0);

  const a: Almanac | null = useMemo(
    () => (période == null ? null : almanacFor(films, période)),
    [films, période]
  );
  const drifts = useMemo(() => driftHighlights(films, 4), [films]);

  /* LES FLÈCHES DU CLAVIER TOURNENT LA PAGE. C'est le geste d'un livret,
     et il ne coûte rien à qui ne le connaît pas. Elles ne changent PAS
     l'année : deux sens de navigation sur la même touche seraient
     indevinables, et l'année a ses propres pastilles. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      // ne pas voler la flèche à qui est en train d'écrire
      if (cible && /^(INPUT|TEXTAREA)$/.test(cible.tagName)) return;
      if (cible?.isContentEditable) return;
      if (e.key === "ArrowRight") setPlanche((p) => Math.min(p + 1, PLANCHES.length - 1));
      if (e.key === "ArrowLeft") setPlanche((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* L'IMAGE À EMPORTER. « en cours » plutôt qu'un booléen : le dessin
     attend le chargement des affiches, et un bouton qui ne dit rien
     pendant deux secondes passe pour cassé. */
  const [boîte, setBoîte] = useState<"repos" | "en cours" | "raté">("repos");
  const emporter = async () => {
    /* L'IMAGE EST COMPOSÉE AUTOUR D'UN MILLÉSIME — il s'y écrit en gros
       caractères. Sur « toujours », il n'y en a pas, et le bouton ne
       paraît pas : mieux vaut ne rien proposer qu'une image qui
       inventerait une année. */
    if (typeof période !== "number" || a == null) return;
    setBoîte("en cours");
    try {
      const blob = await drawYearInBox(
        {
          year: période,
          films: filmsOfYear(films, période),
          count: a.count,
          titles: a.titles,
          rewatches: a.rewatches,
          ratingAvg: a.ratingAvg,
          topDirector: a.topDirectors[0]?.nom ?? null,
          minutes: a.screenTime.minutes,
          decade: a.decades.length ? a.decades.reduce((m, d) => (d.n > m.n ? d : m)).decade : null,
          country: a.geography.pays[0] ? nomPays(a.geography.pays[0].nom) : null,
          ageMoyen: a.age.moyen,
        },
        peauPosée()
      );
      telecharger(blob, `cine-hub-${période}.png`);
      setBoîte("repos");
    } catch (e) {
      console.error(e);
      setBoîte("raté");
    }
  };

  if (période == null || a == null) {
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

  /* Le rang se prend dans les PÉRIODES et non dans les années : les
     flèches doivent pouvoir atteindre « toujours », qui ouvre le
     livret. */
  const rang = périodes.indexOf(période);
  const allerAnnée = (pas: number) => {
    const suivante = périodes[rang + pas];
    if (suivante != null) setChoisie(suivante);
  };
  const toujours = période === "toujours";

  return (
    <div
      style={{
        padding: "22px 34px 0",
        position: "relative",
        /* La page entière tient dans la fenêtre : c'est ici que le
           non-défilement se décide, et nulle part ailleurs. */
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
            aria-label="période précédente"
            style={flecheStyle(rang < périodes.length - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <div
            style={{
              fontFamily: F.title,
              fontWeight: 700,
              /* « TOUJOURS » est plus long qu'un millésime : il tient
                 dans la même largeur en descendant d'un corps, plutôt
                 qu'en poussant les pastilles vers la droite. */
              fontSize: toujours ? 30 : 42,
              fontStyle: toujours ? "italic" : "normal",
              color: C.burgundy,
              lineHeight: 1,
              minWidth: 118,
              textAlign: "center",
            }}
          >
            {toujours ? "toujours" : période}
          </div>
          <button
            onClick={() => allerAnnée(-1)}
            disabled={rang <= 0}
            aria-label="période suivante"
            style={flecheStyle(rang > 0)}
          >
            <ChevronRight size={17} />
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginLeft: 8, maxWidth: 380 }}>
            {périodes.map((p) => (
              <button
                key={String(p)}
                onClick={() => setChoisie(p)}
                aria-pressed={p === période}
                style={anneeStyle(p === période)}
              >
                {p === "toujours" ? "TOUJOURS" : p}
              </button>
            ))}
          </div>

          {/* L'ANNÉE EN BOÎTE — la seule chose d'ici qui sorte du
              navigateur, et qui n'existe que pour une année : l'image
              est bâtie autour d'un millésime écrit en gros. */}
          {!toujours && (
            <button
              onClick={emporter}
              data-tour="almanac-export"
              disabled={boîte === "en cours"}
              title="Une image de cette année, à garder ou à montrer"
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
                  : "l'année en boîte"}
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
        /* `key` : sans elle React réemploie le même nœud et l'animation
           d'entrée ne se rejoue jamais. Voir le même motif dans `App`. */
        key={`${période}:${planche}`}
        data-enters
        style={{ flex: 1, minHeight: 0, paddingBottom: 22, position: "relative", zIndex: 2 }}
      >
        {planche === 0 && <PlancheCompte a={a} />}
        {planche === 1 && <PlancheGouts a={a} drifts={drifts} />}
        {planche === 2 && <PlancheGens a={a} onOpenPerson={onOpenPerson} />}
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
