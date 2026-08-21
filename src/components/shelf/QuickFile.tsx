/* ============================================================
   LE CLASSEUR RAPIDE — les boîtes, pendant qu'on tient une fiche
   ============================================================

   RANGER UNE FICHE DEMANDAIT DE LA PROMENER. Les boîtes d'une étagère
   sont réparties sur toute la hauteur de la vue, souvent hors écran :
   attraper une affiche en haut et la déposer dans une catégorie qui se
   trouve six rangées plus bas voulait dire traverser la page en tenant
   le bouton, avec le défilement automatique du navigateur pour seul
   guide. Sur un long mur, c'est une dizaine de secondes par film.

   IL EST ANCRÉ À UN BORD, ET NE SUIT PAS LE CURSEUR. Un panneau qui
   suit la main se met devant ce qu'on vise, et oblige à viser deux
   choses à la fois — la cible et le panneau qui la couvre. Ancré, il est
   TOUJOURS au même endroit : on apprend le geste une fois, et il marche
   quel que soit l'endroit d'où l'on est parti.

   À DROITE, ET IL A COMMENCÉ À GAUCHE. Le raisonnement d'origine était
   que le cabinet des objets occupe la droite ; il était juste sur le
   papier et faux à l'usage. Les fiches d'une rangée commencent à
   GAUCHE : le panneau s'ouvrait sur le premier appui, donc pile sous le
   curseur de qui attrape la première case, et le glissement partait une
   fois sur deux.

   Les deux panneaux ne se croisent pas pour autant : le cabinet ne
   s'ouvre que pour un objet, celui-ci que pour une fiche, et on ne
   glisse jamais les deux à la fois.

   ------------------------------------------------------------
   IL N'EST PAS RENDU PAR REACT PENDANT LE GLISSEMENT
   ------------------------------------------------------------

   C'est la contrainte de ce fichier, et elle est écrite dans
   `ShelfBoard` : un `setState` au début d'un glissement redessine
   l'étagère, salit la mise en page, et le premier survol doit alors la
   recalculer entièrement avant que le repère n'apparaisse — c'était la
   dernière lenteur visible du produit.

   Le panneau est donc MONTÉ EN PERMANENCE et caché en CSS ; on l'ouvre
   et on le ferme à la main, par sa référence, exactement comme le repère
   de dépôt et l'attribut `data-dragging`. La liste des boîtes, elle,
   vient du rendu ordinaire : elle ne change pas pendant qu'on glisse.

   IL LAISSE LE TIROIR ATTEIGNABLE, ET C'EST UNE CONTRAINTE ET NON UN
   REGLAGE. Le tiroir des « mis de cote » est ancre AU MEME BORD et A LA
   MEME HAUTEUR : son onglet est une cible de depot — le survoler en
   glissant ouvre le tiroir — et ce panneau, plus haut dans la pile
   (46 contre 41), se posait dessus. On croyait viser le tiroir, on
   deposait dans une categorie. Il se decale donc de la bande de
   l'onglet, et de TOUTE la largeur du tiroir quand celui-ci est ouvert :
   sinon il couvrirait les rangees qu'on vient y deposer.

   IL PASSE PAR `<Layer>` : `position: fixed` rendu dans la colonne de
   vue s'ancrerait sur la colonne, qui porte une transformation pendant
   son animation d'entrée.
   ============================================================ */
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { catInk } from "../../theme/palette";
import { Layer } from "../ui/Layer";
import { DRAWER_W, DRAWER_TAB_W } from "./layout";

/** Une boîte de l'étagère, prête à recevoir. */
export interface QuickBox {
  kind: string;
  rowId: string;
  catId: string;
  label: string;
  color: string;
  /** Combien de fiches elle contient déjà. */
  count: number;
}

export const QuickFile = forwardRef<
  HTMLDivElement,
  {
    boxes: QuickBox[];
    /** Le tiroir des mis de côté est-il ouvert : on lui laisse la place. */
    drawerOpen?: boolean;
    /** Le lâcher : c'est l'appelant qui sait quelle fiche on tient. */
    onDrop: (box: QuickBox) => void;
  }
>(function QuickFile({ boxes, drawerOpen, onDrop }, ref) {
  const { t } = useTranslation();

  /* PAS DE BOÎTE, PAS DE PANNEAU. Une étagère sans catégorie n'a rien à
     proposer, et un cadre vide qui apparaît à chaque glissement est une
     gêne de plus. */
  if (boxes.length === 0) return null;

  return (
    <Layer>
      <div
        ref={ref}
        aria-hidden
        style={{
          position: "fixed",
          right: drawerOpen ? DRAWER_W + 18 : DRAWER_TAB_W + 14,
          top: "50%",
          transform: "translateY(-50%)",
          transition: "right var(--motion-slow) var(--motion-ease)",
          zIndex: 46,
          width: 190,
          maxHeight: "70vh",
          overflowY: "auto",
          padding: "10px 12px 12px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: "2px 8px 22px rgba(30,20,10,0.34)",
          /* FERMÉ PAR DÉFAUT, ET OUVERT À LA MAIN. `display` plutôt
             qu'un montage conditionnel : le panneau doit exister dans le
             document avant que le glissement ne commence, sinon
             l'ouvrir demanderait un rendu — ce que ce chemin s'interdit. */
          display: "none",
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 8.5,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.inkFaded,
            marginBottom: 2,
          }}
        >
          {t("shelf.quickFile")}
        </div>
        <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginBottom: 8 }}>
          {t("shelf.quickFileHint")}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {boxes.map((b) => {
            const ink = catInk(b.color);
            return (
              <div
                key={`${b.kind}:${b.catId}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  e.currentTarget.style.background = alpha(ink, 0.22);
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.background = alpha(ink, 0.08);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.background = alpha(ink, 0.08);
                  onDrop(b);
                }}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  padding: "6px 8px",
                  background: alpha(ink, 0.08),
                  borderLeft: `3px solid ${ink}`,
                  /* Le fond change au survol : c'est le seul retour
                     possible ici, puisque le curseur est déjà pris par
                     le glissement. */
                  transition: "background var(--motion-fast) var(--motion-ease)",
                }}
              >
                <span
                  style={{
                    fontFamily: F.title,
                    fontSize: 13,
                    color: C.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.label}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
                  {b.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Layer>
  );
});
