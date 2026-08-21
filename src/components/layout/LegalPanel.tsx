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

   C'EST UNE `Sheet`, ET IL NE PIÉGEAIT PAS LE FOCUS. Il montait sa
   propre coquille — voile, boîte, titre, croix — avec `useEscape` seul :
   ouvert au clavier, le curseur restait DERRIÈRE le voile, et refermer
   renvoyait au début du document. `useDialog`, que `Sheet` porte, fait
   entrer le focus, l'y fait tourner, et le rend au bouton qui a ouvert.
   ============================================================ */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { Sheet } from "../ui/Sheet";
import { Label } from "../ui";
import { OPERATOR, TERMS_SINCE, operatorNamed, orBlank } from "../../legal";

const Para = ({ children }: { children: ReactNode }) => (
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
  const blank = t("legal.toFill");
  const since = new Date(TERMS_SINCE).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Sheet
      title={t("legal.title")}
      variant="drawer"
      width={460}
      aside={
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {t("legal.since", { date: since })}
        </span>
      }
      onClose={onClose}
    >
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
    </Sheet>
  );
}
