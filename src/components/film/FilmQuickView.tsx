/* ============================================================
   EVERYTHING WE KNOW OF A FILM, WITHOUT LEAVING WHERE ONE IS
   ============================================================

   THREE SCREENS ASKED THE SAME QUESTION AND NONE COULD ANSWER IT. A run
   in the Lineage, a proposal in the Credits, a discovery in the
   Recommendations: all three offer a film one has not seen, and all
   three showed a poster, a title and a year. Deciding whether a film
   belongs in a viewing plan on those three facts is not deciding, and
   the only way out was to leave the screen — which loses the run one was
   building.

   ONE LAYER, AND NOT THREE PANELS IN THE FLOW. Written inline, each
   screen would have had to find room for it, and the narrowest of the
   three would have decided how much any of them could say. Over the top,
   the space is the window's and the same object serves all three. That
   is what makes "exhaustive" affordable at all.

   EXHAUSTIVE, AND THEREFORE SECTIONED. Every cinema field the binder
   holds is here — but a wall of forty values is not more readable than
   four, it is less. So: what the film IS, then what one has DONE with
   it, then the people, then the words. A section with nothing in it is
   not drawn; a FIELD with nothing in it is drawn with a dash, because
   inside a section the difference between "nothing" and "we never
   asked" is exactly what the button at the top is for.

   THE SUMMARY IS FETCHED ON OPENING, AND WRITTEN DOWN. No card in any
   existing binder carries one — the field did not exist — so a quick
   view that only showed what was stored would have been blank for
   everybody on the day it shipped. It is asked for once, per card, and
   `onEnrich` puts it on the card: paid once, and there offline
   afterwards. Without a key, without a `tmdbId`, or offline, the rest is
   still drawn — a missing summary is not a reason to say nothing.

   IT NEVER WRITES WHAT IT WAS NOT ASKED TO. The completion fills HOLES
   and corrects nothing: a runtime typed by hand stays, and so does a
   director one has respelt. Same rule as `TmdbFacts` and the import
   merge, and it is the rule that makes the fetch safe to run without
   asking. */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Star, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked } from "../../theme/styles";
import { Layer } from "../ui/Layer";
import { Label, Trouble, Waiting } from "../ui";
import { useDialog } from "../../hooks/useDialog";
import { useTmdbKey } from "../../services/tmdbKey";
import { getDetails } from "../../tmdb";
import { languageName, countryName } from "../../names";
import { initialsOf } from "../../domain/film";
import { directorsOf } from "../../domain/lineageMap";
import { motifLabel, motifsOf } from "../../domain/motifs";
import { watchCount } from "../../domain/film";
import { PosterArt } from "./PosterArt";
import { EMPTY, Names } from "./Names";
import { FrameStrip } from "./FrameStrip";
import type { Film } from "../../types";

/** Les trois métiers qu'une fiche porte. Leurs noms se lisent dans `roles`. */
const TRADES = ["image", "musique", "scénario"];

/** Une ligne « libellé → valeur ». Le tiret vaut réponse : voir l'en-tête. */
function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        padding: "3px 0",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          color: C.inkFaded,
          letterSpacing: 0.5,
          minWidth: 96,
        }}
      >
        {name}
      </span>
      <span
        style={{ fontFamily: F.body, fontSize: 13, color: C.ink, flex: "1 1 140px", minWidth: 0 }}
      >
        {children}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <Label>{title}</Label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

interface FilmQuickViewProps {
  film: Film;
  /**
   * La fiche est-elle au classeur ? Un candidat de la reco ou une
   * proposition du générique n'en est pas une : sa note, ses séances et
   * son statut n'existent pas, et les montrer à zéro serait AFFIRMER
   * qu'on ne l'a pas aimé plutôt qu'on ne l'a pas vu.
   */
  inBinder?: boolean;
  /**
   * La complétion écrit ici. Absent — une proposition qui n'a pas de
   * fiche —, on interroge quand même : on ne range simplement rien.
   */
  onEnrich?: (film: Film) => void;
  onOpenPerson?: (name: string) => void;
  /** Ouvrir la fiche entière. Absent pour ce qui n'est pas au classeur. */
  onOpenFilm?: () => void;
  /** Ce que propose l'écran appelant — « ajouter au parcours », etc. */
  action?: ReactNode;
  onClose: () => void;
}

