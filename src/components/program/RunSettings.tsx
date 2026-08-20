/* ============================================================
   RÉGLER UN PARCOURS N'EST PAS LE LIRE
   ============================================================

   L'ÉCRAN ACCUEILLAIT PAR DEUX FORMULAIRES OUVERTS. Un champ de titre,
   une thèse de deux lignes, cinq rubans de nature et jusqu'à
   vingt-quatre puces de valeur : la moitié de la hauteur posait des
   questions à quelqu'un qui venait seulement REGARDER où il en était de
   son programme. Un formulaire ouvert demande quelque chose ; personne
   ne demandait rien.

   C'est mot pour mot le défaut que « ON ARRIVE SUR UN ÉCRAN, PAS SUR UN
   FORMULAIRE » a déjà retiré des listes et du quizz. La Programmation
   n'avait pas été rapatriée : un bouton, une feuille, on enregistre.

   CE QUI RESTE DANS LE FLUX EST CE QU'ON LIT : les puces de parcours, le
   bouton d'un parcours neuf, et le TITRE. On doit savoir ce qu'on
   regarde sans ouvrir une feuille — et l'épingle reste lisible elle
   aussi, puisque la puce dessine la sienne.

   LE PIÈGE EST DANS L'ÉCRITURE DIFFÉRÉE, ET IL PERD DES DONNÉES. Le
   titre et la thèse écrivent en différé à la frappe et RÉGLÉ au `blur` —
   c'est ce qui évite d'écrire au disque à chaque lettre. Or fermer la
   feuille la démonte AVANT que le `blur` ne parte : seule l'écriture
   différée subsisterait, et le dernier mot tapé serait perdu au premier
   rechargement. La sortie règle donc elle-même, et il n'y a qu'une
   sortie — `Sheet` ne connaît qu'une porte, Échap et le voile compris.

   LA SUPPRESSION EST ICI ET GARDE SA CONFIRMATION. C'est le geste le
   plus lourd de l'écran ; le mettre sous une feuille l'éloigne de la
   main sans lui retirer sa garde, et la confirmation dit toujours ce
   qui SURVIT. */
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, hollow, inked, ruledTextarea, underlineInput } from "../../theme/styles";
import { Label } from "../ui";
import { Sheet } from "../ui/Sheet";
import type { Course } from "../../domain/course";
import { ThreadBar } from "./ThreadBar";
import type { Film } from "../../types";

interface RunSettingsProps {
  course: Course;
  /** Ce qu'on possède : le fil rouge n'offre que cela. */
  films: Film[];
  /** Réglé : un choix est fini au moment où il arrive. */
  onCourse: (next: Course) => void;
  /** Différé : pendant la frappe. */
  onCourseSoon: (next: Course) => void;
  onDelete: (course: Course) => void;
  onClose: () => void;
}

export function RunSettings({
  course,
  films,
  onCourse,
  onCourseSoon,
  onDelete,
  onClose,
}: RunSettingsProps) {
  const { t } = useTranslation();

  /* ET ELLE NE RÈGLE QUE S'IL Y A DE QUOI. Une feuille qu'on ouvre pour
     regarder et qu'on referme ne doit pas écrire au disque : sans ce
     témoin, ouvrir puis fermer touchait `updatedAt`, donc déplaçait le
     parcours dans « le dernier touché » et le faisait voyager en
     synchro. Un `ref` et non un état — il ne se dessine pas. */
  const typed = useRef(false);
  const draft = (next: Course) => {
    typed.current = true;
    onCourseSoon(next);
  };
  const settle = () => {
    if (!typed.current) return;
    typed.current = false;
    onCourse(course);
  };

  /* LA SORTIE RÈGLE — voir l'en-tête. Une seule porte, donc un seul
     endroit où le dire. */
  const leave = () => {
    settle();
    onClose();
  };

  return (
    <Sheet title={t("program.runSettings")} width={620} onClose={leave}>
      <Label>{t("program.courseName")}</Label>
      <input
        value={course.label}
        onChange={(e) => draft({ ...course, label: e.target.value })}
        onBlur={settle}
        placeholder={t("program.untitled")}
        aria-label={t("program.courseName")}
        style={{ ...underlineInput, fontFamily: F.title, fontSize: 24 }}
      />

      <div style={{ marginTop: 16 }}>
        <Label>{t("program.thesis")}</Label>
        <textarea
          value={course.note}
          onChange={(e) => draft({ ...course, note: e.target.value })}
          onBlur={settle}
          rows={3}
          placeholder={t("program.thesisPlaceholder")}
          aria-label={t("program.thesis")}
          style={{ ...ruledTextarea, marginTop: 6 }}
        />
      </div>

      <ThreadBar
        thread={course.thread}
        films={films}
        onThread={(thread) => onCourse({ ...course, thread })}
      />

      {/* CE QU'ON FAIT UNE FOIS, AU PIED. L'épingle est ce que le reste
          de l'application LIT — une fiche, la liste à voir, la porte du
          classeur parlent d'UN parcours — donc elle se règle ici, et son
          état se lit dans le flux sur la puce. */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 22,
          paddingTop: 14,
          borderTop: `1px dashed ${C.line}`,
        }}
      >
        <button
          onClick={() => onCourse({ ...course, pinned: !course.pinned })}
          aria-pressed={!!course.pinned}
          style={{
            ...inked(C.ink),
            ...hollow,
            color: course.pinned ? C.plum : C.ink,
            fontFamily: F.mono,
          }}
        >
          {course.pinned ? <Pin size={12} /> : <PinOff size={12} />}
          {t(course.pinned ? "program.unpin" : "program.pin")}
        </button>

        <button
          onClick={() => {
            /* On ferme AVANT de demander : la confirmation vit à 60 et
               passerait par-dessus la feuille, mais on resterait devant
               un parcours qu'on vient d'effacer. */
            leave();
            onDelete(course);
          }}
          style={{
            ...bare,
            marginLeft: "auto",
            color: C.burgundy,
            fontFamily: F.mono,
            fontSize: 10,
          }}
        >
          <Trash2 size={12} />
          {t("program.deleteCourse")}
        </button>
      </div>
    </Sheet>
  );
}
