/* ============================================================
   WHAT TMDB KNOWS OF THIS FILM — and which showed nowhere
   ============================================================

   The harvest had long been bringing back the runtime, the language, the
   country, the public's rating, the cast and three crew trades. The card
   showed NONE of them: those fields fed the almanac and the
   constellation, and had no place where they could be read one by one.

   That is more than a display gap, it is a diagnostic blind spot. When
   the almanac announced three countries for two hundred films, there was
   no way to know whether TMDB was not giving them, whether the harvest
   was not asking for them, or whether the cache was serving old truncated
   answers (it was the third). A card that shows its holes gets repaired;
   a mute card has to be guessed at.

   Hence the button too: it asks TMDB for THIS film again, without going
   through the import cache — so with nothing to purge, and without having
   to relaunch the other five hundred to check a hunch about one.

   We only fill the gaps, as everywhere else in the merge: data corrected
   by hand is never overwritten by TMDB. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { EMPTY, Names } from "./Names";
import { tap } from "../../theme/styles";
import { getTmdbKey } from "../../services/tmdbKey";
import { getDetails, searchMovie } from "../../tmdb";
import { languageName, countryName } from "../../names";
import { forgetTmdbFacts } from "../../domain/film";
import type { Film } from "../../types";

/** A "label → value" line, or nothing at all if we do not know. */
function Done({ name, children }: { name: string; children: ReactNode }) {
  return (
    /* `flexWrap`: the label reserves 74 px and the value cannot go below
       its content — in a narrow column, the line overflowed. It now
       stacks. */
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        padding: "2px 0",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          color: C.inkFaded,
          letterSpacing: 0.5,
          minWidth: 74,
        }}
      >
        {name}
      </span>
      <span
        style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink, flex: "1 1 120px", minWidth: 0 }}
      >
        {children}
      </span>
    </div>
  );
}

/* What we say of an absent field. A dash, and not silence: silence gets
   confused with "this field does not exist", whereas here it means "TMDB
   did not give it to us", which calls for the button. */

/* The trades, by the id a card carries. Their names read from `roles`. */
const TRADES = ["image", "musique", "scénario"];

