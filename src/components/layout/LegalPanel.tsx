/* ============================================================
   LES CONDITIONS, LA CONFIDENTIALITÉ, ET QUI ÉDITE
   ============================================================

   Trois textes qu'une adresse ouverte au public doit porter, et qui
   n'existaient nulle part. Ce n'est pas une formalité : la politique de
   confidentialité est le seul endroit où l'on écrit noir sur blanc ce
   que ce produit passe son temps à promettre — que la collection ne sort
   pas.

   UN PANNEAU ET NON UNE VUE, délibérément. Une vue voudrait sa pastille
   dans le rail, son entrée dans `TOURS`, sa place dans la visite ; or on
   ne vient pas ici tous les jours, on y vient une fois. Le tiroir du
   compte est déjà l'endroit où l'on répond aux questions « qui suis-je
   ici, qu'est-ce qui est parti, qu'est-ce que j'efface » — celle-ci en
   est la suite.

   IL SE LIT SANS COMPTE : le tiroir s'ouvre pour qui n'en a pas, et
   c'est justement à ce moment qu'on veut savoir ce qu'on s'apprête à
   accepter.

   LES FAITS DE L'ÉDITEUR VIENNENT DE `src/legal.ts`, pas d'ici : voir
   là-bas pourquoi ils ne sont pas dans le catalogue de traduction.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../ui/Layer";
import { Label } from "../ui";
import { OPERATOR, TERMS_SINCE, operatorNamed, orBlank } from "../../legal";
import { useEscape } from "../../hooks/useEscape";

const Para = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontFamily: F.hand,
      fontSize: 16.5,
      color: C.inkFaded,
      lineHeight: 1.4,
      marginTop: 8,
    }}
  >
    {children}
  </div>
);

export function LegalPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  useEscape(onClose);
  const blank = t("legal.toFill");
  const since = new Date(TERMS_SINCE).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Layer>
      <div
        onClick={onClose}
        data-veil
        style={{ position: "fixed", inset: 0, zIndex: 59, background: alpha(C.ink, 0.45) }}
      />
      <div
        role="dialog"
        aria-label={t("legal.title")}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(460px, 94vw)",
          zIndex: 60,
          background: C.paper,
          borderLeft: `1px solid ${C.line}`,
          boxShadow: `-6px 0 24px ${alpha(C.ink, 0.28)}`,
          overflowY: "auto",
          padding: "26px 24px calc(40px + var(--safe-bottom))",
          animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <div
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 24,
              color: C.ink,
            }}
          >
            {t("legal.title")}
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{ ...tap, all: "unset", cursor: "pointer", marginLeft: "auto" }}
          >
            <X size={16} color={C.inkFaded} />
          </button>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginBottom: 18 }}>
          {t("legal.since", { date: since })}
        </div>

        {/* ON DIT QU'IL MANQUE QUELQUE CHOSE PLUTÔT QUE DE LAISSER
            CROIRE QUE NON. Un panneau juridique à moitié rempli qui n'en
            dit rien est plus trompeur qu'un panneau absent. */}
        {!operatorNamed() && (
          <div
            style={{
              border: `1px solid ${C.burgundy}`,
              padding: "10px 12px",
              marginBottom: 16,
              fontFamily: F.hand,
              fontSize: 16,
              color: C.burgundy,
              lineHeight: 1.35,
            }}
          >
            {t("legal.incomplete")}
          </div>
        )}

        <Label>{t("legal.publisher")}</Label>
        <Para>
          {orBlank(OPERATOR.name, blank)}
          {OPERATOR.status.trim() && ` — ${OPERATOR.status.trim()}`}
        </Para>
        <Para>{orBlank(OPERATOR.address, blank)}</Para>
        <Para>{orBlank(OPERATOR.contact, blank)}</Para>
        {OPERATOR.registration.trim() && <Para>{OPERATOR.registration.trim()}</Para>}
        <Para>{t("legal.hostedBy", { host: orBlank(OPERATOR.host, blank) })}</Para>

        <div style={{ marginTop: 22 }}>
          <Label>{t("legal.privacy")}</Label>
        </div>
        {/* L'ORDRE DIT LA DOCTRINE : ce qui NE sort pas d'abord, parce
            que c'est la promesse du produit et la première chose qu'on
            vient vérifier. */}
        <Para>{t("legal.privacyLocal")}</Para>
        <Para>{t("legal.privacyServer")}</Para>
        <Para>{t("legal.privacyMeasure")}</Para>
        <Para>{t("legal.privacyRights")}</Para>

        <div style={{ marginTop: 22 }}>
          <Label>{t("legal.terms")}</Label>
        </div>
        <Para>{t("legal.termsFree")}</Para>
        <Para>{t("legal.termsPaid")}</Para>
        <Para>{t("legal.termsStop")}</Para>
        <Para>{t("legal.termsConduct")}</Para>
      </div>
    </Layer>
  );
}
