/* ============================================================
   LE MIROIR EN LISTE — et ce n'est pas une politesse

   La règle est déjà écrite pour la carte des filiations : un plan n'a pas
   d'ordre de lecture, quel que soit le soin mis aux `aria-label`, et la
   liste masquée est le seul chemin linéaire honnête. Une étagère de
   quatre cents boîtiers rangés dans un ESPACE pose exactement la même
   question, et n'avait aucune réponse : ni `role="list"`, ni ordre, ni un
   seul moyen d'en faire le tour autrement qu'à la souris.

   ELLE REFLÈTE LE TABLEAU, ELLE NE LE RÉÉCRIT PAS. Rang après rang,
   ligne après ligne, boîtier après boîtier, dans l'ordre où le rangement
   les tient. Trier ou regrouper ici donnerait au lecteur d'écran une
   étagère qui n'est pas celle qu'on a rangée — c'est-à-dire le contraire
   d'un miroir.

   ELLE NE RANGE PAS. Ouvrir une fiche, oui ; déplacer un boîtier, non.
   Le rangement au clavier est un chantier à lui seul, adossé au cache de
   mesures du glissement, et laisser croire qu'il est là serait pire que
   son absence.

   ELLE SERT DE REPLI SUR TÉLÉPHONE ÉTROIT, comme celle des filiations.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { HIDDEN } from "../../theme/styles";
import { filmsInRow } from "../../domain/shelfReading";
import { wearOf } from "../../domain/patina";
import type { ReadableItem } from "../../domain/shelfReading";
import type { Film } from "../../types";

interface MirrorRow {
  id: string;
  label?: string;
  items?: ReadableItem[];
}
interface MirrorShelf {
  kind: string;
  rows: MirrorRow[];
}

export function ShelfMirror({
  shelves,
  films,
  neglectDays,
  onOpen,
}: {
  shelves: MirrorShelf[];
  films: Map<string, Film>;
  neglectDays: number | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();

  /* CE QUE LE DESSIN NE PEUT PAS DIRE. Un dégradé ne se lit pas au
     lecteur d'écran : l'usure se VOIT sur l'objet, elle s'ÉNONCE ici.

     `fresh` ne dit rien, exactement comme il ne dessine rien — annoncer
     « vu récemment » quatre cents fois noierait les trois boîtiers dont
     on voulait parler. */
  const wearWords = (film: Film): string => {
    if (neglectDays == null) return "";
    const wear = wearOf(film, neglectDays);
    if (wear.state === "sealed") return t("shelf.wear.sealed");
    if (wear.state === "undated") return t("shelf.wear.undated");
    if (wear.state === "dormant") return t("shelf.wear.dormant", { count: wear.since ?? 0 });
    return "";
  };

  return (
    <nav style={HIDDEN} aria-label={t("shelf.mirror.title")}>
      {shelves.map((shelf) => (
        <section key={shelf.kind}>
          <h3>{t(`shelf.kinds.${shelf.kind}.title`)}</h3>
          <ol>
            {shelf.rows.map((row, i) => {
              const ids = filmsInRow(row.items);
              if (ids.length === 0) return null;
              return (
                <li key={row.id}>
                  <span>{row.label || t("shelf.mirror.row", { n: i + 1 })}</span>
                  <ol>
                    {ids.map((id) => {
                      /* UNE FICHE DISPARUE SE SAUTE À L'AFFICHAGE et
                         laisse le rangement tranquille : lire n'écrit
                         pas. La copie de `threadMembers`. */
                      const film = films.get(id);
                      if (!film) return null;
                      const wear = wearWords(film);
                      return (
                        <li key={id}>
                          <button type="button" onClick={() => onOpen(id)}>
                            {[film.title, film.year || null, film.director || null, wear || null]
                              .filter(Boolean)
                              .join(" — ")}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </nav>
  );
}
