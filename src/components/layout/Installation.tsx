/* ============================================================
   QUATRE CARTES SCOTCHÉES AU BAS DE LA PAGE

   L'une invite à poser le classeur sur l'écran d'accueil. Une autre dit
   qu'une version neuve attend. La troisième prévient qu'un compte ne
   tient qu'à l'appareil où il est né. La quatrième, que le stockage se
   remplit — ou qu'il a débordé.

   Elles ne paraissent JAMAIS ENSEMBLE : on ne demande pas deux choses à
   la fois, et c'est `App` qui arbitre. L'ordre y est écrit, et il se
   lit par ce qu'on perd à attendre : le stockage plein d'abord, parce
   qu'une écriture perdue ne se rattrape pas ; la version neuve ensuite,
   qui attend déjà ; le compte seul ; l'installation en dernier.

   They borrow their shape from the tour's reminder — an index card laid
   askew, with its strip of tape. That is not an affectation: it is what
   distinguishes a sentence from the binder from a browser banner, and
   what we want precisely is for the former not to look like the latter.

   Mounted by `Layer`, like everything that floats: the view column is a
   stacking context and transforms itself for the length of an animation.
   ============================================================ */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Download, HardDriveDownload, RefreshCw, Share, Smartphone, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../ui/Layer";

/* The card lives above the bottom bar (20) and below any open panel
   (30): it informs, it does not interrupt. */
const Z = 25;

function Card({
  children,
  tour,
  onFermer,
  /* LE BOUTON DE FERMETURE A UN NOM, et il doit dire CE QU'ON ferme.
     Il était figé sur « écarter l'invitation à installer » : juste pour
     la première carte, faux pour la troisième, et invisible à l'œil —
     seule une synthèse vocale lit cette étiquette. */
  dismissLabel = "install.dismiss",
}: {
  children: ReactNode;
  tour?: string;
  onFermer?: () => void;
  dismissLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Layer>
      <div
        data-tour={tour}
        style={{
          position: "fixed",
          left: "max(12px, var(--safe-left))",
          right: "max(12px, var(--safe-right))",
          /* Above the bottom bar when there is one: the card must not
             hide the tabs it invites you to keep. */
          bottom: "calc(66px + var(--safe-bottom))",
          zIndex: Z,
          margin: "0 auto",
          maxWidth: 420,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: `2px 6px 18px ${alpha(C.ink, 0.28)}`,
          transform: "rotate(-0.5deg)",
          animation: "sheetIn var(--motion-slow) var(--motion-ease) backwards",
        }}
      >
        {/* the strip of tape: the card is taped, not laid */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -9,
            left: "50%",
            width: 62,
            height: 18,
            marginLeft: -31,
            background: alpha(C.paper, 0.72),
            border: `1px solid ${alpha(C.line, 0.6)}`,
            transform: "rotate(-1.6deg)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {onFermer && (
          <button
            onClick={onFermer}
            aria-label={t(dismissLabel)}
            style={{ all: "unset", ...tap, cursor: "pointer", color: C.inkFaded }}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </Layer>
  );
}

const Title = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 18, color: C.ink }}>
    {children}
  </div>
);

const Line = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 2 }}>
    {children}
  </div>
);

const button = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  marginTop: 8,
  padding: "6px 12px",
  gap: 6,
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  color: C.card,
  background: C.burgundy,
  border: `1px solid ${C.burgundy}`,
};

/** The invitation to lay the binder on the home screen. */
export function Installation({
  apple,
  onInstall,
  onDismiss,
}: {
  /** On iOS we explain the gesture: no dialog box exists. */
  apple: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card tour="install" onFermer={onDismiss}>
      <Title>{t("install.title")}</Title>
      {apple ? (
        /* The share icon sits INSIDE the sentence, and the two languages
           do not put it in the same place — so the sentence is cut in
           two around it rather than pasted together in one key. */
        <Line>
          {t("install.appleBefore")}
          <Share size={13} style={{ verticalAlign: -2 }} />
          {t("install.appleAfter")}
        </Line>
      ) : (
        <>
          <Line>{t("install.body")}</Line>
          <button onClick={onInstall} style={button}>
            <Download size={12} /> {t("install.action")}
          </button>
        </>
      )}
    </Card>
  );
}

/* ============================================================
   LE COMPTE NE TIENT QU'À CET APPAREIL
   ============================================================

   Une passkey vit dans la chose qui la détient et n'en sort pas : perdre
   la machine, c'est perdre le compte. Le tiroir sait déjà tout faire —
   lister les appareils, en ajouter par cérémonie QR, délivrer un code
   d'appairage — mais il faut penser à l'ouvrir, et personne n'y pense
   avant le soir où il en a besoin.

   ELLE NE FAIT RIEN ELLE-MÊME, et c'est voulu : elle ouvre le tiroir. Y
   recopier le geste aurait fait deux endroits pour poser un appareil,
   dont un seul saurait dire lesquels sont déjà là.

   `services/loneDevice` décide combien de fois on a le droit d'insister.
   ============================================================ */
export function LoneDeviceCard({
  onOpenAccount,
  onDismiss,
}: {
  onOpenAccount: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card onFermer={onDismiss} dismissLabel="loneDevice.dismiss">
      <Title>{t("loneDevice.title")}</Title>
      <Line>{t("loneDevice.body")}</Line>
      <button onClick={onOpenAccount} style={button}>
        <Smartphone size={12} /> {t("loneDevice.action")}
      </button>
    </Card>
  );
}

/* ============================================================
   LE STOCKAGE SE REMPLIT, OU IL A DÉBORDÉ
   ============================================================

   Deux nouvelles, et elles ne se disent pas de la même façon. « Ça se
   remplit » laisse le temps d'agir. « L'écriture a échoué » veut dire
   que ce qui est à l'écran n'est PAS sur le disque — on ferme l'onglet
   en croyant avoir rangé, et on rouvre la collection d'hier.

   La seconde passe donc devant TOUTES les autres cartes : une version
   neuve peut attendre, une écriture perdue non.

   Elle remplace un `alert()` dont la phrase était écrite en français
   dans `services/storage`. Voir là-bas pourquoi ce module signale au
   lieu de parler.
   ============================================================ */
export function QuotaCard({
  failed,
  megabytes,
  onBackup,
  onDismiss,
}: {
  /** L'écriture a échoué, par opposition à « la jauge est haute ». */
  failed: boolean;
  megabytes: number;
  onBackup: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card onFermer={onDismiss} dismissLabel="quota.dismiss">
      <Title>{t(failed ? "quota.fullTitle" : "quota.title")}</Title>
      <Line>{failed ? t("quota.fullBody") : t("quota.body", { megabytes })}</Line>
      <Line>{t("quota.advice")}</Line>
      <button onClick={onBackup} style={button}>
        <HardDriveDownload size={12} /> {t("quota.action")}
      </button>
    </Card>
  );
}

/** A brand-new version is waiting to be laid down. */
export function UpdateCard({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <Card tour="maj">
      <Title>{t("update.title")}</Title>
      {/* We replace NOTHING without saying so: an application that
          updates itself while one is writing a note loses the note. */}
      <Line>{t("update.body")}</Line>
      <button onClick={onReload} style={button}>
        <RefreshCw size={12} /> {t("update.action")}
      </button>
    </Card>
  );
}
