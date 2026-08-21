/* ============================================================
   CE QU'IL Y A SUR CE RAYON — la légende des boîtes

   Une boîte de catégorie porte un nom et une couleur. La couleur se voit
   de loin, le nom seulement de près : on rangeait « polar » en cobalt un
   mardi, et six mois plus tard on avait devant soi un rayon de pastilles
   bleues sans savoir laquelle était laquelle. Une couleur qu'on ne peut
   pas relire ne range rien, elle décore.

   ELLE NE SE DESSINE PAS QUAND IL N'Y A PAS DE BOÎTE. Ce n'est pas un
   `Nothing` : il n'y a rien à annoncer, et une légende vide au-dessus de
   chaque étagère serait un bandeau à ignorer en permanence. C'est la
   règle des sections de la vue rapide — une section vide ne se dessine
   pas, un champ vide se dessine avec un tiret.

   ELLE MÈNE, AUSSI. Cliquer une pastille défile jusqu'à la boîte : c'est
   le même geste que « aller au suivant », par le même chemin — le
   document et son `data-shelf-item`, qui est déjà l'identité d'une boîte
   pour le glissement.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { catInk } from "../../theme/palette";
import type { BoxReading } from "../../domain/shelfReading";

export function ShelfLegend({ boxes }: { boxes: BoxReading[] }) {
  const { t } = useTranslation();
  if (boxes.length === 0) return null;

  const goTo = (id: string) => {
    const node = document.querySelector<HTMLElement>(`[data-shelf-item="${CSS.escape(id)}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    node.removeAttribute("data-found-flash");
    void node.offsetWidth;
    node.setAttribute("data-found-flash", "");
  };

  return (
    <nav
      data-tour="shelf-legend"
      aria-label={t("shelf.legend.title")}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "0 4px 12px",
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          letterSpacing: 1.2,
          color: C.inkFaded,
          opacity: 0.7,
        }}
      >
        {t("shelf.legend.title")}
      </span>
      {boxes.map((box) => {
        const ink = catInk(box.color);
        return (
          <button
            key={box.id}
            onClick={() => goTo(box.id)}
            title={t("shelf.legend.goTo", { name: box.label || t("shelf.unnamed") })}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 7px",
              fontFamily: F.mono,
              fontSize: 9.5,
              color: C.ink,
              background: alpha(ink, 0.14),
              border: `1px solid ${alpha(ink, 0.5)}`,
            }}
          >
            {/* LA PASTILLE NE DIT RIEN À ELLE SEULE, et c'est voulu : le
                NOM est à côté, en toutes lettres. Cinq des quatorze peaux
                effacent une couleur, et c'est la règle du verdict du
                quizz — un mot, jamais une couleur seule. */}
            <span
              aria-hidden
              style={{ width: 8, height: 8, background: ink, flexShrink: 0, borderRadius: 1 }}
            />
            {box.label || t("shelf.unnamed")}
            <span style={{ opacity: 0.6 }}>{box.cases}</span>
            {box.found > 0 && (
              <span style={{ color: C.card, background: C.ink, padding: "0 4px" }}>
                {box.found}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
