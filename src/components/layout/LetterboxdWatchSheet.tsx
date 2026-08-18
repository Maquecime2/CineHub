/* ============================================================
   CE QUE LETTERBOXD A DE PLUS — la feuille
   ============================================================

   `Sheet`, donc `Layer`, donc rendue dans le corps du document, avec le
   focus qui entre, tourne et revient au bouton qui a ouvert. Centrée :
   c'est une modale, elle vit à 50 du budget de `z-index`.

   ON COCHE, ET CE QU'ON NE COCHE PAS EST ÉCARTÉ POUR DE BON. C'est la
   seule chose de cet écran qui demande à être comprise avant de cliquer,
   donc elle est écrite au-dessus des listes et non dans une aide. Sans
   cela, la même proposition reviendrait un quart d'heure plus tard et la
   seule façon de s'en défaire serait de l'accepter.

   TOUT EST COCHÉ D'ENTRÉE. On vient de nous dire « voilà six films que
   tu as vus » : le cas ordinaire est de tout prendre, et demander six
   clics pour le cas ordinaire ferait de la veille une corvée de plus.
   ============================================================ */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "../ui/Sheet";
import { Nothing, Trouble, Waiting } from "../ui";
import { C, F, alpha } from "../../theme/tokens";
import { filmKey } from "../../domain/importing";
import { countOf } from "../../domain/letterboxdWatch";
import type { Film, ImportDiff } from "../../types";

/** Une ligne de la feuille — une fiche à créer, ou une fiche à compléter. */
interface Line {
  key: string;
  film: Film;
  /** Ce qui changerait sur une fiche qu'on a déjà. Absent : elle naît. */
  changes?: Partial<Film>;
}

/* LES SÉANCES D'UN CÔTÉ, LES SOUHAITS DE L'AUTRE, et une section vide ne
   se dessine pas : le flux part à chaque passe et la watchlist une fois
   par jour, donc l'un des deux est vide la plupart du temps. Un titre
   suivi de rien ferait croire à une perte. */
const isWish = (film: Film): boolean => film.status === "watchlist";

function Row({ line, checked, onToggle }: { line: Line; checked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const seen = line.film.watches?.[0];
  return (
    <label
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        padding: "7px 2px",
        borderBottom: `1px solid ${alpha(C.line, 0.6)}`,
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{line.film.title}</span>
        {line.film.year ? (
          <span style={{ fontSize: 13, color: alpha(C.ink, 0.6) }}> ({line.film.year})</span>
        ) : null}
        {/* CE QUI CHANGERAIT SUR UNE FICHE QU'ON A DÉJÀ. Sans ce mot, une
            ligne « à mettre à jour » se lit comme un doublon qu'on
            s'apprête à créer. */}
        {line.changes ? (
          <span style={{ fontSize: 13, color: alpha(C.ink, 0.6) }}>
            {" — "}
            {t("letterboxdWatch.completes")}
          </span>
        ) : null}
      </span>
      {seen?.date ? (
        <span style={{ fontSize: 12, color: alpha(C.ink, 0.55), flexShrink: 0 }}>{seen.date}</span>
      ) : null}
      {seen?.rating != null ? (
        <span style={{ fontSize: 12, color: alpha(C.ink, 0.55), flexShrink: 0 }}>
          {seen.rating}/5
        </span>
      ) : null}
    </label>
  );
}

function Section({
  title,
  lines,
  chosen,
  onToggle,
}: {
  title: string;
  lines: Line[];
  chosen: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (!lines.length) return null;
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ fontFamily: F.hand, fontSize: 20, color: C.ink, margin: "0 0 4px" }}>{title}</h3>
      {lines.map((line) => (
        <Row
          key={line.key}
          line={line}
          checked={chosen.has(line.key)}
          onToggle={() => onToggle(line.key)}
        />
      ))}
    </section>
  );
}

