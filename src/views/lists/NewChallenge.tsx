/* ============================================================
   LANCER UN DÉFI, EN DEUX GESTES
   ============================================================

   IL Y AVAIT DEUX PORTES POUR UN SEUL OBJET, ET C'ÉTAIT TOUT LE
   PROBLÈME. Un défi par liste naissait d'un formulaire ENFOUI sous
   l'accordéon d'une liste — six champs à plat, qu'il fallait déplier une
   liste pour trouver ; un défi par critère naissait d'un SECOND
   formulaire, posé tout en bas de la page, avec ses propres champs et sa
   propre disposition. Deux écrans, deux dispositions, un objet. On ne
   pouvait pas comparer les deux natures avant de choisir, puisqu'elles
   ne se montraient jamais ensemble.

   UNE PORTE, DEUX PAS : ce qu'on défie, puis combien et jusqu'à quand.
   L'ordre n'est pas décoratif — la seconde question dépend de la
   première (sans liste, la cible est OBLIGATOIRE, et le schéma le tient)
   alors que l'inverse est faux.

   LE TITRE EST DEVENU FACULTATIF, et c'est le champ qui barrait la
   route : il était le premier, il était vide, et le serveur exige 1 à
   120 signes. On en propose donc un depuis le sujet — « Les années 60 en
   mars » — et il reste modifiable. Le client envoie toujours quelque
   chose ; la validation du serveur ne bouge pas d'une ligne.

   RIEN NE CHANGE AU SERVEUR, d'ailleurs. Toutes les règles de
   `POST /challenges` tiennent, y compris celle qui refuse un défi par
   critère sans cible : l'assistant la rend simplement impossible à
   oublier, au lieu de la faire découvrir par un refus.
   ============================================================ */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Plus, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked, tap, underlineInput } from "../../theme/styles";
import { Guideline, Label, Trouble } from "../../components/ui";
import { Layer } from "../../components/ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { Fan } from "./Fan";
import { createChallenge, type List } from "../../services/server";
import { WARMUPS, currentMonth } from "./shared";

/** Les trois formes d'un défi par critère. Les clés sont celles que le
    serveur attend.

    TROIS ET PAS UNE DE PLUS : ce sont les trois choses qu'une fiche
    complétée par TMDB porte TOUJOURS. Un quatrième critère se répondrait
    « ça dépend si la fiche est remplie », et on perdrait un défi pour
    n'avoir pas fait ses imports. */
const FORMS = ["decade", "country", "director"] as const;
type Form = (typeof FORMS)[number];

/** Ce sur quoi le défi porte : une liste, ou un critère. */
type Source = { kind: "list"; list: List } | { kind: "criterion" };

