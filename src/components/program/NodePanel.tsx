/* ============================================================
   WHAT A FILM-MAKER SAYS WHEN YOU CLICK THEM
   ============================================================

   THIS PANEL EXISTS FOR THE HOLLOW NODE. A director tied to somebody
   but with no film in the run has nothing to light up in the column, and
   a click that lights nothing reads as a click that failed. So the
   screen says it in words — "six films in the binder, none in the run" —
   and offers the films themselves. That sentence is the bridge between
   the two scales this view holds.

   AN ORPHAN GETS NO LIST, because there is nothing to list: no card
   carries the name any more. It gets what is still true — the bond, and
   the way out to the Credits.

   `pageOf` DOES THE COUNTING, and it is already written and tested
   (`domain/people`). Sweeping the collection again here would be a
   second census drifting from the first.

   AND IT IS WHERE A FILIATION IS OFFERED. Clicking a film-maker is
   already asking "what do we know about them", so this is where "we know
   somebody taught them" belongs. THREE STATES AND NEVER TWO: `Waiting`
   while we ask, `Nothing` when Wikidata knows nothing of them, `Trouble`
   when we could not ask at all — the last two are not the same screen,
   and an empty list would have said so.

   THE ORPHAN GAINS THE MOST. It is the node with the least to say, and
   the one most likely to be somebody's master with no card of their own
   in the collection. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, inked, hollow } from "../../theme/styles";
import { Label, Nothing, Trouble, Waiting } from "../ui";
import { bondLabel, makeBond } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import { hintsTouching, usefulHints } from "../../domain/hints";
import { hintSays } from "./hintSays";
import type { Hint } from "../../domain/hints";
import { useLineageHints } from "../../hooks/useLineageHints";
import { useTmdbKey } from "../../services/tmdbKey";
import { pageOf } from "../../domain/people";
import type { LineageNode } from "../../domain/lineageMap";
import type { Film } from "../../types";

interface NodePanelProps {
  node: LineageNode;
  films: Film[];
  bonds: Bond[];
  /** Les films de cette personne DÉJÀ au programme, par identifiant. */
  inCourse: Set<string>;
  onAdd: (filmId: string) => void;
  onAddAll: (filmIds: string[]) => void;
  onOpenPerson: (key: string) => void;
  onPickBond: (bondId: string) => void;
  onAddBond: (name: string, hint?: Hint) => void;
  onClose: () => void;
}

