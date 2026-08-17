/* ============================================================
   PUTTING A FILM INTO A RUN
   ============================================================

   IT SEARCHES THE WHOLE COLLECTION AND NOT ONLY "TO WATCH". Planning a
   rewatch is an ordinary plan — Ozu 1949, then Hou, then Ozu 1953 — and
   a picker that hid what one has seen would have made the commonest
   lineage of all impossible to write down. What is still true is that
   the ones one has NOT seen are the likelier answer, so they come first
   and say so.

   AND IT SEARCHES BEYOND THE BINDER, WHICH IS THE POINT OF A PLAN. A
   viewing plan is made of films one has not got yet: a picker that only
   knew the collection could describe the past and never an intention.
   Picking something TMDB knows and the binder does not FILES IT under
   "to watch" — with its poster and, above all, its DIRECTOR, which is
   what makes it a node on the map of film-makers rather than a title
   nothing can explain.

   THE REMOTE SEARCH FIRES ON ENTER, NEVER ON A KEYSTROKE. There is no
   debounce hook in this project and this is not the place to invent one:
   TMDB is metered, the relay has its own per-minute ceiling, and a
   request per letter would spend a whole quota writing "tokyo". The
   local half stays instant — it costs nothing, being a sweep of an array
   already in memory.

   NO KEY, NO REMOTE HALF — AND THE PICKER IS STILL ALIVE. Without an
   account and without a key we do not question TMDB at all. `NoKey`
   takes the place the button would have taken and carries the way out of
   the lack; the local search goes on working. Returning nothing would
   have said "there is nothing here", which is a different and false
   statement. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Clapperboard, Eye, Plus, Search } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, inked, hollow, underlineInput } from "../../theme/styles";
import { NoKey, Trouble, Waiting } from "../ui";
import { PosterArt } from "../film/PosterArt";
import { searchFilms } from "../../domain/search";
import { primaryDirector } from "../../domain/lineageMap";
import { filmKey } from "../../domain/importing";
import { byAudience } from "../../domain/proposals";
import { initialsOf, makeFilm } from "../../domain/film";
import { useTmdbKey } from "../../services/tmdbKey";
import { getDetails, personFilmography, searchMovies, searchPerson } from "../../tmdb";
import type { Film } from "../../types";

interface TmdbHit {
  tmdbId: number;
  title: string;
  year: number | null;
  poster: string;
  /** Combien de gens l'ont noté — voir `domain/proposals`. */
  voteCount?: number;
}

/**
 * D'où vient la moitié distante — et le savoir CHANGE ce qu'on en dit.
 *
 * Une recherche par titre rend « ce que TMDB connaît de ce nom » ; une
 * recherche par cinéaste rend SA FILMOGRAPHIE, et la légende doit le
 * dire, sans quoi voir remonter quarante titres après avoir tapé deux
 * mots ressemble à une recherche qui a débordé.
 */
type Remote =
  { kind: "title"; hits: TmdbHit[] } | { kind: "director"; name: string; hits: TmdbHit[] };

interface FilmPickerProps {
  films: Film[];
  /** Une fiche du classeur : on la pose telle quelle. */
  onPick: (film: Film) => void;
  /**
   * Une fiche que le classeur n'a pas encore : on la range PUIS on la
   * pose. La vue tient les deux moitiés, parce que ranger est une
   * écriture de la collection et poser une écriture du parcours.
   */
  onAdopt: (film: Film) => void;
  /**
   * Regarder un film sans le poser. Deux natures passent par là : une
   * fiche du classeur, et un aperçu TMDB qui ne porte qu'un identifiant
   * — la vue rapide ira chercher le reste elle-même.
   */
  onLook: (film: Film) => void;
  /**
   * Les fiches DÉJÀ au programme. Le champ se vidait à chaque ajout : on
   * cherchait « antonioni », on posait L'Éclipse, et tout disparaissait —
   * pour poser L'Avventura il fallait retaper, alors qu'enfiler une
   * filmographie est exactement ce qu'on vient faire ici. La requête
   * reste donc en place, et chaque ligne déjà posée le DIT.
   *
   * C'EST LE PARCOURS QUI LE DIT, ET NON CE COMPOSANT. Une marque tenue
   * ici ne saurait rien d'une étape retirée dans la bande juste au-dessus
   * — elle dirait « posé » sur un film qui ne l'est plus.
   */
  inRun: ReadonlySet<string>;
  /** Ce que dit le champ, selon qu'on ouvre un parcours ou qu'on l'allonge. */
  label: string;
  tour?: string;
}

