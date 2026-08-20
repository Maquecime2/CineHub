/* ============================================================
   LE TABLEAU DES DÉFIS
   ============================================================

   SORTI DE `ListsView`, où il partageait mille lignes avec les listes.
   Une liste est un savoir, permanent, écrit à plusieurs ; un défi est
   une intention, qui se solde. Les lire dans la même colonne, l'un sous
   l'autre, est ce qui rendait l'écran illisible.

   LA CARTE EST UN RÉSUMÉ, ET RIEN DE PLUS. Elle tenait tout — les barres
   de chacun, le champ pour défier quelqu'un, l'achat d'un pouvoir, la
   prolongation, le second souffle, la suppression — soit sept commandes
   sur un carton de trois lignes, pour un objet qu'on consulte bien plus
   souvent qu'on ne le manipule. Tout cela est passé dans
   `ChallengeLayer`, qui est aussi le seul endroit où le TABLEAU DE
   MARQUE tient.

   CE QUI RESTE EST CE QU'ON LIT DE LOIN : l'état, le titre, la période,
   d'où ça sort, et où l'on en est SOI. Le reste s'ouvre.
   ============================================================ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { hollow, inked, tap } from "../../theme/styles";
import { Guideline, Label, Meter, Waiting } from "../../components/ui";
import { useSay } from "../../components/ui/Feedback";
import { StampCorner, TapeResidue } from "../../components/atmosphere";
import { Halftone } from "../../components/atmosphere/hall";
import { needsSettling, stateOf } from "../../domain/challenges";
import { tiltOf } from "../../domain/seeded";
import { refreshPurse } from "../../hooks/usePurse";
import { NewChallenge } from "./NewChallenge";
import { ChallengeLayer } from "./ChallengeLayer";
import { Fan } from "./Fan";
import {
  joinChallenge,
  leaveChallenge,
  readChallenge,
  settleChallenge,
  type Challenge,
  type List,
} from "../../services/server";
import type { Film } from "../../types";

/* CE QUE LE CRITÈRE DEMANDE, EN TOUTES LETTRES. Un défi qui dirait
   seulement « par critère » obligerait à l'ouvrir pour savoir ce qu'il
   demande, alors que c'est la seule chose qui le distingue des autres.
   Le `subject` vient du serveur et ne porte qu'une des trois clés. */
function sayCriterion(
  t: (k: string, o?: Record<string, unknown>) => string,
  subject: Challenge["subject"]
): string {
  if (subject?.decade != null) return t("listsView.criterionSays.decade", { n: subject.decade });
  if (subject?.country) return t("listsView.criterionSays.country", { code: subject.country });
  if (subject?.director) return t("listsView.criterionSays.director", { name: subject.director });
  return t("listsView.criterionSays.unknown");
}

/* L'AFFICHE DIT SON ÉTAT AVANT DE DIRE SON TITRE. Un défi qui finit
   demain et un défi qui finit dans trois semaines ne se signalent pas de
   la même façon sur un panneau, et c'est la seule information qu'on lit
   de loin. */
const BANNER: Record<string, { key: string; ink: string }> = {
  upcoming: { key: "listsView.upcoming", ink: C.slate },
  running: { key: "listsView.running", ink: C.pine },
  "last-days": { key: "listsView.lastDays", ink: C.vermillion },
  finished: { key: "listsView.finished", ink: C.inkFaded },
};

/* ------------------------------------------------------------
   UNE CARTE
   ------------------------------------------------------------ */

