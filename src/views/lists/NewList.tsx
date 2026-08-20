/* ============================================================
   OUVRIR UNE LISTE
   ============================================================

   C'ÉTAIT UN CHAMP POSÉ EN HAUT DE LA VUE, TOUJOURS LÀ. Un libellé, une
   ligne à remplir et un bouton, au-dessus du mur, pour un geste qu'on
   fait trois fois dans une vie de classeur — et qui occupait le premier
   tiers de l'écran chaque fois qu'on venait simplement REGARDER ses
   listes. Un formulaire ouvert en permanence demande quelque chose ;
   ici, personne ne demandait rien.

   UN BOUTON, UNE FEUILLE, ON ENREGISTRE. C'est la forme qu'attend
   n'importe qui arrivant sur cet écran, et c'est déjà celle de
   `NewChallenge` juste en dessous : deux créations voisines qui ne se
   ressemblent pas obligent à réapprendre la seconde.

   L'INTENTION EST DANS LA FEUILLE, ET ELLE N'ÉTAIT NULLE PART.
   `List.intent` existe depuis toujours dans le modèle, `createList` le
   prend, et aucun écran ne l'avait jamais offert : on ouvrait des listes
   qui ne pouvaient pas dire à quoi elles servaient. La place manquait
   sur une ligne ; par-dessus, elle ne manque plus.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { inked, underlineInput, ruledTextarea } from "../../theme/styles";
import { Guideline, Trouble } from "../../components/ui";
import { Sheet } from "../../components/ui/Sheet";

export function NewList({
  onCreate,
  onClose,
}: {
  onCreate: (l: { title: string; intent: string; is_public: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState("");
  /* FERMÉE PAR DÉFAUT, comme le schéma le veut. La case est là pour
     qu'on sache que le choix existe, pas pour qu'on le fasse. */
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const save = async () => {
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      await onCreate({ title: name, intent: intent.trim(), is_public: open });
      onClose();
    } catch (e) {
      /* ON NE FERME PAS SUR UN ÉCHEC. Fermer perdrait ce qui vient
         d'être tapé, et laisserait croire que c'est passé. */
      setTrouble((e as Error).message);
      setBusy(false);
    }
  };

  return (
    /* PAS D'ANCRE DE VISITE ICI. `lists-new` est sur le BOUTON qui
       ouvre cette feuille : une visite ne peut pas ouvrir une modale, et
       deux éléments portant la même ancre en font viser un au hasard. */
    <Sheet title={t("listsView.newList")} width={520} onClose={onClose}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        /* ENTRÉE ENREGISTRE, parce qu'un champ unique suivi d'un bouton
           l'attend. Elle ne le fait PAS depuis l'intention, qui est un
           bloc de texte où la touche sert à changer de ligne. */
        onKeyDown={(e) => e.key === "Enter" && void save()}
        placeholder={t("listsView.newListPlaceholder")}
        aria-label={t("listsView.newListLabel")}
        autoFocus
        style={{ ...underlineInput, fontFamily: F.hand, fontSize: 19, width: "100%" }}
      />

      <div style={{ marginTop: 18 }}>
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder={t("listsView.intentPlaceholder")}
          aria-label={t("listsView.intentLabel")}
          rows={3}
          style={{ ...ruledTextarea, width: "100%" }}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginTop: 16,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          cursor: "pointer",
        }}
      >
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        {t("listsView.publicNote")}
      </label>

      <Guideline tight>{t("listsView.fillNote")}</Guideline>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
        <button onClick={() => void save()} disabled={busy || !title.trim()} style={inked(C.ink)}>
          {t("listsView.open")}
        </button>
      </div>

      <Trouble>{trouble}</Trouble>
    </Sheet>
  );
}
