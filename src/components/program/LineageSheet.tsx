/* ============================================================
   LA CARTE DES CINÉASTES, ET CE QU'ON Y FAIT
   ============================================================

   ELLE ÉTAIT DANS LE FLUX, ET ELLE Y COÛTAIT QUATRE BOUTONS PERMANENTS —
   poser un lien, moissonner, oublier ce qui a été proposé, déplier —
   au-dessus d'un graphe replié qu'on ne voyait pas. Or un savoir sur le
   cinéma s'enrichit deux fois par mois, quand l'ordre du programme se
   regarde tous les soirs : ce n'est pas le même rythme, et ce n'était
   pas le même écran.

   PAR-DESSUS, LA PLACE EST CELLE DE LA FENÊTRE. C'est l'argument déjà
   écrit pour `FilmQuickView` et pour la liste ouverte : replié dans une
   colonne, un graphe est l'IMAGE d'une carte ; sous une feuille, il a
   enfin de quoi se lire, et le plafond de hauteur monte avec.

   `variant="center"`, ET SURTOUT PAS UN TIROIR. Un tiroir vit à 59/60 ;
   `BondForm` (50), `HintHarvest` (50) et la vue rapide (50) s'ouvrent
   DEPUIS cette feuille et passeraient dessous — mot pour mot le piège
   que `Sheet` annonce elle-même. Centrée, elles montent plus tard, donc
   leur portail est peint au-dessus à `z-index` égal. C'est écrit ici
   parce que ça tient à l'ordre de montage et que rien d'autre ne le
   protège. `Confirmation` vit à 60 et passe au-dessus des deux.

   CE QU'ON PERD, ET C'EST ASSUMÉ : on ne voit plus la carte ET le rail
   en même temps. La sélection croisée survit quand même, et c'est tout
   l'objet des deux gestes explicites — `onSeeSteps` ici, `onSeeOnMap`
   dans le panneau d'une étape : le foyer vit dans la VUE, pas dans cette
   feuille, donc il est déjà posé quand le voile tombe.

   LA VISITE VISE LA PORTE, JAMAIS LA FEUILLE, et c'est pourquoi
   `data-tour` n'est nulle part ici : une visite ne peut pas ouvrir une
   modale. */
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { bare, hollow, inked } from "../../theme/styles";
import { Sheet } from "../ui/Sheet";
import { LineageMap } from "./LineageMap";
import type { PlacedNode } from "./LineageMap";
import { NodePanel } from "./NodePanel";
import { BondDetail } from "./BondDetail";
import type { Bond } from "../../domain/bonds";
import type { Hint } from "../../domain/hints";
import type { LineageLink, LineageNode } from "../../domain/lineageMap";
import type { Film } from "../../types";

interface LineageSheetProps {
  placed: PlacedNode[];
  links: LineageLink[];
  films: Film[];
  bonds: Bond[];
  /** Le nœud choisi, s'il y en a un. Le foyer vit dans la VUE. */
  node?: LineageNode;
  focusKey: string | null;
  focusBond: string | null;
  /** Les liens proposés par une machine, et qu'on peut reprendre. */
  hinted: Bond[];
  /** Les fiches déjà au programme : le panneau n'offre pas de doublon. */
  inCourse: Set<string>;
  onPickPerson: (key: string) => void;
  onPickBond: (bondId: string) => void;
  onAdd: (filmId: string) => void;
  onAddAll: (filmIds: string[]) => void;
  onOpenPerson: (key: string) => void;
  onAddBond: (name: string, hint?: Hint) => void;
  onHarvest: () => void;
  onForgetHinted: () => void;
  onRemoveBond: (bond: Bond) => void;
  /** Allumer les étapes qui invoquent cette arête — et se refermer. */
  onSeeSteps: (bondId: string) => void;
  onClose: () => void;
}

export function LineageSheet({
  placed,
  links,
  films,
  bonds,
  node,
  focusKey,
  focusBond,
  hinted,
  inCourse,
  onPickPerson,
  onPickBond,
  onAdd,
  onAddAll,
  onOpenPerson,
  onAddBond,
  onHarvest,
  onForgetHinted,
  onRemoveBond,
  onSeeSteps,
  onClose,
}: LineageSheetProps) {
  const { t } = useTranslation();
  const bond = focusBond ? bonds.find((b) => b.id === focusBond) : undefined;

  return (
    <Sheet
      title={t("program.mapTitle")}
      aside={t("program.bondCount", { count: bonds.length })}
      width={1100}
      onClose={onClose}
    >
      <LineageMap
        placed={placed}
        links={links}
        bonds={bonds}
        focusKey={focusKey}
        focusBond={focusBond}
        onPickPerson={onPickPerson}
        onPickBond={onPickBond}
        /* Le plafond de la colonne n'a plus de raison d'être : ici, le
           graphe ne partage l'écran avec rien. */
        maxHeight="58vh"
        action={
          <>
            <button onClick={() => onAddBond("")} style={{ ...inked(C.plum), fontFamily: F.mono }}>
              {t("program.addBond")}
            </button>
            <button onClick={onHarvest} style={{ ...inked(C.ink), ...hollow, fontFamily: F.mono }}>
              {t("program.harvest")}
            </button>
            {/* N'APPARAÎT QUE S'IL Y A DE QUOI REPRENDRE : un bouton de
                retrait sur une carte qu'on a écrite à la main ne désigne
                rien. */}
            {hinted.length > 0 && (
              <button
                onClick={onForgetHinted}
                style={{ ...bare, color: C.burgundy, fontFamily: F.mono, fontSize: 9.5 }}
              >
                {t("program.forgetHinted", { count: hinted.length })}
              </button>
            )}
          </>
        }
      />

      {node && (
        <NodePanel
          node={node}
          films={films}
          bonds={bonds}
          inCourse={inCourse}
          onAdd={onAdd}
          onAddAll={onAddAll}
          onOpenPerson={onOpenPerson}
          onPickBond={onPickBond}
          onAddBond={onAddBond}
          onClose={() => onPickPerson(node.key)}
        />
      )}

      {/* L'ARÊTE SÉLECTIONNÉE SE RETIRE D'ICI, et pas depuis la ligne du
          SVG : une croix de six pixels sur un trait qu'on peut déplacer
          est une cible qu'on rate. */}
      {bond && (
        <BondDetail
          bond={bond}
          onRemove={onRemoveBond}
          /* LE SENS ARÊTE → ÉTAPES, ET IL FERME. Sans ce geste, choisir
             une arête allume le rail SOUS le voile, c'est-à-dire nulle
             part. */
          onSeeSteps={() => onSeeSteps(bond.id)}
        />
      )}
    </Sheet>
  );
}
