/* ============================================================
   LE BUREAU DE MODÉRATION — ce qui attend d'être regardé
   ============================================================

   Les signalements partaient dans une table que rien ne savait lire. Sur
   une adresse ouverte au public ce n'est pas un confort : un signalement
   qu'on ne peut pas lire vaut un signalement qu'on refuse, et c'est
   exactement ce qu'on promet de ne pas faire dans les conditions.

   AU COMPTOIR, PARCE QUE L'ADMINISTRATION Y VIT DÉJÀ. Le panier de
   questions du quizz et la reprise d'un article s'y trouvent, sous la
   même condition ; en faire une vue de plus aurait demandé une pastille,
   une entrée dans `TOURS` et une place dans la visite, pour un écran que
   deux personnes ouvrent.

   ELLE N'EXISTE PAS POUR LES AUTRES. `iAmAdmin` est une intuition lue
   sur le compte retenu, et elle ne donne rien : la route demande le
   rôle, et se tromper ici ne montre qu'un panneau qui répondra 403.

   ------------------------------------------------------------
   DEUX GESTES, ET UN TROISIÈME QU'ON NE MET PAS
   ------------------------------------------------------------

   « Classer » ferme la cible entière — en fermer une sur dix ferait
   revenir la même chose neuf fois. « Retirer du partage » est
   RÉVERSIBLE : c'est la colonne que l'auteur manipule lui-même, et rien
   n'est détruit.

   FERMER UN COMPTE N'EST PAS ICI, et son absence est une décision. Le
   serveur sait le faire, la cascade est écrite, et c'est précisément
   pour ça qu'un bouton dans une file d'attente serait dangereux : cette
   décision se prend en dehors de l'outil.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, EyeOff, Check } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label, Guideline, Waiting } from "../ui";
import { reportsToHandle, handleReport, type ReportRow } from "../../services/server";

const chip = (ink: string) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "inline-flex" as const,
  alignItems: "center" as const,
  gap: 5,
  padding: "5px 10px",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: ink,
  border: `1px solid ${ink}`,
});

export function Moderation() {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const read = useCallback(() => {
    reportsToHandle()
      .then(setQueue)
      /* Une file qu'on ne peut pas lire se dit vide plutôt que de
         planter le comptoir autour d'elle. */
      .catch(() => setQueue([]));
  }, []);

  useEffect(read, [read]);

  const settle = async (r: ReportRow, hide: boolean) => {
    setBusy(r.target_id);
    try {
      await handleReport(r.target_type, r.target_id, hide);
      /* On relit plutôt que de retirer la ligne à la main : un autre
         modérateur a pu classer entre-temps, et la file doit dire ce
         qu'elle est, pas ce qu'on croit avoir fait. */
      read();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ marginTop: 34 }}>
      <Label>{t("moderation.title")}</Label>
      {queue === null && <Waiting lines={2} label={t("moderation.title")} />}
      {queue?.length === 0 && <Guideline tight>{t("moderation.empty")}</Guideline>}

      {queue?.map((r) => (
        <div
          key={r.id}
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: C.card,
            border: `1px solid ${C.line}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <ShieldAlert size={13} style={{ color: C.burgundy, flexShrink: 0 }} aria-hidden />
            <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.ink }}>
              {r.about ?? t("moderation.gone")}
            </span>
            {/* LE NOMBRE D'ÉCHOS DIT PAR OÙ COMMENCER. Il n'est montré
                qu'au-delà d'un, où il apprend quelque chose. */}
            {r.echoes > 1 && (
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.burgundy }}>
                {t("moderation.echoes", { count: r.echoes })}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 16,
              color: C.inkFaded,
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {r.reason}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {r.target_type === "card" && (
              <button
                disabled={busy === r.target_id}
                onClick={() => settle(r, true)}
                style={chip(C.burgundy)}
              >
                <EyeOff size={11} /> {t("moderation.hide")}
              </button>
            )}
            <button
              disabled={busy === r.target_id}
              onClick={() => settle(r, false)}
              style={chip(C.inkFaded)}
            >
              <Check size={11} /> {t("moderation.settle")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
