/* ============================================================
   QUI PEUT STOCKER QUOI
   ============================================================

   ON NE FACTURE PAS UNE FONCTIONNALITÉ, ON FACTURE UNE CAPACITÉ QU'ON
   HÉBERGE — et jusqu'ici personne ne pouvait voir cette capacité, ni de
   son côté ni du nôtre. Le palier vivait dans une colonne qu'aucune
   route n'écrivait et qu'aucun écran ne lisait.

   AU COMPTOIR, PARCE QUE L'ADMINISTRATION Y VIT DÉJÀ — le bureau de
   modération, le studio des pochettes, la reprise d'un article. Une vue
   de plus aurait demandé une pastille, une entrée dans `TOURS` et une
   place dans la visite, pour un écran que deux personnes ouvrent. C'est
   le raisonnement de `Moderation`, mot pour mot.

   ------------------------------------------------------------
   LES BORNES NE SE CALCULENT PAS ICI, ET C'EST LA RÈGLE DU FICHIER
   ------------------------------------------------------------

   `ceilingsFor` prend la PERSONNE et non le palier, exprès : son
   commentaire dit que passer `plan` seul « aurait obligé chaque
   appelant à se souvenir de tester `is_admin` à côté, donc à l'oublier
   une fois ». Un tableau qui choisirait un plafond d'après `plan`
   serait cet oubli — un admin est `free` dans la colonne et sans borne
   dans les faits, et il hériterait du plafond du gratuit.

   Les plafonds arrivent donc du serveur, et `null` y veut dire « rien
   ne refuse ». On le lit en `!= null`, jamais en `!==` : c'est ce piège
   exact qui faisait lire `12 >= null`, donc `12 >= 0`, et teignait en
   rouge le compteur d'un admin qui n'a aucune limite.

   ELLE N'EXISTE PAS POUR LES AUTRES. `iAmAdmin` est une intuition lue
   sur le compte retenu ; la route demande le rôle, et se tromper ici ne
   montre qu'un panneau qui répondra 403.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crown } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label, Guideline, Waiting, Trouble } from "../ui";
import { useSay } from "../ui/Feedback";
import { peopleTiers, setPersonPlan, type PersonTier } from "../../services/server";

const chip = (ink: string, on: boolean) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "inline-flex" as const,
  alignItems: "center" as const,
  padding: "3px 9px",
  fontFamily: F.mono,
  fontSize: 9.5,
  letterSpacing: 1,
  color: on ? C.card : ink,
  background: on ? ink : "transparent",
  border: `1px solid ${ink}`,
});

export function Tiers() {
  const { t } = useTranslation();
  const say = useSay();
  const [rows, setRows] = useState<PersonTier[] | null>(null);
  const [trouble, setTrouble] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /* « IL N'Y A RIEN » ET « ON N'A PAS PU DEMANDER » NE SONT PAS LE MÊME
     ÉCRAN. Une table de comptes vide n'existe pas — on est au moins soi
     — donc un tableau vide ne peut vouloir dire qu'une chose : la
     requête a échoué. La confondre avec « aucun compte » ferait croire
     à une base perdue. */
  const read = useCallback(() => {
    setTrouble(false);
    peopleTiers()
      .then(setRows)
      .catch(() => {
        setRows(null);
        setTrouble(true);
      });
  }, []);

  useEffect(read, [read]);

  const grant = async (who: PersonTier, plan: "free" | "plus") => {
    if (who.plan === plan) return;
    setBusy(who.pseudo);
    try {
      await setPersonPlan(who.pseudo, plan);
      /* On relit plutôt que de corriger la ligne à la main : les
         plafonds viennent du serveur, et les recalculer ici serait
         exactement ce que ce fichier s'interdit. */
      read();
      say(t("tiers.granted", { pseudo: who.pseudo, plan: t(`account.plan_${plan}`) }));
    } catch {
      say(t("tiers.refused"));
    } finally {
      setBusy(null);
    }
  };

  /* SANS LIMITE SE DIT PAR UN MOT, jamais par un nombre ni un tiret. */
  const gauge = (used: number, ceiling: number | null) =>
    ceiling != null ? `${used} / ${ceiling}` : `${used} · ${t("account.usageNoLimit")}`;

  return (
    <div style={{ marginTop: 34 }}>
      <Label>{t("tiers.title")}</Label>
      {rows === null && !trouble && <Waiting lines={3} label={t("tiers.title")} />}
      {trouble && <Trouble onRetry={read}>{t("tiers.trouble")}</Trouble>}

      {rows?.map((p) => (
        <div
          key={p.id}
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: C.card,
            border: `1px solid ${C.line}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.ink }}>
              {p.pseudo}
            </span>
            {/* L'ADMIN N'EST PAS UN TROISIÈME PALIER : c'est un champ de
                la personne, et il passe au-dessus des deux. On le DIT,
                plutôt que de le déduire d'un plafond absent. */}
            {p.isAdmin && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: F.mono,
                  fontSize: 9.5,
                  letterSpacing: 1,
                  color: C.slate,
                }}
              >
                <Crown size={11} aria-hidden />
                {t("account.planAdmin")}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {/* LE RÔLE NE SE DONNE PAS ICI, ET AUCUNE ROUTE NE LE DONNE.
                Les deux boutons n'écrivent que `plan` ; pour un admin ils
                ne changent rien de visible, puisque le rôle l'emporte —
                on les laisse quand même, parce que la colonne existe et
                qu'un jour le rôle peut lui être retiré. */}
            <div style={{ display: "flex", gap: 5 }}>
              {(["free", "plus"] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => grant(p, plan)}
                  disabled={busy === p.pseudo}
                  aria-pressed={p.plan === plan}
                  style={chip(plan === "plus" ? C.slate : C.inkFaded, p.plan === plan)}
                >
                  {t(`account.plan_${plan}`)}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              marginTop: 5,
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontFamily: F.mono,
              fontSize: 10,
              color: C.inkFaded,
            }}
          >
            <span>
              {t("account.usageMedia")} · {gauge(p.media, p.mediaCeiling)}
            </span>
            <span>
              {t("account.usageImports")} · {gauge(p.imports, p.importCeiling)}
            </span>
          </div>
        </div>
      ))}

      {rows?.length === 0 && <Guideline tight>{t("tiers.nobody")}</Guideline>}
    </div>
  );
}
