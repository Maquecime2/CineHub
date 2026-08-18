/* ============================================================
   UN DÉFI OUVERT — LE TABLEAU DE MARQUE
   ============================================================

   UN DÉFI ÉTAIT UNE BARRE, et c'est la raison pour laquelle il n'était
   pas amusant. On lisait « 3 sur 8 » sous un titre, et rien d'autre : ni
   LESQUELS trois, ni ce qu'il restait, ni ce que les autres avaient
   coché. Le progrès n'était jamais une IMAGE, dans un produit qui ne
   parle que de films et qui vient d'apprendre à montrer leurs affiches.

   ICI, CE QUI EST FAIT EST TAMPONNÉ. Chaque œuvre en jeu est une
   affiche ; celles qu'on a vues dans la période portent un `Stamp`, et
   les autres attendent. On voit d'un coup d'œil où on en est, ce qui est
   très exactement ce qu'une barre ne dit pas.

   LE TAMPON DIT UN MOT, JAMAIS UNE COULEUR. Vert pour fait et gris pour
   pas fait disparaît sous cinq des dix-sept peaux — c'est la règle du
   verdict du quizz, et elle vaut ici pour la même raison.

   LA BARRE N'A PAS DISPARU, ELLE A CHANGÉ DE PLACE. Elle reste le
   RÉSUMÉ, sous la grille : c'est elle qui dit où en sont les AUTRES, et
   c'est elle qui compte les points. Ce que la grille montre et ce que la
   barre annonce sont les mêmes films — `Progress.ticked` tient les
   identifiants de ce que `done` compte, calculés par la même expression
   SQL, parce qu'une grille qui montrerait quatre tampons sous une barre
   qui en annonce cinq mentirait sur celle qui PAIE.

   UN DÉFI PAR CRITÈRE N'A PAS DE GRILLE DE DÉPART. Il ne porte pas de
   liste, donc `works` est vide : sa grille est ce qui a DÉJÀ été coché,
   plus des emplacements vides jusqu'à la cible. C'est le même écran, et
   il se REMPLIT au lieu de se cocher.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, UserPlus, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, inked, tap, underlineInput } from "../../theme/styles";
import { Guideline, Label, Meter, Trouble, Waiting } from "../../components/ui";
import { Layer } from "../../components/ui/Layer";
import { Confirmation, type ConfirmRequest } from "../../components/ui/Confirmation";
import { Stamp } from "../../components/atmosphere/hall";
import { useDialog } from "../../hooks/useDialog";
import { useSay } from "../../components/ui/Feedback";
import { daysLeft, mayExtend, stateOf } from "../../domain/challenges";
import { worthOfChallenge } from "../../domain/points";
import { tiltOf } from "../../domain/seeded";
import { useShop } from "../../hooks/useShop";
import { BuyChip } from "../../components/play/Buy";
import { posterUrl } from "../../tmdb";
import {
  deleteChallenge,
  extendChallenge,
  inviteToChallenge,
  readChallenge,
  secondWind,
  type Challenge,
  type ListWork,
  type Progress,
} from "../../services/server";
import type { Film } from "../../types";

/** Une case du tableau : une œuvre, et qui l'a cochée. */
interface Cell {
  tmdbId: string;
  title: string;
  year: string | null;
  posterPath: string | null;
  /** Les pseudonymes qui ont coché celle-ci. */
  by: string[];
}

/* ------------------------------------------------------------
   UNE CASE
   ------------------------------------------------------------ */