export function NewChallenge({
  lists,
  onDone,
  onClose,
}: {
  lists: List[];
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const box = useDialog(onClose, { autoFocus: false });

  const [source, setSource] = useState<Source | null>(null);
  const [form, setForm] = useState<Form>("decade");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [start, setStart] = useState(currentMonth().start);
  const [end, setEnd] = useState(currentMonth().end);
  /* « VOIR » ou « VOIR ET ÉCRIRE ». Sans liste, la question ne se pose
     pas : le serveur n'a qu'une façon de compter un défi par critère. */
  const [review, setReview] = useState(false);
  /* LA COURSE. Une nature change ce qui COMPTE, jamais ce que ça paie —
     même barème, même règlement, et pas une ligne de plus dans
     `points.ts`. Elle vaut pour les deux sources : on peut courir sur
     une liste comme sur un critère, ce qui est la raison pour laquelle
     le serveur en fait une COLONNE et non une quatrième nature. */
  const [race, setRace] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* CELLES OÙ L'ON PEUT ÉCRIRE, ET RIEN D'AUTRE. Lancer un défi sur la
     liste d'un autre la lui ferait voir paraître sans l'avoir voulu —
     c'est le droit que le serveur demande, et l'écran ne propose donc
     pas ce qu'il refuserait. */
  const mine = useMemo(() => lists.filter((l) => l.mienne || l.isMember), [lists]);

  /* LE TITRE PROPOSÉ, JAMAIS IMPOSÉ. Il se recalcule tant qu'on n'a rien
     tapé : choisir une autre liste après avoir vu le titre d'une
     première ne doit pas laisser l'ancien nom derrière. */
  const suggestion =
    source?.kind === "list"
      ? source.list.title
      : value.trim()
        ? t(`listsView.criterionSays.${form}`, {
            n: value.trim(),
            code: value.trim(),
            name: value.trim(),
          })
        : "";

  const run = async () => {
    const said = value.trim();
    const name = (title.trim() || suggestion).slice(0, 120);
    if (!source || !name) return;
    if (source.kind === "criterion" && (!said || !target.trim())) return;
    setTrouble(null);
    setBusy(true);
    try {
      if (source.kind === "list") {
        await createChallenge({
          listId: source.list.id,
          title: name,
          starts_on: start,
          ends_on: end,
          /* Vide veut dire « toute la liste », et c'est le défaut. Une
             chaîne et non un nombre : le champ doit pouvoir être vidé,
             et `0` n'est pas « rien ». */
          target: target.trim() ? Number(target) : null,
          kind: review ? "critique" : "liste",
          mode: race ? "course" : "ensemble",
        });
      } else {
        /* La décennie part en NOMBRE et les deux autres en texte : c'est
           ce que le serveur distingue pour choisir la question, et lui
           envoyer « 1960 » entre guillemets en ferait un pays
           illisible. */
        await createChallenge({
          listId: null,
          title: name,
          starts_on: start,
          ends_on: end,
          target: Number(target),
          kind: "critere",
          mode: race ? "course" : "ensemble",
          subject:
            form === "decade"
              ? { decade: Number(said) }
              : form === "country"
                ? { country: said }
                : { director: said },
        });
      }
      await onDone();
      onClose();
    } catch (e) {
      /* Le serveur dit CE QU'IL REFUSE en toutes lettres — « une décennie
         s'écrit 1960 », « un pays s'écrit en deux lettres » — et on le
         répète tel quel plutôt que de deviner une phrase à nous, qui
         finirait par contredire la sienne. */
      setTrouble((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layer>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: alpha(C.ink, 0.4),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={t("listsView.newChallenge")}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: "0 10px 40px rgba(20,14,8,0.4)",
            width: "min(760px, 100%)",
            maxHeight: "92vh",
            overflowY: "auto",
            padding: "22px 24px 28px",
            animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            {/* REVENIR AU PREMIER PAS, plutôt que fermer et recommencer :
                c'est le seul geste que deux pas rendent nécessaire. */}
            {source && (
              <button
                onClick={() => setSource(null)}
                aria-label={t("common.back")}
                style={{ ...bare, color: C.inkFaded }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <span
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 24,
                color: C.ink,
              }}
            >
              {t("listsView.newChallenge")}
            </span>
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginLeft: "auto",
                display: "flex",
              }}
            >
              <X size={16} color={C.inkFaded} />
            </button>
          </div>

          {/* ==================================================
              PREMIER PAS — CE QU'ON DÉFIE
              ================================================== */}
          {!source && (
            <div style={{ marginTop: 14 }}>
              <Label>{t("listsView.stepWhat")}</Label>

              {mine.length === 0 ? (
                <Guideline tight>{t("listsView.noWritableList")}</Guideline>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  {mine.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSource({ kind: "list", list: l })}
                      style={{
                        all: "unset",
                        ...tap,
                        cursor: "pointer",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: 9,
                        border: `1px solid ${C.line}`,
                        background: C.paper,
                      }}
                    >
                      {/* LE MÊME ÉVENTAIL QUE SUR LE MUR, et non une
                          vignette à part : on choisit ici la liste qu'on
                          vient de reconnaître là-bas, et deux
                          représentations d'un même objet obligent à le
                          reconnaître deux fois. */}
                      <Fan posters={l.posters ?? []} seed={l.id} height={58} />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontFamily: F.title,
                            fontStyle: "italic",
                            fontSize: 16,
                            color: C.ink,
                          }}
                        >
                          {l.title}
                        </span>
                        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                          {t("listsView.worksCount", { count: l.works })}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${C.line}` }}>
                <button
                  onClick={() => setSource({ kind: "criterion" })}
                  style={{ ...inked(C.plum), ...hollow }}
                >
                  <Plus size={12} /> {t("listsView.criterionNew")}
                </button>
                <Guideline tight>{t("listsView.criterionNote")}</Guideline>
              </div>
            </div>
          )}

          {/* ==================================================
              SECOND PAS — COMBIEN, JUSQU'À QUAND
              ================================================== */}
          {source && (
            <div style={{ marginTop: 14 }}>
              {source.kind === "criterion" && (
                <div style={{ marginBottom: 16 }}>
                  <Label>{t("listsView.criterionNew")}</Label>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {FORMS.map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setForm(f);
                          setValue("");
                        }}
                        aria-pressed={form === f}
                        style={form === f ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
                      >
                        {t(`listsView.criterion.${f}`)}
                      </button>
                    ))}
                  </div>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t(`listsView.criterionHint.${form}`)}
                    aria-label={t(`listsView.criterion.${form}`)}
                    style={{
                      ...underlineInput,
                      fontFamily: F.hand,
                      fontSize: 17,
                      marginTop: 8,
                      maxWidth: 300,
                    }}
                  />
                </div>
              )}

              <Label>{t("listsView.stepHowMuch")}</Label>
              {/* LES MISES EN TRAIN RÉPONDENT AUX TROIS QUESTIONS D'UN
                  COUP. Elles n'enferment rien : les champs dessous
                  restent ce qu'ils étaient, et se corrigent. */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WARMUPS.filter((w) => !w.needsList || source.kind === "list").map((w) => (
                  <button
                    key={w.key}
                    onClick={() => {
                      const p = w.period();
                      setTarget(w.target == null ? "" : String(w.target));
                      setStart(p.start);
                      setEnd(p.end);
                    }}
                    style={{ ...inked(C.pine), ...hollow }}
                  >
                    {t(`listsView.warmup.${w.key}`)}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  marginTop: 14,
                }}
              >
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={
                    source.kind === "list"
                      ? t("listsView.targetPlaceholder")
                      : t("listsView.criterionTargetPlaceholder")
                  }
                  aria-label={t("listsView.targetLabel")}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12, width: 90 }}
                />
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-label={t("listsView.startsOn")}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 132 }}
                />
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-label={t("listsView.endsOn")}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 132 }}
                />
              </div>

              {/* LA NATURE N'EST PLUS DEUX BOUTONS ANONYMES. « VOIR » et
                  « VOIR ET ÉCRIRE » ne disaient pas ce qu'ils
                  changeaient ; la phrase, elle, le dit. Elle ne paraît
                  pas sans liste : le serveur n'a qu'une façon de compter
                  un défi par critère. */}
              {source.kind === "list" && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 7,
                    marginTop: 14,
                    fontFamily: F.hand,
                    fontSize: 16,
                    color: C.ink,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={review}
                    onChange={(e) => setReview(e.target.checked)}
                  />
                  <span>
                    {t("listsView.alsoReview")}
                    {review && (
                      <span
                        style={{
                          display: "block",
                          fontSize: 15,
                          color: C.inkFaded,
                          marginTop: 3,
                        }}
                      >
                        {t("listsView.kindNote")}
                      </span>
                    )}
                  </span>
                </label>
              )}

              {/* LA COURSE — offerte aux DEUX sources, contrairement à
                  la critique : le serveur n'a qu'une façon de compter un
                  défi par critère, mais il sait très bien qui a vu un
                  film le premier. */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 7,
                  marginTop: 10,
                  fontFamily: F.hand,
                  fontSize: 16,
                  color: C.ink,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={race} onChange={(e) => setRace(e.target.checked)} />
                <span>
                  {t("listsView.race")}
                  {race && (
                    <span
                      style={{ display: "block", fontSize: 15, color: C.inkFaded, marginTop: 3 }}
                    >
                      {t("listsView.raceNote")}
                    </span>
                  )}
                </span>
              </label>

              <div style={{ marginTop: 16 }}>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={suggestion || t("listsView.challengePlaceholder")}
                  aria-label={t("listsView.challengeTitleLabel")}
                  style={{
                    ...underlineInput,
                    fontFamily: F.hand,
                    fontSize: 18,
                    width: "100%",
                    maxWidth: 420,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
                <button onClick={run} disabled={busy} style={inked(C.burgundy)}>
                  {t("listsView.launch")}
                </button>
                {source.kind === "criterion" && (
                  <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
                    {t("listsView.criterionTargetNote")}
                  </span>
                )}
              </div>
            </div>
          )}

          <Trouble>{trouble}</Trouble>
        </div>
      </div>
    </Layer>
  );
}
