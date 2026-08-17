/* ============================================================
   THE ENTRY ONE HAS PICKED, AND WHY IT SITS THERE
   ============================================================

   THE THREE PLANES OF A JUSTIFICATION, IN ONE PLACE. They used to be
   stacked inside every row of a column, so eight entries drew eight
   copies of a panel meant to be read once: eight open textareas, eight
   dropdowns, eight lines of bonds. Read like that, none of them was
   read at all.

   `why` IS THE MARGINAL NOTE, `because` POINTS AT A BOND, and the bonds
   of this film-maker are read out in plain prose above both. None
   replaces the others — prose says what only prose can, and the pointer
   is what makes the reasoning navigable from either end.

   IT IS PAGE CONTENT AND NOT A LAYER. Nothing here takes the screen
   away: no `Layer`, no `useDialog`, no scrim. Those are for what
   interrupts — the bond form does interrupt, and it has them. */
import { useTranslation } from "react-i18next";
import { Eye, ExternalLink, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked, ruledTextarea } from "../../theme/styles";
import { Label } from "../ui";
import { bondLabel, bondsTouching } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import { stepBond } from "../../domain/course";
import { primaryDirector } from "../../domain/lineageMap";
import type { Step } from "../../domain/course";
import type { Film } from "../../types";
import { BondPicker } from "./BondPicker";

interface StepPanelProps {
  step: Step;
  film: Film;
  place: number;
  bonds: Bond[];
  /** Le cinéaste choisi sur la carte : on propose de le nouer à celui-ci. */
  otherName: string | null;
  /**
   * `settled` distingue la FRAPPE du GESTE. Une lettre tapée dans la
   * note s'écrit en différé ; un ruban qu'on presse est fini au moment
   * où on le presse, et doit s'écrire tout de suite AVEC son patch —
   * poser le patch en différé puis « régler » derrière rejouerait le
   * parcours d'avant par-dessus.
   */
  onPatch: (patch: Partial<Step>, settled: boolean) => void;
  /** La frappe est finie : on écrit ce qui est à l'écran. */
  onSettle: () => void;
  /** Le cinéaste de cette entrée, et l'autre bout quand on le tient. */
  onTie: (from: string, to?: string) => void;
  onRemove: () => void;
  onOpen: () => void;
  /** La vue rapide : tout ce qu'on sait du film, sans quitter le plan. */
  onQuick: () => void;
  onClose: () => void;
}

export function StepPanel({
  step,
  film,
  place,
  bonds,
  otherName,
  onPatch,
  onSettle,
  onTie,
  onRemove,
  onOpen,
  onQuick,
  onClose,
}: StepPanelProps) {
  const { t } = useTranslation();
  const director = primaryDirector(film);
  const theirs = director ? bondsTouching(bonds, director.key) : [];
  const because = stepBond(step, bonds);

  return (
    <div
      data-tour="lineage-why"
      style={{
        marginTop: 16,
        border: `1px solid ${C.line}`,
        background: C.card,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>{place}</span>
        <div style={{ fontFamily: F.title, fontSize: 20, color: C.ink, flex: 1, minWidth: 0 }}>
          {film.title}
        </div>
        <button
          onClick={onClose}
          aria-label={t("lineage.close")}
          title={t("lineage.close")}
          style={{ ...bare, padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>

      {director && (
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 2 }}>
          {director.name}
        </div>
      )}

      {/* LES LIENS DU CINÉASTE, LUS EN CLAIR ET SANS RIEN SAISIR.
          `bondLabel` les lit DEPUIS cette personne, donc « a pour maître
          X » et non l'inverse. C'est ce qui fait que le graphe se lit
          même sans regarder le graphe. */}
      {director && theirs.length > 0 && (
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 9.5,
            color: alpha(C.ink, 0.6),
            marginTop: 6,
          }}
        >
          {theirs.map((b) => bondLabel(b, director.key, t)).join(" · ")}
        </div>
      )}

      {/* WHY THIS FILM, AT THIS PLACE. Ouvert d'emblée : le panneau ne
          s'ouvre que sur une entrée qu'on a désignée, donc écrire est
          précisément ce qu'on vient y faire. */}
      <div style={{ marginTop: 12 }}>
        <Label>{t("lineage.whyLabel")}</Label>
        <textarea
          value={step.why}
          onChange={(e) => onPatch({ why: e.target.value }, false)}
          onBlur={onSettle}
          rows={2}
          placeholder={t("lineage.whyPlaceholder")}
          aria-label={t("lineage.whyLabel")}
          style={{ ...ruledTextarea, fontSize: 18, lineHeight: "28px", marginTop: 4 }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <BondPicker
          directorName={director?.name ?? null}
          directorKey={director?.key ?? null}
          bonds={theirs}
          value={because}
          onPick={(bondId) => onPatch({ because: bondId }, true)}
          onTie={() => director && onTie(director.name)}
        />
      </div>

      {/* LES DEUX BOUTS DÉJÀ DÉSIGNÉS. On a une étape sous les yeux et un
          cinéaste choisi sur la carte : le formulaire n'a plus qu'une
          nature à demander. */}
      {otherName && director && otherName !== director.name && (
        <button
          onClick={() => onTie(director.name, otherName)}
          style={{ ...inked(C.plum), marginTop: 10, fontFamily: F.mono }}
        >
          {t("lineage.tieBoth", { from: director.name, to: otherName })}
        </button>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {/* LA VUE RAPIDE AVANT LA FICHE ENTIÈRE, et c'est l'ordre qui
            compte : décider si un film a sa place dans un parcours
            demande de savoir de quoi il parle, et ouvrir la fiche perd
            le parcours qu'on était en train de bâtir. */}
        <button onClick={onQuick} style={{ ...inked(C.plum) }}>
          <Eye size={12} />
          {t("lineage.quickLook")}
        </button>
        <button onClick={onOpen} style={{ ...inked(C.ink), ...hollow }}>
          <ExternalLink size={12} />
          {t("lineage.openFilm")}
        </button>
        <button onClick={onRemove} style={{ ...inked(C.ink), ...hollow, color: C.burgundy }}>
          <X size={12} />
          {t("lineage.remove")}
        </button>
      </div>
    </div>
  );
}