export function LetterboxdWatchSheet({
  proposal,
  busy,
  filling,
  failed,
  onRefresh,
  onSettle,
  onClose,
}: {
  proposal: ImportDiff;
  busy: boolean;
  /** TMDB complète ce qu'on vient de cocher. `null` au repos. */
  filling: { done: number; total: number } | null;
  failed: boolean;
  onRefresh: () => void;
  /** Ce qui est coché part à l'écriture ; le reste est écarté. */
  onSettle: (chosen: Set<string>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const lines = useMemo<Line[]>(
    () => [
      ...proposal.toCreate.map((film) => ({ key: filmKey(film), film })),
      ...proposal.toUpdate.map(({ film, changes }) => ({ key: filmKey(film), film, changes })),
    ],
    [proposal]
  );

  /* L'ÉTAT PART DE LA PROPOSITION et se refait quand elle change : une
     relecture rend une autre liste, et garder les cases d'avant
     désignerait des films qui ne sont plus là. */
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(lines.map((l) => l.key)));
  const [seenKeys, setSeenKeys] = useState(() => lines.map((l) => l.key).join("|"));
  const nowKeys = lines.map((l) => l.key).join("|");
  if (nowKeys !== seenKeys) {
    setSeenKeys(nowKeys);
    setChosen(new Set(lines.map((l) => l.key)));
  }

  const toggle = (key: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const watched = lines.filter((l) => !isWish(l.film));
  const wishes = lines.filter((l) => isWish(l.film));

  return (
    <Sheet
      title={t("letterboxdWatch.title")}
      aside={countOf(proposal) ? t("letterboxdWatch.count", { count: countOf(proposal) }) : null}
      onClose={onClose}
      width={640}
    >
      {busy && <Waiting label={t("letterboxdWatch.reading")} />}

      {/* « ON N'A PAS PU DEMANDER » N'EST PAS « IL N'Y A RIEN ». La
          boucle de fond, elle, se tait — mais ici quelqu'un a ouvert, et
          confondre les deux écrans est le défaut qu'on a retiré de quatre
          vues. */}
      {failed && !busy && (
        <Trouble onRetry={onRefresh} retryLabel={t("letterboxdWatch.retry")}>
          {t("letterboxdWatch.trouble")}
        </Trouble>
      )}

      {!busy && !failed && !lines.length && <Nothing what={t("letterboxdWatch.nothing")} />}

      {lines.length > 0 && (
        <>
          <p
            style={{
              fontFamily: F.hand,
              fontSize: 18,
              lineHeight: 1.35,
              color: alpha(C.ink, 0.78),
              margin: "6px 0 0",
            }}
          >
            {t("letterboxdWatch.explain")}
          </p>

          <Section
            title={t("letterboxdWatch.watched")}
            lines={watched}
            chosen={chosen}
            onToggle={toggle}
          />
          <Section
            title={t("letterboxdWatch.wishes")}
            lines={wishes}
            chosen={chosen}
            onToggle={toggle}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {/* PENDANT QU'ON COMPLÈTE, LE BOUTON DIT OÙ ON EN EST.
                Valider demande à TMDB une fiche par film coché : sans
                ce compte, l'écran ne bouge pas pendant plusieurs
                secondes et le seul geste raisonnable est de recliquer —
                ce qui relancerait tout. */}
            <button
              onClick={() => onSettle(chosen)}
              disabled={!!filling}
              style={{
                all: "unset",
                cursor: filling ? "progress" : "pointer",
                padding: "8px 14px",
                borderRadius: 3,
                background: C.pine,
                color: C.paper,
                fontFamily: F.body,
                fontSize: 14,
              }}
            >
              {filling
                ? t("letterboxdWatch.filling", { done: filling.done, total: filling.total })
                : t("letterboxdWatch.keep", { count: chosen.size })}
            </button>
            <button
              onClick={onRefresh}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "8px 14px",
                borderRadius: 3,
                border: `1px solid ${C.line}`,
                fontFamily: F.body,
                fontSize: 14,
                color: C.inkFaded,
              }}
            >
              {t("letterboxdWatch.retry")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
