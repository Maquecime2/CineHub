/* ============================================================
   UN DÉFI QUI NE SORT D'AUCUNE LISTE
   ============================================================

   Les deux autres natures naissent DANS une liste — c'est la liste qui
   pose la question, et le formulaire vit donc sous elle. Un défi par
   critère n'a pas de liste : sa question est une décennie, un pays ou un
   cinéaste, et sa réponse est dans la collection de chacun. Il lui faut
   donc sa propre porte, à côté des défis et non dedans.

   TROIS FORMES ET PAS UNE DE PLUS. Ce sont les trois choses qu'une fiche
   complétée par TMDB porte toujours, donc les trois dont on peut faire
   une question à la collection. Un quatrième critère se répondrait « ça
   dépend si la fiche est remplie », et on perdrait un défi pour n'avoir
   pas fait ses imports — le serveur refuse le reste de toute façon.

   LA CIBLE EST OBLIGATOIRE, et le champ le dit plutôt que d'attendre le
   refus. « Tous les films des années 60 » n'a pas de fin : sans cible le
   dénominateur serait inconnu, la barre n'aurait pas de bout, et le défi
   ne se gagnerait jamais. Une liste, elle, se compte toute seule.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { hollow, inked, underlineInput } from "../../theme/styles";
import { Guideline, Label, Trouble } from "../../components/ui";
import { createChallenge } from "../../services/server";
import { currentMonth } from "./shared";

/** Les trois formes. Les clés sont celles que le serveur attend. */
const FORMS = ["decade", "country", "director"] as const;
type Form = (typeof FORMS)[number];

export function CriterionComposer({ onChange }: { onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const month = currentMonth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>("decade");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [start, setStart] = useState(month.start);
  const [end, setEnd] = useState(month.end);
  const [trouble, setTrouble] = useState<string | null>(null);

  const run = async () => {
    const said = value.trim();
    if (!title.trim() || !said || !target.trim()) return;
    setTrouble(null);
    try {
      /* La décennie part en NOMBRE et les deux autres en texte : c'est
         ce que le serveur distingue pour choisir la question, et lui
         envoyer « 1960 » entre guillemets en ferait un pays illisible. */
      const subject =
        form === "decade"
          ? { decade: Number(said) }
          : form === "country"
            ? { country: said }
            : { director: said };
      await createChallenge({
        listId: null,
        title: title.trim(),
        starts_on: start,
        ends_on: end,
        target: Number(target),
        kind: "critere",
        subject,
      });
      setTitle("");
      setValue("");
      setTarget("");
      setOpen(false);
      await onChange();
    } catch (e) {
      /* Le serveur dit CE QU'IL REFUSE en toutes lettres — « une
         décennie s'écrit 1960 », « un pays s'écrit en deux lettres » —
         et on le répète tel quel plutôt que de deviner une phrase à
         nous, qui finirait par contredire la sienne. */
      setTrouble((e as Error).message);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...inked(C.plum), ...hollow, marginTop: 10 }}
        data-tour="lists-criterion"
      >
        <Plus size={12} /> {t("listsView.criterionNew")}
      </button>
    );
  }

  return (
    <div style={{ border: `1px dashed ${C.line}`, padding: 12, marginTop: 10 }}>
      <Label>{t("listsView.criterionNew")}</Label>
      <Guideline tight>{t("listsView.criterionNote")}</Guideline>

      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
        {FORMS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setForm(f);
              setValue("");
            }}
            style={form === f ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
          >
            {t(`listsView.criterion.${f}`)}
          </button>
        ))}
      </div>

      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t(`listsView.criterionHint.${form}`)}
          aria-label={t(`listsView.criterion.${form}`)}
          style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, flex: "1 1 150px" }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("listsView.challengePlaceholder")}
          aria-label={t("listsView.startChallenge")}
          style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, flex: "1 1 150px" }}
        />
        <input
          type="number"
          min={1}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t("listsView.criterionTargetPlaceholder")}
          aria-label={t("listsView.targetLabel")}
          style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 88 }}
        />
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
        />
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
        />
        <button onClick={run} style={inked(C.burgundy)}>
          {t("listsView.launch")}
        </button>
      </div>
      <Trouble>{trouble}</Trouble>
    </div>
  );
}