export function NodePanel({
  node,
  films,
  bonds,
  inCourse,
  onAdd,
  onAddAll,
  onOpenPerson,
  onPickBond,
  onAddBond,
  onClose,
}: NodePanelProps) {
  const { t } = useTranslation();
  const person = node.orphan ? null : pageOf(films, node.key);
  const theirs = (person?.films || []).filter((id) => !inCourse.has(id));
  const mine = bonds.filter((b) => b.from === node.key || b.to === node.key);

  /* LES PISTES SE DEMANDENT SUR LE NOM et se gardent une semaine : c'est
     le service qui s'en souvient, pas ce panneau. */
  const apiKey = useTmdbKey();
  const { hints, waiting, trouble, retry } = useLineageHints([node.name], apiKey, films);
  /* LE FILTRE EST CELUI DU FORMULAIRE, joué en avance : offrir un clic
     auquel le formulaire répondrait par un refus est le défaut exact que
     les motifs ont mis un chantier à perdre. Et on ne garde que ce qui
     touche CETTE personne — Wikidata rend aussi les liens de ses
     voisins. */
  const leads = useMemo(
    () => hintsTouching(usefulHints(hints, bonds), node.key),
    [hints, bonds, node.key]
  );

  /* Sur quoi la piste se fonde. Deux formes seulement, et chacune est
     une DONNÉE mise en mots ici : la note part sur le disque et se
     synchronise. */
  /* Le libellé se lit DEPUIS cette personne, comme un lien posé : le
     `Bond` que la piste deviendrait est justement ce que `bondLabel`
     sait mettre en mots, donc rien n'est réécrit ici. */
  const leadLabel = (hint: Hint): string => {
    const bond = makeBond({ kind: hint.kind, fromName: hint.fromName, toName: hint.toName });
    return bond ? bondLabel(bond, node.key, t) : "";
  };

  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${C.line}`,
        background: C.card,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: F.title, fontSize: 19, color: C.ink, flex: 1 }}>{node.name}</div>
        <button onClick={onClose} style={{ ...bare, fontFamily: F.mono, fontSize: 9.5 }}>
          {t("program.close")}
        </button>
      </div>

      {node.orphan ? (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {t("program.orphan")}
        </div>
      ) : (
        node.inCourse === 0 && (
          <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 6 }}>
            {t("program.notInQueue", { count: node.owned })}
          </div>
        )
      )}

      {mine.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Label>{t("program.map")}</Label>
          <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
            {mine.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => onPickBond(b.id)}
                  style={{
                    ...bare,
                    fontFamily: F.body,
                    fontSize: 13.5,
                    color: C.ink,
                    textAlign: "left",
                  }}
                >
                  {bondLabel(b, node.key, t)}
                  {b.note && (
                    <span style={{ color: alpha(C.ink, 0.55), fontFamily: F.hand, fontSize: 15 }}>
                      {" "}
                      {b.note}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {theirs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {theirs.slice(0, 8).map((id) => {
              const film = films.find((f) => f.id === id);
              if (!film) return null;
              return (
                <li key={id}>
                  <button
                    onClick={() => onAdd(id)}
                    style={{
                      ...bare,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: C.ink,
                      fontFamily: F.body,
                      fontSize: 13.5,
                      padding: "3px 0",
                    }}
                  >
                    <Plus size={11} color={C.inkFaded} />
                    {film.title}
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => onAddAll(theirs)} style={{ ...inked(C.plum), marginTop: 8 }}>
            {t("program.addTheirFilms")}
          </button>
        </div>
      )}

      {/* PLUS DE GARDE SUR LA CLÉ : la moitié « classeur » ne demande
          rien à personne et répond hors ligne. Seule l'attente et
          l'échec du réseau sont conditionnés. */}
      <div style={{ marginTop: 12 }} data-tour="program-hints">
        <Label>{t("program.hints")}</Label>
        {apiKey && waiting && <Waiting lines={2} label={t("program.hintsWaiting")} />}
        {apiKey && trouble && (
          <Trouble onRetry={retry} retryLabel={t("program.hintsAgain")}>
            {t("program.hintsTrouble")}
          </Trouble>
        )}
        {leads.length === 0 && !waiting && <Nothing what={t("program.hintsNone")} />}
        {leads.length > 0 && (
          <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
            {leads.map((hint) => (
              <li key={`${hint.kind}:${hint.fromName}>${hint.toName}`}>
                <button
                  onClick={() => onAddBond(node.name, hint)}
                  style={{
                    ...bare,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    textAlign: "left",
                    color: C.ink,
                    fontFamily: F.body,
                    fontSize: 13.5,
                    padding: "3px 0",
                  }}
                >
                  <Sparkles size={11} color={C.inkFaded} />
                  <span>
                    {leadLabel(hint)}
                    {/* SUR QUOI ELLE SE FONDE, ET C'EST CE QUI DÉCIDE si
                        on la croit : « d'après Wikidata » et « chef
                        opérateur sur trois de ses films » ne s'accueillent
                        pas de la même façon. */}
                    <span style={{ color: alpha(C.ink, 0.55), fontSize: 12 }}>
                      {" "}
                      {hintSays(hint, t)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={() => onAddBond(node.name)} style={{ ...inked(C.ink), ...hollow }}>
          {t("program.linkThisDirector")}
        </button>
        {!node.orphan && (
          <button onClick={() => onOpenPerson(node.key)} style={{ ...inked(C.ink), ...hollow }}>
            {t("program.openPerson")}
          </button>
        )}
      </div>
    </div>
  );
}
