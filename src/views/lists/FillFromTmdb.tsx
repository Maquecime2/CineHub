import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { Trouble } from "../../components/ui";
import { FilmPicker } from "../../components/film/FilmPicker";
import { posterPathOf } from "../../tmdb";
import { addToList, type List, type ListWork } from "../../services/server";
import type { Film } from "../../types";

/* ============================================================
   FILLING A LIST FROM TMDB
   ============================================================

   The old note here said that filling a list from this view would have
   meant rebuilding a whole TMDB search in a place where there is nothing
   to look at, and that the gesture therefore belonged to the card. Half
   of that is still true — a card is the best place to file the film one
   is reading about — but the conclusion no longer holds, for a reason
   that has nothing to do with taste:

   A LIST CAN HOLD A FILM THE BINDER DOES NOT. That is the whole point of
   holding works rather than copies. "Come and see this in March" is
   said about films one has not got; from the card alone, those were
   precisely the ones that could never be proposed.

   And the search costs little: the server already relays TMDB, so
   somebody signed in needs no key of their own. */
export function FillFromTmdb({
  list,
  works,
  films,
  onLook,
  onFiled,
}: {
  list: List;
  /** Ce que la liste tient déjà — pour ne pas proposer deux fois. */
  works: ListWork[];
  films: Film[];
  onLook: (film: Film) => void;
  onFiled: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [trouble, setTrouble] = useState<string | null>(null);

  /* One writes in a list one may write in. A stranger's public list is
     read here, not filled. */
  if (!list.mienne && !list.isMember) return null;

  /* CE QUE LA LISTE TIENT DÉJÀ, DIT SUR LES FICHES DU CLASSEUR. Le
     sélecteur marque ses lignes avec un jeu d'identifiants de FICHES ;
     une liste, elle, range des ŒUVRES par leur identité TMDB. La
     traduction se fait donc ici, et pas dans le sélecteur — qui n'a pas
     à connaître les listes. */
  const inList = new Set(
    films
      .filter((f) => f.tmdbId && works.some((w) => String(w.tmdb_id) === String(f.tmdbId)))
      .map((f) => f.id)
  );

  const fileIt = async (o: {
    tmdbId: number | string;
    title: string;
    year?: string | number | null;
    /* L'URL COMPLÈTE TELLE QUE LA FICHE LA PORTE, ramenée à son chemin
       au dernier moment. Les deux appelants — une fiche du classeur, un
       résultat de TMDB — la tiennent déjà à l'écran ; s'en passer était
       la raison pour laquelle une liste ne montrait rien. */
    poster?: string;
  }) => {
    setTrouble(null);
    try {
      await addToList(list.id, {
        tmdbId: o.tmdbId,
        title: o.title,
        year: o.year == null || o.year === "" ? undefined : String(o.year),
        posterPath: posterPathOf(o.poster) || undefined,
      });
      await onFiled();
    } catch (e) {
      setTrouble((e as Error).message || t("lists.filingFailed"));
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <FilmPicker
        films={films}
        /* UNE FICHE DU CLASSEUR : elle part telle quelle, à condition
           d'avoir une identité TMDB. Une liste range des œuvres et non
           des copies, donc une fiche tapée à la main n'y entre pas — et
           on le DIT, là où le sélecteur l'aurait rangée en silence. */
        onPick={(film) => {
          if (!film.tmdbId) {
            setTrouble(t("lists.noneFileable", { count: 1 }));
            return;
          }
          void fileIt({
            tmdbId: film.tmdbId,
            title: film.title,
            year: film.year,
            poster: film.poster,
          });
        }}
        /* ET CELLE QUE LE CLASSEUR N'A PAS : on la range dans la LISTE,
           et surtout pas dans la collection. Les filiations l'adoptent
           parce qu'un parcours est fait de fiches ; une liste tient des
           œuvres, et écrire une fiche chez quelqu'un qui a seulement dit
           « viens voir ça en mars » serait remplir son classeur à sa
           place. `FilmPicker` a déjà demandé `getDetails`, donc l'année
           qui arrive ici est celle de TMDB et non celle de l'aperçu. */
        onAdopt={(film) =>
          void fileIt({
            tmdbId: film.tmdbId!,
            title: film.title,
            year: film.year,
            poster: film.poster,
          })
        }
        onLook={onLook}
        inRun={inList}
        label={t("lists.search")}
        tour="lists-search"
      />
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
        {t("lists.searchNote")}
      </div>
      <Trouble>{trouble}</Trouble>
    </div>
  );
}