function Slot({ cell, me }: { cell: Cell | null; me: string | null }) {
  const { t } = useTranslation();

  /* UN EMPLACEMENT VIDE N'EST PAS UNE ERREUR, c'est un défi par critère
     qui n'a pas encore trouvé son film. Il se dessine, parce que « il en
     reste quatre » se lit d'un coup d'œil sur quatre cases vides et
     jamais sur une soustraction. */
  if (!cell) {
    return (
      <div
        aria-hidden
        style={{
          aspectRatio: "2 / 3",
          border: `1px dashed ${C.line}`,
          background: `repeating-linear-gradient(-45deg, ${alpha(C.line, 0.35)} 0 5px, transparent 5px 10px)`,
        }}
      />
    );
  }

  const mine = me != null && cell.by.includes(me);
  const others = cell.by.filter((p) => p !== me);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <div
          style={{
            aspectRatio: "2 / 3",
            background: C.paperDark,
            border: `1px solid ${C.line}`,
            boxShadow: "1px 2px 6px rgba(30,20,10,0.16)",
            transform: `rotate(${Number(tiltOf(cell.tmdbId)) / 16}deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            /* CE QUI RESTE À FAIRE S'EFFACE UN PEU, ce qui est fait est
               franc. Une opacité n'est pas un verdict : elle ne porte
               aucun sens à elle seule, et c'est le tampon qui parle. */
            opacity: mine ? 1 : 0.72,
          }}
        >
          {cell.posterPath ? (
            <img
              src={posterUrl(cell.posterPath)}
              alt=""
              aria-hidden
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontSize: 13,
                color: C.inkFaded,
                padding: 8,
                textAlign: "center",
              }}
            >
              {cell.title}
            </span>
          )}
        </div>

        {/* LE TAMPON, ET UN MOT. Pas une pastille verte : cinq des
            dix-sept peaux la mangent. */}
        {mine && (
          <div style={{ position: "absolute", bottom: 6, left: 6 }}>
            <Stamp text={t("listsView.ticked")} ink={C.moss} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 5 }}>
        <div style={{ fontFamily: F.title, fontSize: 14, color: C.ink, lineHeight: 1.2 }}>
          {cell.title}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
          {cell.year || ""}
          {/* QUI D'AUTRE L'A VU — c'est ce qui fait d'un tableau de
              marque un tableau de marque, et non une liste de courses.
              Le journal de séances, lui, ne sort toujours pas : ni date,
              ni note, ni critique. */}
          {others.length > 0 && (
            <span style={{ color: C.pine }}>
              {cell.year ? " · " : ""}
              {t("listsView.alsoSeenBy", { who: others.join(", ") })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   LA COUCHE
   ------------------------------------------------------------ */

export function ChallengeLayer({
  challenge,
  films,
  me,
  onChange,
  onClose,
}: {
  challenge: Challenge;
  /** Le classeur, pour donner un visage aux films d'un défi par critère
      — le serveur n'en rend que les identifiants. */
  films: Film[];
  /** Mon pseudonyme, pour savoir quel tampon est le mien. */
  me: string | null;
  onChange: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const box = useDialog(onClose, { autoFocus: false });
  const say = useSay();
  const [works, setWorks] = useState<ListWork[]>([]);
  const [progress, setProgress] = useState<Progress[] | null>(null);
  const [ends, setEnds] = useState(challenge.ends_on);
  const [invite, setInvitee] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const state = stateOf({ starts_on: challenge.starts_on, ends_on: ends });
  const left = daysLeft({ ends_on: ends });
  /* SANS LISTE, LE BUT EST LA CIBLE — et rien d'autre. `works` vaut zéro
     pour un défi par critère, donc un `Math.min` rendrait un
     dénominateur de zéro : une barre sans bout, et un défi impossible. */
  const goal =
    challenge.list_id == null
      ? (challenge.target ?? 0)
      : Math.min(challenge.target ?? challenge.works, challenge.works);

  const reread = useCallback(async () => {
    const r = await readChallenge(challenge.id);
    setWorks(r.works);
    setProgress(r.progress);
  }, [challenge.id]);

  useEffect(() => {
    reread().catch(() => setProgress([]));
  }, [reread]);

  const mine = progress?.find((p) => p.pseudo === me);
  const done = mine?.done ?? 0;

  /* ------------------------------------------------------------
     LE TABLEAU, MONTÉ À PARTIR DE DEUX SOURCES
     ------------------------------------------------------------
     Un défi PAR LISTE part de ses œuvres : elles sont la question, et
     `ticked` dit lesquelles ont trouvé leur réponse. Un défi par
     CRITÈRE n'a pas d'œuvres du tout — sa grille EST ce qui a été
     coché, et le classeur local est le seul à savoir à quoi ressemble
     un film qu'on a chez soi. On complète alors jusqu'à la cible avec
     des emplacements vides, pour que « il en reste trois » se voie. */
  const cells = useMemo<(Cell | null)[]>(() => {
    const whoTicked = (id: string) =>
      (progress ?? []).filter((p) => (p.ticked ?? []).includes(id)).map((p) => p.pseudo);

    if (challenge.list_id != null) {
      return works.map((w) => ({
        tmdbId: w.tmdb_id,
        title: w.title || `TMDB ${w.tmdb_id}`,
        year: w.year,
        posterPath: w.poster_path,
        by: whoTicked(w.tmdb_id),
      }));
    }

    const ids = [...new Set((progress ?? []).flatMap((p) => p.ticked ?? []))];
    const found: (Cell | null)[] = ids.map((id) => {
      const f = films.find((x) => String(x.tmdbId) === id);
      return {
        tmdbId: id,
        title: f?.title || `TMDB ${id}`,
        year: f?.year != null ? String(f.year) : null,
        /* La fiche locale porte une URL COMPLÈTE et la grille attend un
           chemin : `posterUrl` recomposerait alors une adresse par-dessus
           une adresse. On rend donc le chemin nu quand on peut, et rien
           sinon — l'émulsion de remplacement s'en charge. */
        posterPath: null,
        by: whoTicked(id),
      };
    });
    while (found.length < goal) found.push(null);
    return found;
  }, [challenge.list_id, works, progress, films, goal]);

  const catalogue = useShop();
  const sold = catalogue.find((i) => i.power === "extend");
  const powerHeld = sold?.held ?? 0;
  const canExtend = mayExtend(
    { starts_on: challenge.starts_on, ends_on: ends, by: challenge.by },
    challenge.by ?? null
  );

  const summon = async () => {
    const name = invite.trim().toLowerCase();
    if (!name) return;
    setTrouble(null);
    try {
      await inviteToChallenge(challenge.id, name);
      setInvitee("");
      await reread();
    } catch {
      /* Le serveur répond la même chose pour « n'existe pas » et « vous
         vous êtes bloqués » : on reprend ce silence. */
      setTrouble(t("listsView.nobodyToInvite", { pseudo: name }));
    }
  };

  const push = async () => {
    try {
      const r = await extendChallenge(challenge.id);
      setEnds(r.ends_on);
      await onChange();
    } catch {
      /* Le serveur porte les cinq limites dans une seule instruction :
         s'il refuse, il a raison, et il a rendu le pouvoir. */
      await onChange();
    }
  };

  const blow = async () => {
    try {
      const again = await secondWind(challenge.id);
      setEnds(again.ends_on);
      await onChange();
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  const secondSold = catalogue.find((i) => i.power === "second-wind");

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
          aria-label={challenge.title}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: "0 10px 40px rgba(20,14,8,0.4)",
            width: "min(920px, 100%)",
            maxHeight: "92vh",
            overflowY: "auto",
            padding: "22px 24px 30px",
            animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 25,
                color: C.ink,
              }}
            >
              {challenge.title}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
              {challenge.starts_on} → {ends}
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

          {/* LE MOT DE LA FIN, TAMPONNÉ. Il vient du BARÈME et non d'un
              avis : `worthOfChallenge` sait déjà ce que la part vaut, et
              c'est ce qui a été payé. Un mot, jamais une couleur. */}
          {state === "finished" && goal > 0 && (
            <div style={{ marginTop: 12 }}>
              <Stamp
                text={t(
                  done >= goal
                    ? "listsView.verdict.held"
                    : done * 2 >= goal
                      ? "listsView.verdict.half"
                      : "listsView.verdict.missed"
                )}
                ink={done * 2 >= goal ? C.moss : C.burgundy}
              />
            </div>
          )}

          {/* CE QUE ÇA VAUT, DIT PENDANT QUE ÇA COURT. Un chiffre qui
              tombe à la fin sans avoir prévenu ne récompense rien. */}
          {state !== "upcoming" && challenge.inside && (
            <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 8 }}>
              {state === "finished"
                ? t("listsView.wasWorth", { points: worthOfChallenge(done, goal) })
                : t("listsView.worth", {
                    points: worthOfChallenge(done, goal),
                    count: Math.max(0, left),
                  })}
            </div>
          )}

          {/* ------------------------------------------------------
              LE TABLEAU
              ------------------------------------------------------ */}
          {progress === null ? (
            <Waiting lines={2} label={t("listsView.loading")} />
          ) : cells.length === 0 ? (
            <Guideline tight>{t("listsView.nothingToTick")}</Guideline>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 14,
                alignItems: "start",
                marginTop: 16,
              }}
            >
              {cells.map((c, i) => (
                <Slot key={c ? c.tmdbId : `empty-${i}`} cell={c} me={me} />
              ))}
            </div>
          )}

          {/* ------------------------------------------------------
              LE RÉSUMÉ — où en sont les autres
              ------------------------------------------------------
              La barre n'a pas disparu, elle est passée SOUS la grille :
              c'est elle qui compte les points, et elle seule sait dire
              où en est quelqu'un dont on ne voit pas le classeur. */}
          <div style={{ marginTop: 22 }}>
            <Label>{t("listsView.whereEverybodyStands")}</Label>
            {progress?.length === 0 && <Guideline tight>{t("listsView.noParticipants")}</Guideline>}
            {(progress ?? []).map((a) => (
              <Meter
                key={a.pseudo}
                name={a.pseudo}
                done={a.done}
                total={goal}
                ink={state === "finished" ? C.moss : C.burgundy}
              />
            ))}
          </div>

          {/* DÉFIER QUELQU'UN — et seulement pour qui a monté le défi. Un
              participant peut y entrer et en sortir ; il n'y engage
              personne d'autre. La route exige `administer`. */}
          {challenge.mine && state !== "finished" && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
                <input
                  value={invite}
                  onChange={(e) => setInvitee(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void summon();
                    }
                  }}
                  placeholder={t("listsView.challengeSomebody")}
                  aria-label={t("listsView.challengeSomebody")}
                  style={{ ...underlineInput, flex: "1 1 160px", width: "auto" }}
                />
                <button
                  onClick={() => void summon()}
                  disabled={!invite.trim()}
                  style={inked(C.pine)}
                >
                  <UserPlus size={12} />
                  {t("listsView.summon")}
                </button>
              </div>
            </div>
          )}

          {/* PROLONGER — le pouvoir s'achète ICI s'il manque. C'est le
              seul moment où on le veut : devant un défi qui finit demain
              et qu'on n'a pas bouclé. */}
          {canExtend && powerHeld === 0 && sold && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                {t("listsView.extend")}
              </span>
              <BuyChip item={sold.id} price={sold.price} onBought={reread} compact />
            </div>
          )}
          {canExtend && powerHeld > 0 && (
            <button
              onClick={() => void push()}
              data-tour="lists-extend"
              style={{
                ...bare,
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: C.ochre,
                marginTop: 14,
              }}
            >
              {t("listsView.extend")}
            </button>
          )}

          {/* LE SECOND SOUFFLE — ce qui rattrape un défi manqué. La
              prolongation ne couvre pas ce cas : elle est réservée à qui
              a CRÉÉ le défi, capée à deux, et s'arrête une semaine après
              la fin. */}
          {state === "finished" && secondSold && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
              {(secondSold.held ?? 0) > 0 ? (
                <button
                  onClick={() => void blow()}
                  data-tour="lists-second-wind"
                  style={{ ...bare, fontFamily: F.mono, fontSize: 10, color: C.pine }}
                >
                  {t("listsView.secondWind")}
                </button>
              ) : (
                <>
                  <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                    {t("listsView.secondWind")}
                  </span>
                  <BuyChip
                    item={secondSold.id}
                    price={secondSold.price}
                    onBought={reread}
                    compact
                  />
                </>
              )}
            </div>
          )}

          {challenge.mine && (
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px dashed ${C.line}` }}>
              <button
                onClick={() =>
                  setRequest({
                    title: t("listsView.confirmChallengeTitle"),
                    body: t("listsView.confirmChallengeBody", { title: challenge.title }),
                    action: t("common.delete"),
                    severe: true,
                    onConfirm: () =>
                      void deleteChallenge(challenge.id)
                        .then(onChange)
                        .then(() => {
                          say(t("listsView.challengeGone"));
                          onClose();
                        }),
                  })
                }
                title={t("listsView.deleteChallenge")}
                style={{ ...bare, color: C.burgundy }}
              >
                <Trash2 size={12} /> {t("listsView.deleteChallenge")}
              </button>
            </div>
          )}

          <Trouble>{trouble}</Trouble>
        </div>
      </div>
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </Layer>
  );
}