function OneChallenge({
  challenge,
  posters,
  me,
  onChange,
  onOpen,
}: {
  challenge: Challenge;
  /* LES AFFICHES DE LA LISTE SUR LAQUELLE IL EST BÂTI. Le défi ne les
     porte pas — c'est la LISTE qui les tient, et le tableau a déjà les
     listes sous la main. Un défi par critère n'a pas de liste, donc pas
     d'éventail : sa question n'est pas un ensemble de films. */
  posters: string[];
  me: string | null;
  onChange: () => Promise<void>;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const say = useSay();
  const state = stateOf({ starts_on: challenge.starts_on, ends_on: challenge.ends_on });
  const banner = BANNER[state]!;

  /* LE `try` ENGLOBE L'APPEL et pas seulement sa promesse, et le message
     vient du CATALOGUE et non du `message` de l'erreur — celui-là vient
     du serveur, souvent en anglais et toujours technique. */
  const enrol = async () => {
    try {
      await (challenge.inside ? leaveChallenge(challenge.id) : joinChallenge(challenge.id));
      await onChange();
    } catch {
      say(t("listsView.enrolFailed"));
    }
  };

  /* SANS LISTE, LE BUT EST LA CIBLE — et rien d'autre. `works` vaut zéro
     pour un défi par critère, donc un `Math.min` rendrait un
     dénominateur de zéro : une barre sans bout et un défi impossible. */
  const goal =
    challenge.list_id == null
      ? (challenge.target ?? 0)
      : Math.min(challenge.target ?? challenge.works, challenge.works);

  /* OÙ J'EN SUIS, ET SEULEMENT MOI. Les barres de tout le monde tenaient
     ici, sur une carte qu'on lit en diagonale ; elles sont le RÉSUMÉ du
     tableau de marque, et elles y sont retournées.

     `null` N'EST PAS ZÉRO : une requête qui a échoué ne dit pas « rien
     vu », elle ne dit rien. La barre s'abstient plutôt que d'affirmer. */
  const [done, setDone] = useState<number | null>(null);

  /* SOLDER À L'OUVERTURE, ET SANS RIEN ATTENDRE. Le serveur n'a pas de
     tâche de fond : c'est le PREMIER qui regarde un défi fini qui en
     clôt les comptes pour tout le monde, et la clé du journal fait que
     les suivants ne paient personne deux fois. L'échec est avalé — un
     défi qui s'affiche vaut mieux qu'un défi qui refuse de s'afficher
     parce que le compteur boude.

     IL RESTE SUR LA CARTE ET NE SUIT PAS LE RESTE DANS LA COUCHE, et
     c'est délibéré : déplacé là-bas, il faudrait OUVRIR chaque défi fini
     pour que quiconque soit payé. */
  useEffect(() => {
    if (!needsSettling({ ends_on: challenge.ends_on })) return;
    settleChallenge(challenge.id)
      .then((r) => {
        if (r.awarded > 0) void refreshPurse();
      })
      .catch(() => {});
  }, [challenge.id, challenge.ends_on]);

  useEffect(() => {
    let alive = true;
    readChallenge(challenge.id)
      .then((r) => {
        if (alive) setDone(r.progress.find((p) => p.pseudo === me)?.done ?? 0);
      })
      .catch(() => {
        if (alive) setDone(null);
      });
    return () => {
      alive = false;
    };
  }, [challenge.id, me]);

  return (
    <div
      data-print-block
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 3px 9px rgba(30,20,10,0.16)",
        transform: `rotate(${Number(tiltOf(challenge.id)) / 8}deg)`,
        /* Le liseré rouge des derniers jours : une bordure et non une
           couleur de fond, pour que le texte reste sur du papier. */
        outline: state === "last-days" ? `2px dashed ${alpha(C.vermillion, 0.6)}` : undefined,
        outlineOffset: 2,
      }}
    >
      <Halftone size={5} />
      <TapeResidue style={{ top: -8, left: 18 }} rotate={-14} w={64} />
      {/* Le rabat « soldé », en travers, une fois les comptes clos. */}
      {state === "finished" && <StampCorner text={t("listsView.settled")} />}

      {/* TOUTE LA CARTE OUVRE LE TABLEAU. Un bouton « voir » posé dans un
          coin aurait laissé le reste inerte, alors que c'est le geste
          qu'on fait neuf fois sur dix devant un défi. */}
      <button
        onClick={onOpen}
        aria-label={t("listsView.openChallenge", { title: challenge.title })}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          position: "relative",
          padding: "11px 13px 4px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {/* LE MÊME ÉVENTAIL QUE SUR LE MUR ET DANS L'ASSISTANT. Une
              carte de défi n'annonçait que le TITRE de sa liste : on
              lisait « sur la liste Mars » sans reconnaître ce qu'il y
              avait dedans, alors qu'on venait de la choisir sur une
              image. */}
          {challenge.list_id != null && (
            <Fan posters={posters} seed={challenge.list_id} height={54} />
          )}
          <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 9,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: C.card,
                background: banner.ink,
                padding: "3px 7px",
              }}
            >
              {t(banner.key)}
            </span>
            <span style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 20, color: C.ink }}>
              {challenge.title}
            </span>
            {/* LA COURSE SE DIT SUR LA CARTE, parce qu'elle change ce qui
              COMPTE : un film pris par quelqu'un d'autre ne compte plus.
              L'apprendre en ouvrant le tableau serait l'apprendre trop
              tard. `=== "course"` et non `!== "ensemble"` — un serveur
              qui ne connaît pas le champ ne fait pas courir tout le
              monde. */}
            {challenge.mode === "course" && (
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 8.5,
                  letterSpacing: 1.4,
                  color: C.plum,
                  border: `1px solid ${C.plum}`,
                  padding: "2px 5px",
                }}
              >
                {t("listsView.racing")}
              </span>
            )}
          </span>
        </span>
        <span
          style={{
            display: "block",
            fontFamily: F.mono,
            fontSize: 10,
            color: C.inkFaded,
            marginTop: 4,
          }}
        >
          {challenge.starts_on} → {challenge.ends_on} ·{" "}
          {challenge.list_id == null
            ? t("listsView.criterionTarget", { count: goal })
            : challenge.target == null
              ? t("listsView.works", { count: challenge.works })
              : t("listsView.outOfList", { target: goal, works: challenge.works })}{" "}
          ·{" "}
          {challenge.list_id == null
            ? t("listsView.fromCriterion", { what: sayCriterion(t, challenge.subject) })
            : t("listsView.fromList", { title: challenge.list })}
        </span>
      </button>

      {/* OÙ J'EN SUIS — une seule barre, et seulement si j'y suis. */}
      {challenge.inside && done != null && (
        <div style={{ position: "relative", padding: "0 13px" }}>
          <Meter
            name={t("listsView.you")}
            done={done}
            total={goal}
            ink={state === "finished" ? C.moss : C.burgundy}
          />
        </div>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 8,
          padding: "6px 13px 11px",
          alignItems: "center",
        }}
      >
        {/* UNE ANNONCE ET NON UN PANNEAU : c'est une LIGNE d'un tableau
            de défis, et y insérer un `Trouble` déplacerait toutes les
            suivantes à chaque échec réseau. Le geste est réversible et
            il n'y a pas de saisie à perdre — c'est exactement « dire ce
            qui vient de se passer ». */}
        <button onClick={() => void enrol()} style={inked(challenge.inside ? C.slate : C.pine)}>
          {challenge.inside ? t("listsView.leave") : t("listsView.join")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   LE TABLEAU
   ------------------------------------------------------------ */

export function Board({
  challenges,
  lists,
  films,
  me,
  settled,
  onChange,
}: {
  challenges: Challenge[];
  /* CE SUR QUOI ON PEUT DÉFIER. Le tableau ne s'en sert pas pour
     s'afficher : il les passe à l'assistant, qui est la SEULE porte vers
     un défi neuf depuis que les deux anciennes ont fermé. */
  lists: List[];
  /** Le classeur, pour donner un visage aux films d'un défi par critère
      — le serveur n'en rend que les identifiants. */
  films: Film[];
  me: string | null;
  settled: boolean;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);

  /* RELU DANS LA LISTE FRAÎCHE, comme la liste ouverte du mur : un défi
     supprimé depuis sa propre couche ne doit pas laisser la couche
     devant quelque chose que le serveur ne connaît plus. */
  const open = challenges.find((d) => d.id === opened) ?? null;

  return (
    <div data-tour="lists-challenges">
      <Label>{t("listsView.challenges")}</Label>
      {!settled && <Waiting lines={2} label={t("listsView.loading")} />}
      {settled && challenges.length === 0 && (
        <Guideline tight>{t("listsView.noChallenges")}</Guideline>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {challenges.map((d) => (
          <OneChallenge
            key={d.id}
            challenge={d}
            posters={lists.find((l) => l.id === d.list_id)?.posters ?? []}
            me={me}
            onChange={onChange}
            onOpen={() => setOpened(d.id)}
          />
        ))}
      </div>

      {/* UNE SEULE PORTE, ET ELLE EST ICI. Un défi par liste naissait
          d'un formulaire enfoui sous l'accordéon d'une liste, un défi par
          critère d'un second formulaire posé sous celui-ci : deux écrans
          pour un objet, jamais montrés ensemble. */}
      <button
        onClick={() => setOpening(true)}
        style={{ ...inked(C.burgundy), ...hollow, marginTop: 12 }}
        data-tour="lists-challenge-new"
      >
        <Plus size={12} /> {t("listsView.newChallenge")}
      </button>

      {opening && (
        <NewChallenge lists={lists} onDone={onChange} onClose={() => setOpening(false)} />
      )}

      {open && (
        <ChallengeLayer
          challenge={open}
          films={films}
          me={me}
          onChange={onChange}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
