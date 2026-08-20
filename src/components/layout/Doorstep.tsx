/* ============================================================
   LA PORTE — ce qu'on voit avant d'avoir un compte
   ============================================================

   Le classeur ne s'ouvre plus sans session. Cet écran est donc tout ce
   que voit quelqu'un qui arrive : la visite guidée, les douze fiches
   d'exemple, et de quoi ouvrir un compte.

   ------------------------------------------------------------
   ON MONTRE, ON NE FAIT PAS ESSAYER
   ------------------------------------------------------------

   Le classeur de démonstration était MANIPULABLE il y a trois jours —
   on rangeait, on notait, on ouvrait des fiches. C'était le bon choix
   pour un produit qui marchait sans compte ; c'en est un mauvais pour
   celui-ci, parce qu'il ferait travailler quelqu'un dans un classeur
   qui n'est pas le sien et qu'il ne pourra pas emporter.

   Les douze fiches sont donc en LECTURE : elles disent de quoi le
   produit a l'air, ce qui est le rôle d'une vitrine, et rien de plus.

   ------------------------------------------------------------
   DEUX ÉTATS QUI NE SE CONFONDENT PAS
   ------------------------------------------------------------

   Cet écran-ci veut dire « tu n'as pas de compte ». Il ne se montre
   JAMAIS quand le serveur est injoignable — c'est `Unreachable`, juste
   en dessous, et confondre les deux ferait proposer une inscription à
   quelqu'un qui a déjà un compte et vient de perdre le réseau.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { UserPlus, HelpCircle, RefreshCw, CloudOff } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Marquee, velvet } from "../atmosphere/hall";
import { openAccountDrawer } from "../../services/accountDoor";
import type { Film } from "../../types";
import { PosterArt } from "../film/PosterArt";
import { tiltOf } from "../../domain/seeded";
import { initialsOf } from "../../domain/film";

const page = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "44px 20px",
} as const;

const button = (fill: string, ink: string) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "inline-flex" as const,
  alignItems: "center" as const,
  gap: 6,
  padding: "10px 18px",
  background: fill,
  color: ink,
  border: `1px solid ${fill === "transparent" ? C.line : fill}`,
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
});

export function Doorstep({ films, onTour }: { films: Film[]; onTour: () => void }) {
  const { t } = useTranslation();

  return (
    <div style={page}>
      <div style={{ maxWidth: 880, width: "100%" }}>
        <Marquee lit />

        <div
          style={{
            ...velvet(),
            marginTop: 18,
            padding: "26px 28px",
            border: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 34,
              color: C.ink,
            }}
          >
            {t("doorstep.title")}
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 19,
              color: C.inkFaded,
              marginTop: 6,
              maxWidth: "62ch",
              lineHeight: 1.35,
            }}
          >
            {t("doorstep.body")}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            <button onClick={openAccountDrawer} style={button(C.ochre, C.card)}>
              <UserPlus size={12} /> {t("doorstep.open")}
            </button>
            <button onClick={onTour} style={button("transparent", C.ink)}>
              <HelpCircle size={12} /> {t("doorstep.tour")}
            </button>
          </div>
        </div>

        {/* LES DOUZE, POSÉES COMME SUR UN MUR et non alignées en grille :
            c'est ce que le produit fait de ses fiches, et la vitrine doit
            ressembler à ce qu'on achète. L'inclinaison est SEMÉE et non
            tirée au sort — un mur qui gigote n'est pas un mur. */}
        <div
          aria-label={t("doorstep.shelf")}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 18,
            marginTop: 30,
          }}
        >
          {films.map((f) => (
            <div
              key={f.id}
              style={{
                width: 116,
                transform: `rotate(${tiltOf(f.id)}deg)`,
                background: C.card,
                border: `1px solid ${C.line}`,
                padding: 7,
                boxShadow: `2px 5px 12px ${alpha(C.ink, 0.22)}`,
              }}
            >
              <PosterArt film={f} height={153} width={102} initials={initialsOf(f.title)} lazy />
              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 11,
                  color: C.ink,
                  marginTop: 5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={f.title}
              >
                {f.title}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{f.year}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ON N'ARRIVE PAS À JOINDRE LE SERVEUR
   ============================================================

   L'AUTRE ÉCRAN, ET IL DIT AUTRE CHOSE. Un refus du serveur veut dire
   « tu n'as pas de compte » et appelle une inscription ; un silence veut
   dire « on n'y arrive pas » et appelle un réessai. Les confondre est le
   défaut classique de ce genre de porte : on propose de créer un compte
   à quelqu'un qui en a un, et qui vient seulement d'entrer dans un
   tunnel.

   `whoAmI` fait déjà la distinction — un 401/403 est un refus, tout le
   reste remonte. On ne fait que la rendre visible.

   PAS DE RÉESSAI AUTOMATIQUE. Une page qui se relance toute seule
   toutes les trois secondes est une page qui martèle un serveur déjà en
   difficulté, et qui ne dit jamais à personne ce qui se passe.
   ============================================================ */
export function Unreachable({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  const { t } = useTranslation();
  return (
    <div style={page}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <CloudOff size={30} color={C.inkFaded} aria-hidden />
        <div
          style={{
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 26,
            color: C.ink,
            marginTop: 12,
          }}
        >
          {t("doorstep.offlineTitle")}
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 18,
            color: C.inkFaded,
            marginTop: 8,
            lineHeight: 1.35,
          }}
        >
          {t("doorstep.offlineBody")}
        </div>
        <button
          onClick={onRetry}
          disabled={busy}
          style={{ ...button(C.pine, C.card), marginTop: 18, opacity: busy ? 0.6 : 1 }}
        >
          <RefreshCw size={12} /> {t(busy ? "doorstep.retrying" : "doorstep.retry")}
        </button>
      </div>
    </div>
  );
}
