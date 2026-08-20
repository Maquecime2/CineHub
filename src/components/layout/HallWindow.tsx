/* ============================================================
   LA VITRINE DU HALL — ce qu'on voit avant d'avoir un compte
   ============================================================

   Les quatre guichets du hall répondaient tous la même phrase à qui n'a
   pas de compte : « il faut un compte — le bouton au pied du rail ».
   C'est un itinéraire, pas une porte, et surtout ça ne dit RIEN de ce
   qu'on trouverait derrière. Une vitrine cachée n'attire personne — le
   projet a déjà tranché exactement cette question pour les peaux
   verrouillées, qui se montrent avec leur prix sur un classeur qui n'a
   jamais parlé à un serveur.

   ------------------------------------------------------------
   ELLE MONTRE L'OFFRE, JAMAIS LE CONTENU DES AUTRES
   ------------------------------------------------------------

   La tentation serait d'afficher un aperçu réel : les défis en cours,
   les dernières listes, le fil de quelqu'un. On ne le fait pas, et ce
   n'est pas une paresse.

   TOUT EST FERMÉ PAR DÉFAUT dans ce produit — `is_public` vaut `false`
   sur les listes comme sur les décors, une collection ne se partage
   qu'en le demandant. Bâtir une vitrine sur le contenu des autres
   voudrait dire ouvrir des routes publiques sur ce que personne n'a
   accepté de publier. Ce qu'on montre est donc ce qui n'appartient à
   personne : ce que le hall EST, et ce qu'il coûte.

   ET IL NE COÛTE RIEN, ce qui est la moitié de l'argument : les jetons
   se gagnent. On le dit ici parce que c'est exactement ce qu'on suppose
   du contraire en voyant une porte fermée.

   ------------------------------------------------------------
   SANS SERVEUR, ELLE N'EXISTE PAS
   ------------------------------------------------------------

   L'appelant vérifie `serverConfigured()` avant elle. La distinction
   tient tout le sens : sans adresse, il n'y a personne en face et
   promettre un hall serait mentir ; avec une adresse mais sans compte,
   il y a bien quelque chose, et c'est ce quelque chose qu'on montre.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { UserPlus, Users2, ListChecks, Puzzle, Coins } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Marquee, velvet } from "../atmosphere/hall";
import { openAccountDrawer } from "../../services/accountDoor";

/* Les quatre guichets, dans l'ordre du rail. Les icônes sont celles des
   sous-onglets : ce qu'on montre ici doit se reconnaître là-bas. */
const COUNTERS = [
  { key: "thread", icon: Users2 },
  { key: "lists", icon: ListChecks },
  { key: "quiz", icon: Puzzle },
  { key: "counter", icon: Coins },
] as const;

export function HallWindow() {
  const { t } = useTranslation();

  return (
    <div style={{ maxWidth: 620 }}>
      {/* LE FRONTON, emprunté à l'atmosphère du hall et non redessiné :
          une vue qui refait le fronton est une vue qui vient de forker
          la direction artistique. */}
      <Marquee lit />

      <div
        style={{
          ...velvet(),
          marginTop: 18,
          padding: "22px 24px",
          border: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 26,
            color: C.ink,
          }}
        >
          {t("hallWindow.title")}
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 18,
            color: C.inkFaded,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {t("hallWindow.body")}
        </div>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {COUNTERS.map(({ key, icon: Icon }) => (
            <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon size={15} style={{ flexShrink: 0, marginTop: 3, color: C.ochre }} aria-hidden />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.ink }}>
                  {t(`views.${key}`)}
                </div>
                <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
                  {t(`hallWindow.${key}`)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CE QU'ON PAIE, DIT AVANT QU'ON LE DEMANDE. Une porte fermée
            fait supposer une caisse derrière. */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: `1px dashed ${alpha(C.line, 0.8)}`,
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            lineHeight: 1.35,
          }}
        >
          {t("hallWindow.price")}
        </div>

        <button
          onClick={openAccountDrawer}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            padding: "9px 16px",
            background: C.ochre,
            color: C.card,
            fontFamily: F.mono,
            fontSize: 10.5,
            letterSpacing: 1,
          }}
        >
          <UserPlus size={12} /> {t("hallWindow.action")}
        </button>
      </div>
    </div>
  );
}