export function TmdbFacts({
  film,
  onUpdate,
  onOpenPerson,
}: {
  film: Film;
  onUpdate: (f: Film) => void;
  /** Absent: the names stay text. The card does not know how to navigate. */
  onOpenPerson?: (name: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  /* COMPLÉTER ET RÉINTERROGER NE SONT PAS LE MÊME GESTE.

     Compléter comble des trous et ne corrige rien — c'est ce qui le rend
     sûr à lancer sans rien demander à personne, et cela ne change pas.
     Mais une fiche dont on a corrigé l'identifiant APRÈS avoir été
     remplie n'a plus un seul trou : elle porte le résumé, la
     distribution et les PHOTOGRAMMES d'un autre film, et rien qui comble
     ne peut plus les atteindre. `FilmIdentity` répare au moment où l'on
     corrige ; il ne peut rien pour ce qui a été corrigé avant lui.

     Réinterroger est donc la récupération, et comme toute récupération
     dans ce classeur c'est UN GESTE ET PAS UNE RÈGLE : on le demande, on
     dit ce qu'il remplace, et il ne touche à rien de ce qu'on a écrit
     soi-même — ni note, ni critique, ni séance, ni capture. */
  const refresh = async (replace = false) => {
    const apiKey = getTmdbKey();
    if (!apiKey) {
      setMsg(t("tmdbKey.missing"));
      return;
    }
    setBusy(true);
    setMsg("interrogation…");
    try {
      /* The identifier when we have it: it avoids a search, and above all
         the false positives of `searchMovie`, which takes the first result
         without comparing titles. */
      let id = film.tmdbId;
      if (!id) {
        const hit = await searchMovie({ title: film.title, year: film.year, apiKey });
        if (!hit) {
          setMsg(t("facts.unknownTitle"));
          return;
        }
        id = hit.id;
      }
      const info = await getDetails(id, apiKey);

      /* On oublie d'abord : ce que la nouvelle réponse ne ramène pas ne
         doit pas rester celui de l'ancienne fiche. Les conditions
         ci-dessous voient alors des trous partout, et remplissent. */
      const base = replace ? forgetTmdbFacts() : {};
      /* `seen` et non `film` : la fiche telle qu'elle sera une fois
         oubliée. Les conditions ci-dessous la lisent, jamais la fiche
         d'origine — sans quoi « réinterroger » ne verrait aucun trou et
         ne ferait rien du tout. */
      const seen: Film = { ...film, ...base };
      const changes: Partial<Film> = { ...base };
      if (info.runtime != null && seen.runtime == null) changes.runtime = info.runtime;
      if (info.language && !seen.language) changes.language = info.language;
      if (info.countries?.length && !(seen.countries || []).length)
        changes.countries = info.countries;
      if (info.tmdbRating != null && seen.tmdbRating == null) changes.tmdbRating = info.tmdbRating;
      if (info.cast?.length && !(seen.cast || []).length) changes.cast = info.cast;
      if (info.crew && Object.keys(info.crew).length && !Object.keys(seen.crew || {}).length)
        changes.crew = info.crew;
      if (info.genres?.length && !(seen.genres || []).length) changes.genres = info.genres;
      if (info.director && !seen.director) changes.director = info.director;
      if (info.synopsis && !seen.synopsis) changes.synopsis = info.synopsis;
      /* The keywords are written even when empty: it is the list itself,
         even of length zero, that says "we asked". See `types` and
         `domain/importing`. */
      if (info.keywords && seen.keywords == null) changes.keywords = info.keywords;
      /* LES PHOTOGRAMMES SE REPRENNENT TOUJOURS, et c'est la seule
         exception au remplissage par les trous.

         Cette règle protège CE QU'ON A ÉCRIT SOI-MÊME : une durée saisie
         à la main doit survivre à un panneau qu'on a seulement ouvert.
         Or un photogramme n'est de personne — il n'y a pas d'écran pour
         en poser un, ils sont à TMDB de bout en bout et ne sont que des
         chemins. Il n'y a donc rien à protéger, et beaucoup à réparer :
         une fiche dont on a corrigé l'identifiant garde sinon, POUR
         TOUJOURS, les plans du mauvais film — aucun trou, donc aucun
         remplissage possible.

         Vos captures à vous (`stills`) ne sont pas ici et ne bougent
         pas : elles vivent dans le coffre, et la vue rapide les montre
         DE PRÉFÉRENCE aux photogrammes dès qu'il y en a une.

         C'est un GESTE — on a cliqué sur « rafraîchir » — et non le
         chargement d'un panneau : la vue rapide, elle, comble toujours
         des trous et n'écrit rien qu'on ne lui ait demandé. */
      if (info.frames && JSON.stringify(info.frames) !== JSON.stringify(seen.frames))
        changes.frames = info.frames;
      if (!film.tmdbId) changes.tmdbId = id;

      /* CE QUI A VRAIMENT BOUGÉ, et non le nombre de clés touchées :
         `changes` part de l'oubli, donc il porte déjà neuf champs avant
         qu'une seule réponse soit lue. Annoncer neuf champs complétés
         là où deux ont changé serait un compte faux. */
      const n = Object.entries(changes).filter(
        ([k, v]) => JSON.stringify(v) !== JSON.stringify(film[k as keyof Film])
      ).length;
      if (n) onUpdate({ ...film, ...changes });
      /* Telling "nothing changed" from "TMDB has nothing": the first
         means the card was already up to date, the second that there is
         nothing to hope for from a second click. */
      setMsg(n ? t("facts.filledIn", { count: n }) : t("facts.nothingMore"));
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  const countries = (film.countries || []).map((c) => countryName(c, i18n.language)).join(", ");
  const crew = film.crew || {};
  const cast = film.cast || [];

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {t("facts.title")}
        <button
          onClick={() => refresh()}
          disabled={busy}
          title={t("facts.refreshHint")}
          style={{
            all: "unset",
            ...tap,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.45 : 1,
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: F.mono,
            fontSize: 10,
            color: C.pine,
          }}
        >
          <RefreshCw size={11} /> {t("facts.refresh")}
        </button>
      </div>
      {/* LE SECOND GESTE, ET IL DIT CE QU'IL REMPLACE. Il n'est offert
          que si la fiche porte un identifiant : sans lui il n'y a rien à
          réinterroger, et une recherche par titre pourrait remplacer ce
          relevé par celui d'un homonyme — exactement le mal qu'il est là
          pour réparer. */}
      {!!film.tmdbId && (
        <button
          onClick={() => refresh(true)}
          disabled={busy}
          title={t("facts.reharvestHint")}
          style={{
            all: "unset",
            ...tap,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.45 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 6,
            fontFamily: F.mono,
            fontSize: 10,
            color: C.burgundy,
          }}
        >
          <RotateCcw size={11} /> {t("facts.reharvest")}
        </button>
      )}

      <Done name={t("facts.runtime")}>{film.runtime != null ? `${film.runtime} min` : EMPTY}</Done>
      <Done name={t("facts.country")}>{countries || EMPTY}</Done>
      <Done name={t("facts.language")}>
        {film.language ? languageName(film.language, i18n.language) : EMPTY}
      </Done>
      <Done name={t("facts.tmdbRating")}>
        {film.tmdbRating != null ? `${film.tmdbRating.toFixed(1)} / 10` : EMPTY}
      </Done>
      {TRADES.map((key) => (
        <Done key={key} name={t(`roles.${key}`).toUpperCase()}>
          <Names names={crew[key] || []} onOpenPerson={onOpenPerson} />
        </Done>
      ))}
      <Done name={t("facts.cast")}>
        <Names names={cast} separator=" · " onOpenPerson={onOpenPerson} />
      </Done>
      {/* THE KEYWORDS, SHOWN AND NOT HIDDEN. They feed the wake: when the
          wake only brings things together by name, this is where one sees
          why — the line is empty, and the "refresh" button just above goes
          and fetches them. A dash says "TMDB did not give it to us"; an
          absent line would say nothing at all. */}
      <Done name={t("facts.keywords")}>
        {film.keywords?.length ? film.keywords.join(" · ") : EMPTY}
      </Done>
      <Done name={t("facts.tmdbId")}>{film.tmdbId ?? EMPTY}</Done>

      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