export function FilmQuickView({
  film,
  inBinder = true,
  onEnrich,
  onOpenPerson,
  onOpenFilm,
  action,
  onClose,
}: FilmQuickViewProps) {
  const { t, i18n } = useTranslation();
  const ref = useDialog(onClose);
  const apiKey = useTmdbKey();
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [extra, setExtra] = useState<Partial<Film> | null>(null);

  /* CE QU'ON MONTRE : la fiche, plus ce qu'on vient d'apprendre. Les deux
     sont séparés parce que l'écriture remonte à `App` et redescend au
     rendu suivant — sans cette copie locale, le panneau resterait vide un
     rendu de plus, juste après avoir dit qu'il attendait. */
  const shown: Film = extra ? { ...film, ...extra } : film;

  /* `frames == null` ET NON une liste vide : une fiche pour laquelle
     TMDB n'a aucun photogramme répond `[]`, et c'est une réponse — la
     redemander à chaque ouverture serait la boucle que `keywords`
     documente. Voir `types`. */
  const missing =
    !shown.synopsis || shown.runtime == null || !(shown.cast || []).length || shown.frames == null;

  useEffect(() => {
    /* ON NE DEMANDE QUE CE QUI MANQUE, ET UNE FOIS. Une fiche complète
       n'appelle rien du tout, ce qui est le cas courant dès la seconde
       ouverture.

       DEMANDER ET ÉCRIRE SONT DEUX CHOSES, et les confondre vidait ce
       panneau là où il servait le plus : une proposition du générique ou
       une découverte de la reco n'a PAS de fiche à écrire, donc pas
       d'`onEnrich` — et la requête ne partait pas. On voyait un titre,
       une année, et l'écran restait exactement aussi muet qu'avant. La
       requête ne dépend donc que de la clé et de l'identifiant ;
       l'écriture, elle, demande une fiche au classeur. */
    if (!missing || !apiKey || !film.tmdbId) return;
    let alive = true;
    setBusy(true);
    setTrouble(null);
    getDetails(film.tmdbId, apiKey)
      .then((info) => {
        if (!alive) return;
        /* ON COMBLE DES TROUS, ON NE CORRIGE RIEN — la règle de
           `TmdbFacts` et de la fusion d'import. C'est elle qui rend cette
           requête sûre à lancer sans rien demander à personne. */
        const changes: Partial<Film> = {};
        if (info.synopsis && !film.synopsis) changes.synopsis = info.synopsis;
        if (info.runtime != null && film.runtime == null) changes.runtime = info.runtime;
        if (info.language && !film.language) changes.language = info.language;
        if (info.countries?.length && !(film.countries || []).length)
          changes.countries = info.countries;
        if (info.tmdbRating != null && film.tmdbRating == null)
          changes.tmdbRating = info.tmdbRating;
        if (info.cast?.length && !(film.cast || []).length) changes.cast = info.cast;
        if (info.crew && Object.keys(info.crew).length && !Object.keys(film.crew || {}).length)
          changes.crew = info.crew;
        if (info.genres?.length && !(film.genres || []).length) changes.genres = info.genres;
        if (info.director && !film.director) changes.director = info.director;
        if (info.keywords && film.keywords == null) changes.keywords = info.keywords;
        if (info.frames && film.frames == null) changes.frames = info.frames;
        if (!Object.keys(changes).length) return;
        setExtra(changes);
        /* L'écriture n'est PAS sur le chemin du geste : le panneau est
           déjà rempli par `extra` quand celle-ci part. Et elle n'a lieu
           que s'il y a une fiche à écrire. */
        if (inBinder && onEnrich) onEnrich({ ...film, ...changes });
      })
      .catch((e: Error) => {
        /* Une DEMANDE, et non une décoration : elle se dit. */
        if (alive) setTrouble(t("quick.failed", { why: e.message }));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
    /* Sur l'identité de la fiche, et pas sur `film` : le panneau se
       rouvrirait une requête à chaque écriture qu'il vient de provoquer. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id, film.tmdbId, apiKey]);

  const directors = directorsOf(shown);
  const crew = shown.crew || {};
  const countries = (shown.countries || []).map((c) => countryName(c, i18n.language)).join(", ");
  const watched = watchCount(shown);
  /* `motifsOf` + `motifLabel` : le catalogue est la source du libellé,
     jamais la fiche — y recopier un nom figerait la langue du jour. */
  const motifs = motifsOf(shown).map((m) => motifLabel(m, t));

  return (
    <Layer>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: alpha(C.ink, 0.4),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={t("quick.heading", { title: shown.title })}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            padding: "18px 20px 22px",
            width: "min(660px, 100%)",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ width: 118, flexShrink: 0, position: "relative", height: 177 }}>
              <PosterArt film={shown} initials={initialsOf(shown.title)} width={118} plain />
            </div>

            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <h2
                  style={{
                    fontFamily: F.title,
                    fontSize: 23,
                    lineHeight: 1.15,
                    color: C.ink,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  {shown.title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label={t("quick.close")}
                  title={t("quick.close")}
                  style={{ ...bare, padding: 2 }}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                  marginTop: 4,
                  letterSpacing: 0.5,
                }}
              >
                {[
                  shown.year || null,
                  shown.runtime != null ? t("tonight.runtime", { minutes: shown.runtime }) : null,
                  countries || null,
                  shown.language ? languageName(shown.language, i18n.language) : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </div>

              {directors.length > 0 && (
                <div style={{ fontFamily: F.body, fontSize: 14, color: C.ink, marginTop: 6 }}>
                  <Names names={directors.map((d) => d.name)} onOpenPerson={onOpenPerson} />
                </div>
              )}

              {(shown.genres || []).length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                  {shown.genres.map((g) => (
                    <span
                      key={g}
                      style={{
                        fontFamily: F.mono,
                        fontSize: 9,
                        letterSpacing: 0.5,
                        color: C.inkFaded,
                        border: `1px solid ${C.line}`,
                        padding: "2px 6px",
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* LA NOTE PUBLIQUE ET LA VÔTRE, CÔTE À CÔTE. C'est l'écart
                  qui dit quelque chose, et il ne se lit pas sur deux
                  écrans différents. */}
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
                {shown.tmdbRating != null && (
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                    {t("facts.tmdbRating")} {shown.tmdbRating.toFixed(1)} / 10
                  </span>
                )}
                {inBinder && shown.rating > 0 && (
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 10,
                      color: C.ochre,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Star size={10} />
                    {t("quick.yours", { rating: shown.rating })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {busy && <Waiting lines={3} label={t("quick.asking")} />}
          {trouble && <Trouble>{trouble}</Trouble>}

          {/* ------------- CE QUE LE FILM EST ------------- */}
          <Section title={t("quick.synopsis")}>
            {shown.synopsis ? (
              <p
                style={{
                  fontFamily: F.body,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: C.ink,
                  margin: 0,
                }}
              >
                {shown.synopsis}
              </p>
            ) : (
              <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
                {t(apiKey && film.tmdbId ? "quick.noSynopsis" : "quick.noSynopsisOffline")}
              </div>
            )}
          </Section>

          {/* ------------- CE QU'ON EN VOIT -------------
              Sous le résumé, parce qu'on lit d'abord et qu'on regarde
              ensuite ; et ce sont des images de TMDB, jamais les
              captures de quelqu'un. */}
          {!!shown.frames?.length && <FrameStrip frames={shown.frames} title={shown.title} />}

          {/* ------------- QUI L'A FAIT ------------- */}
          <Section title={t("quick.people")}>
            {TRADES.map((key) => (
              <Fact key={key} name={t(`roles.${key}`).toUpperCase()}>
                <Names names={crew[key] || []} onOpenPerson={onOpenPerson} />
              </Fact>
            ))}
            <Fact name={t("facts.cast")}>
              <Names names={shown.cast || []} separator=" · " onOpenPerson={onOpenPerson} />
            </Fact>
          </Section>

          {/* ------------- LES MOTS ------------- */}
          <Section title={t("quick.words")}>
            <Fact name={t("facts.keywords")}>
              {shown.keywords?.length ? shown.keywords.join(" · ") : EMPTY}
            </Fact>
            <Fact name={t("quick.motifs")}>{motifs.length ? motifs.join(" · ") : EMPTY}</Fact>
            <Fact name={t("quick.themes")}>
              {(shown.themes || []).length ? shown.themes.join(" · ") : EMPTY}
            </Fact>
          </Section>

          {/* ------------- CE QUE VOUS EN AVEZ FAIT -------------
              Muet hors du classeur : une note à zéro et zéro séance
              AFFIRMERAIENT qu'on n'a pas aimé un film qu'on n'a pas vu. */}
          {inBinder && (
            <Section title={t("quick.yourPart")}>
              <Fact name={t("quick.status")}>
                {/* Les deux clés en toutes lettres et non `status.${x}` :
                    une clé calculée échappe au test des catalogues, qui
                    ne peut plus dire qu'il en manque une. */}
                {t(shown.status === "watched" ? "quick.seen" : "quick.toSee")}
                {shown.bedside && ` · ${t("quick.bedside")}`}
                {shown.archived && ` · ${t("quick.archived")}`}
              </Fact>
              <Fact name={t("quick.screenings")}>
                {watched > 0 ? t("quick.screeningCount", { count: watched }) : EMPTY}
                {shown.watchedAt ? ` · ${shown.watchedAt}` : ""}
              </Fact>
              <Fact name={t("quick.review")}>
                {shown.review ? (
                  <span style={{ fontFamily: F.hand, fontSize: 16 }}>{shown.review}</span>
                ) : (
                  EMPTY
                )}
              </Fact>
              <Fact name={t("quick.notes")}>
                {shown.notes ? (
                  <span style={{ fontFamily: F.hand, fontSize: 16 }}>{shown.notes}</span>
                ) : (
                  EMPTY
                )}
              </Fact>
            </Section>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
            {action}
            {onOpenFilm && (
              <button onClick={onOpenFilm} style={{ ...inked(C.ink), ...hollow }}>
                {t("quick.openCard")}
              </button>
            )}
            <button onClick={onClose} style={{ ...inked(C.ink), ...hollow }}>
              {t("quick.close")}
            </button>
          </div>
        </div>
      </div>
    </Layer>
  );
}