export function FilmPicker({
  films,
  onPick,
  onAdopt,
  onLook,
  inRun,
  label,
  tour,
}: FilmPickerProps) {
  const { t } = useTranslation();
  const apiKey = useTmdbKey();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Remote | null>(null);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  /** Le `tmdbId` dont la fiche est en cours de constitution. */
  const [adding, setAdding] = useState<number | null>(null);

  const found = useMemo(() => {
    if (!q.trim()) return [];
    const hits = searchFilms(films, q, t, 24);
    /* Not yet seen first, and the order WITHIN each half is left as the
       search ranked it: re-sorting on a second criterion would undo the
       relevance one just typed for. */
    return [...hits]
      .sort((a, b) => Number(b.status === "watchlist") - Number(a.status === "watchlist"))
      .slice(0, 8);
  }, [films, q, t]);

  /* CE QUE LE CLASSEUR TIENT DÉJÀ NE SE PROPOSE PAS DEUX FOIS. On
     dédoublonne sur le `tmdbId` quand il y en a un, et sinon sur
     `filmKey` — la clé même de l'import, pour que les deux portes
     s'accordent sur ce qu'est « la même fiche ». */
  const fresh = useMemo(() => {
    if (!remote) return null;
    const ids = new Set(films.map((f) => f.tmdbId).filter(Boolean));
    const keys = new Set(films.map((f) => filmKey(f)));
    return remote.hits.filter(
      (h) => !ids.has(h.tmdbId) && !keys.has(filmKey({ title: h.title, year: h.year || "" }))
    );
  }, [remote, films]);

  /* CE QU'ON A ÉCARTÉ SE COMPTE ET SE DIT. Demander la filmographie d'un
     cinéaste dont on tient déjà quinze films et n'en voir revenir que
     trois, sans un mot, ressemble à une réponse tronquée — alors que
     c'est exactement le service rendu. */
  const held = remote && fresh ? remote.hits.length - fresh.length : 0;

  const look = async () => {
    const title = q.trim();
    if (!title || !apiKey) return;
    setBusy(true);
    setTrouble(null);
    try {
      const hits = (await searchMovies({ title, apiKey, limit: 8 })) as TmdbHit[];
      setRemote({ kind: "title", hits: byAudience(hits) });
    } catch (e) {
      setRemote(null);
      setTrouble(t("lineage.tmdbFailed", { why: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  /* ============================================================
     LES FILMS DE QUELQU'UN, ET NON LES FILMS QUI PORTENT SON NOM
     ============================================================

     Taper « antonioni » dans une recherche de TITRES rend ce que TMDB
     trouve de ce mot dans un titre : à peu près rien. Or c'est le geste
     qu'on fait — on pense à un cinéaste avant de penser à un film, et
     bâtir un parcours consiste précisément à remonter une filmographie.

     LE MÉTIER PART AVEC LA QUESTION. `searchPerson` sans lui rend le
     classement par popularité de TMDB, donc l'homonyme acteur ; on
     demanderait ensuite ce que CET acteur a réalisé. C'est la faute que
     le générique vient de perdre, et elle est deux fois plus visible ici
     puisque la réponse s'affiche en entier.

     ET CE QU'ON TIENT DÉJÀ EST ÉCARTÉ, comme pour une recherche par
     titre : c'est le même `fresh`, et c'est ce qui fait de cette liste
     « ce qui me manque de lui » plutôt qu'un catalogue. */
  const lookDirector = async () => {
    const name = q.trim();
    if (!name || !apiKey) return;
    setBusy(true);
    setTrouble(null);
    try {
      const who = await searchPerson(name, apiKey, { role: "réalisation" });
      if (!who) {
        setRemote(null);
        setTrouble(t("lineage.noSuchDirector", { name }));
        return;
      }
      const theirs = (await personFilmography(who.id, apiKey, {
        role: "réalisation",
      })) as TmdbHit[];
      /* LE MÊME ORDRE QUE PARTOUT AILLEURS : le plus vu d'abord, la date
         à défaut. Chaque écran rangeait le sien à sa façon, et la même
         liste changeait d'ordre selon la porte par laquelle elle
         arrivait. */
      const hits = byAudience(theirs.filter((h) => h.title));
      /* L'ORTHOGRAPHE DE TMDB ET NON CELLE QU'ON A TAPÉE : on a écrit
         « antonioni », la légende doit dire « Michelangelo Antonioni ». */
      setRemote({ kind: "director", name: who.name, hits });
    } catch (e) {
      setRemote(null);
      setTrouble(t("lineage.tmdbFailed", { why: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  /* LA CHAÎNE D'ADOPTION. `getDetails` d'abord, et pas seulement pour
     l'affiche : c'est de là que vient le RÉALISATEUR, sans lequel
     l'étape posée serait un titre que la carte des cinéastes ne peut pas
     expliquer. */
  const adopt = async (hit: TmdbHit) => {
    if (!apiKey) return;
    setAdding(hit.tmdbId);
    setTrouble(null);
    try {
      const info = await getDetails(hit.tmdbId, apiKey);
      onAdopt(
        makeFilm({
          title: hit.title,
          year: info.year || hit.year || "",
          poster: info.poster || hit.poster,
          director: info.director,
          genres: info.genres,
          cast: info.cast,
          crew: info.crew,
          runtime: info.runtime,
          language: info.language,
          countries: info.countries,
          tmdbRating: info.tmdbRating,
          keywords: info.keywords,
          tmdbId: info.tmdbId,
          status: "watchlist",
          source: "tmdb",
        })
      );
    } catch (e) {
      /* Une DEMANDE qui a raté, et non une décoration : elle se dit. Et
         aucune étape n'est posée — on ne prétend pas avoir rangé. */
      setTrouble(t("lineage.tmdbFailed", { why: (e as Error).message }));
    } finally {
      setAdding(null);
    }
  };

  const caption = {
    fontFamily: F.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: alpha(C.ink, 0.5),
    margin: "12px 0 4px",
  } as const;

  /* LA LIGNE PORTE DEUX COMMANDES, ET LA BORDURE EST SUR LE `li`.
     Poser l'œil DANS le bouton d'ajout aurait niché une commande dans une
     commande — HTML invalide, et le bouton d'ajout y aurait pris pour NOM
     le libellé de l'œil. */
  const line = {
    display: "flex",
    alignItems: "center",
    borderBottom: `1px solid ${alpha(C.line, 0.6)}`,
  } as const;

  const row = {
    ...bare,
    display: "flex",
    /* DIT ICI ET PAS SEULEMENT DANS `bare` : sur un écran tactile, `tap`
       centre ce qu'il contient — ce qui est juste pour une icône seule
       dans une cible de quarante-quatre pixels, et faux pour une ligne
       étirée sur toute la largeur. */
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 9,
    flex: 1,
    minWidth: 0,
    padding: "5px 2px",
    color: C.ink,
    textAlign: "left",
  } as const;

  const eye = { ...bare, flexShrink: 0, padding: "5px 7px" } as const;

  return (
    <div data-tour={tour}>
      <label
        style={{
          display: "block",
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: C.inkFaded,
          marginBottom: 4,
        }}
      >
        {label}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            /* Les résultats distants portent sur la requête d'avant :
               les garder sous une autre requête serait mentir. */
            setRemote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void look();
            }
          }}
          placeholder={t("lineage.pickPlaceholder")}
          style={{ ...underlineInput, marginTop: 4 }}
        />
      </label>

      {found.length > 0 && (
        <>
          <div style={caption}>{t("lineage.inBinder")}</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {found.map((film) => {
              const director = primaryDirector(film);
              return (
                <li key={film.id} style={line}>
                  <button onClick={() => onPick(film)} style={row}>
                    <span style={{ width: 26, flexShrink: 0 }}>
                      <PosterArt
                        film={film}
                        height={39}
                        width={26}
                        initials={initialsOf(film.title)}
                        lazy
                      />
                    </span>
                    {/* LE SIGNE LUI-MÊME CHANGE, et pas seulement une
                        mention au bout de la ligne : c'est le « + » qu'on
                        vient de presser, donc c'est là que l'œil retourne
                        pour savoir si le geste a porté. */}
                    {inRun.has(film.id) ? (
                      <Check size={13} color={C.pine} />
                    ) : (
                      <Plus size={12} color={C.inkFaded} />
                    )}
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 14,
                        color: inRun.has(film.id) ? C.inkFaded : C.ink,
                      }}
                    >
                      {film.title}
                    </span>
                    {director && (
                      <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                        {director.name}
                      </span>
                    )}
                    {film.status === "watchlist" && !inRun.has(film.id) && (
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.ochre }}>
                        {t("lineage.notSeenYet")}
                      </span>
                    )}
                    {inRun.has(film.id) && (
                      <span
                        style={{
                          fontFamily: F.mono,
                          fontSize: 9,
                          color: C.pine,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          marginLeft: "auto",
                        }}
                      >
                        {t("lineage.alreadyInRun")}
                      </span>
                    )}
                  </button>
                  {/* L'ŒIL À CÔTÉ DU `+`, ET C'EST ICI QU'IL MANQUAIT LE
                      PLUS : c'est le moment où l'on décide si un film a sa
                      place dans le plan, et on ne pouvait décider que sur
                      un titre et un nom. */}
                  <button
                    onClick={() => onLook(film)}
                    aria-label={t("lineage.quickOf", { title: film.title })}
                    title={t("lineage.quickOf", { title: film.title })}
                    style={eye}
                  >
                    <Eye size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {q.trim() && found.length === 0 && !busy && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {t("lineage.pickNothing")}
        </div>
      )}

      {/* LA MOITIÉ DISTANTE, ET DEUX FAÇONS DE LA DEMANDER. Elles ne
          partent jamais toutes seules, et surtout elles ne posent pas la
          même question : « ce titre » et « cette personne » sont deux
          gestes qu'un seul bouton mélangerait. */}
      <div style={{ marginTop: 10 }}>
        {apiKey ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => void look()}
              disabled={!q.trim() || busy}
              style={{
                ...inked(C.ink),
                ...hollow,
                fontFamily: F.mono,
                opacity: q.trim() && !busy ? 1 : 0.45,
              }}
            >
              <Search size={12} />
              {t(busy ? "lineage.searchingTmdb" : "lineage.searchTmdb")}
            </button>
            <button
              onClick={() => void lookDirector()}
              disabled={!q.trim() || busy}
              style={{
                ...inked(C.plum),
                fontFamily: F.mono,
                opacity: q.trim() && !busy ? 1 : 0.45,
              }}
            >
              <Clapperboard size={12} />
              {t("lineage.searchDirector")}
            </button>
          </div>
        ) : (
          <NoKey what={t("lineage.tmdbWhat")} />
        )}
      </div>

      {busy && <Waiting lines={3} label={t("lineage.searchingTmdb")} />}
      {trouble && <Trouble>{trouble}</Trouble>}

      {remote && fresh && !busy && (
        <>
          <div style={caption}>
            {remote.kind === "director"
              ? t("lineage.filmsOf", { name: remote.name })
              : t("lineage.onTmdb")}
          </div>
          {held > 0 && (
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 15,
                color: C.inkFaded,
                margin: "0 0 6px",
              }}
            >
              {t("lineage.alreadyHeld", { count: held })}
            </div>
          )}
          {fresh.length === 0 ? (
            <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
              {t(remote.kind === "director" ? "lineage.haveThemAll" : "lineage.tmdbNothing")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {fresh.map((hit) => {
                /* Un aperçu jetable, et son identifiant DÉRIVE du
                   `tmdbId` : tiré au sort, `tornClip` et `hueOf`
                   rebattraient les cartes à chaque rendu. */
                const preview = makeFilm({
                  id: `tmdb:${hit.tmdbId}`,
                  title: hit.title,
                  year: hit.year || "",
                  poster: hit.poster,
                  /* L'identifiant est ce qui permet à la vue rapide
                     d'aller chercher le reste : sans lui elle n'aurait
                     que le titre à montrer, c'est-à-dire cette ligne. */
                  tmdbId: hit.tmdbId,
                });
                return (
                  <li key={hit.tmdbId} style={line}>
                    <button
                      onClick={() => void adopt(hit)}
                      disabled={adding !== null}
                      style={{
                        ...row,
                        opacity: adding !== null && adding !== hit.tmdbId ? 0.4 : 1,
                      }}
                    >
                      <span style={{ width: 26, flexShrink: 0 }}>
                        <PosterArt
                          film={preview}
                          height={39}
                          width={26}
                          initials={initialsOf(hit.title)}
                          lazy
                        />
                      </span>
                      <Plus size={12} color={C.inkFaded} />
                      <span style={{ fontFamily: F.body, fontSize: 14 }}>{hit.title}</span>
                      {hit.year && (
                        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                          {hit.year}
                        </span>
                      )}
                      {adding === hit.tmdbId && (
                        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.ochre }}>
                          {t("lineage.adopting")}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => onLook(preview)}
                      aria-label={t("lineage.quickOf", { title: hit.title })}
                      title={t("lineage.quickOf", { title: hit.title })}
                      style={eye}
                    >
                      <Eye size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
