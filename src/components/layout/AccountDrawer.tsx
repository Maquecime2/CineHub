/* ============================================================
   THE ACCOUNT DRAWER — what the binder says of the outside
   ============================================================

   A single place for three things that belong together: who one is, what
   has been synchronised, and what is still waiting. Scattering them —
   the state in the rail, the account in the settings — would force one
   to look for the bad news in two places.

   THE TONE IS NOT THAT OF AN ONLINE SERVICE. "Offline" is not a failure
   here, it is the normal working of a binder that lives at home. So we
   say what is waiting, not what is missing.
   ============================================================ */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  CloudOff,
  RefreshCw,
  LogOut,
  KeyRound,
  UserPlus,
  Check,
  X,
  Download,
  Eraser,
  Trash2,
  Link as LinkIcon,
  Bell,
  VolumeX,
  Smartphone,
  Laptop,
  Scale,
} from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../ui/Layer";
import { watchWorn, wornTitle } from "../../theme/owned";
import { Label, Tally } from "../ui";
import { Confirmation, type ConfirmRequest } from "../ui/Confirmation";
import { LegalPanel } from "./LegalPanel";
import {
  ADDRESS,
  deleteMyAccount,
  wipeMyData,
  myData,
  signIn,
  setSharing,
  myPurse,
  setLadder,
  mySharing,
  signOut,
  signUp,
  myBlocks,
  unblock,
  myKeys,
  addKey,
  forgetKey,
  makePairingCode,
  claimPairingCode,
  myUsage,
  type DeviceKey,
  type Sharing,
  type Person,
  type Usage as UsageReport,
} from "../../services/server";
import { keepTheVault } from "../../services/persistence";
import { doorEvent } from "../../services/measure";
import {
  pushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "../../services/push";
import { mediaTrouble } from "../../services/media";
import { forgetSync } from "../../services/sync";
import { startOver } from "../../services/startOver";
import type { SyncReport } from "../../services/sync";
import { useEscape } from "../../hooks/useEscape";

/* WHEN THE LAST SYNCHRONISATION WAS. The date at the end is formatted by
   the reader's language and not by a hard-coded `fr-FR`: "12 January" and
   "12 janvier" are the same instant, and only one of the two is readable
   at a time. */
type Say = (key: string, values?: Record<string, string | number>) => string;

const whenSaid = (at: number | null, t: Say, lang: string): string => {
  if (!at) return t("account.never");
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 90) return t("account.justNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("account.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("account.hoursAgo", { count: hours });
  return new Date(at).toLocaleDateString(lang, { day: "numeric", month: "long" });
};

export function AccountDrawer({
  report,
  onClose,
  onSync,
  onAccountChange,
}: {
  report: SyncReport;
  onClose: () => void;
  onSync: () => void;
  /** The account has changed: the application must find its bearings again. */
  onAccountChange: (person: Person | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const [pseudo, setPseudo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  /* Les mentions se lisent AVEC OU SANS COMPTE : c'est justement quand
     on n'en a pas encore qu'on veut savoir ce qu'on s'apprête à
     accepter. */
  const [legal, setLegal] = useState(false);

  /* DEUX PANNEAUX EMPILÉS, UNE SEULE TOUCHE. Les mentions s'ouvrent
     PAR-DESSUS ce tiroir : Échap doit refermer celles-ci d'abord, sinon
     on se retrouve rendu au mur alors qu'on voulait revenir au compte.
     Le panneau des mentions écoute aussi pour son propre compte — les
     deux referment la même chose, donc l'ordre entre eux est sans
     importance ; ce qui compte est que le tiroir, lui, s'abstienne. */
  useEscape(() => (legal ? setLegal(false) : onClose()));

  const attempt = async (what: (p: string) => Promise<Person>) => {
    setTrouble(null);
    setBusy(true);
    try {
      const who = await what(pseudo.trim().toLowerCase());
      /* AN ACCOUNT THAT CHANGES STARTS OVER. Keeping the old one's read
         cursor would make the binder believe it had already seen all of
         the new one's collection — which would stay invisible. */
      forgetSync();
      /* OUVRIR un compte est un geste de la porte ; en REJOINDRE un ne
         l'est pas — c'est quelqu'un qui était déjà là. Les deux passent
         par cette fonction, d'où la comparaison plutôt qu'un second
         paramètre à poser sur les deux boutons. */
      if (what === signUp) doorEvent("porte:compte-cree");
      /* L'AUTRE MOMENT OÙ ON DEMANDE LE REMPART. Poser une passkey est
         le geste d'engagement le plus net du produit, et il vient de
         passer par une empreinte : le navigateur ne demandera pas mieux.
         Sans `await` — le compte est ouvert, rien ne doit retenir la
         main. */
      void keepTheVault();
      onAccountChange(who);
    } catch (e) {
      /* Refusing one's own fingerprint is not an error to dramatise: one
         changes one's mind, and that is all. */
      const m = (e as Error).message || "";
      setTrouble(/NotAllowed|abort/i.test(m) ? t("account.cancelled") : m || t("account.failed"));
    } finally {
      setBusy(false);
    }
  };

  /* The same shape as `attempt` above, and for the same reason: an
     account that changes must start over, or the read cursor of the old
     one would make the binder believe it had already seen all of the new
     one's collection. */
  const claim = async () => {
    setTrouble(null);
    setBusy(true);
    try {
      const who = await claimPairingCode(code);
      setCode("");
      forgetSync();
      onAccountChange(who);
    } catch (e) {
      setTrouble((e as Error).message || t("account.failed"));
    } finally {
      setBusy(false);
    }
  };

  /* Read at render: it changes when a synchronisation runs, and the
     drawer is opened after one, not during. */
  const mediaSays = mediaTrouble();

  const signedIn = !!report.person;
  /* La mention portée, relue dès qu'on change de tenue au comptoir. */
  const title = useSyncExternalStore(watchWorn, wornTitle, () => null);

  return (
    <Layer>
      <div
        onClick={onClose}
        data-veil
        style={{ position: "fixed", inset: 0, zIndex: 59, background: alpha(C.ink, 0.45) }}
      />
      <div
        role="dialog"
        aria-label={t("account.title")}
        data-tour="compte-tiroir"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(400px, 92vw)",
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
              fontSize: 26,
              color: C.ink,
            }}
          >
            <span data-pseudo={signedIn ? report.person!.pseudo : undefined}>
              {signedIn ? report.person!.pseudo : t("account.title")}
            </span>
          </div>

          {/* ============================================================
              LA MENTION QU'ON PORTE, ENFIN DESSINÉE
              ============================================================

              `wornTitle` n'avait AUCUN lecteur : on achetait un titre au
              comptoir, on le portait, et il n'apparaissait nulle part.
              Sur quatre choses qui se portent, deux ne se voyaient
              jamais — la peau se règle à côté, celle-ci était muette.

              ICI ET NULLE PART AILLEURS, ET CE N'EST PAS UN CHOIX DE
              MISE EN PAGE. Le titre des AUTRES n'existe pas côté client :
              `person.title` n'est lu que par une seule requête de tout le
              serveur (`myHoldings`, soi-même), et aucune des requêtes qui
              rendent un pseudonyme — œuvres d'une liste, propriétaire,
              participants, classements — ne le joint. Le descendre est un
              chantier serveur à lui seul, avec un arbitrage qui n'est pas
              tranché : le titre suit-il quelqu'un au palmarès public ?
              C'est pourquoi il n'y a pas de composant partagé : il ne
              peut pas y avoir un second appelant.

              À CÔTÉ DU `span[data-pseudo]`, JAMAIS DEDANS :
              `pseudoOfThePage` lit cet attribut pour le partage de lien.

              PAR ABONNEMENT ET NON PAR APPEL DIRECT, sinon porter un
              titre ne se verrait qu'au rechargement — le défaut exact que
              `watchWorn` a été écrit pour fermer. */}
          {signedIn && title && (
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: C.inkFaded,
                border: `1px solid ${C.line}`,
                padding: "2px 6px",
              }}
            >
              {t(`counter.items.${title}`)}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{ ...tap, all: "unset", cursor: "pointer", marginLeft: "auto" }}
          >
            <X size={16} color={C.inkFaded} />
          </button>
        </div>

        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginBottom: 20 }}>
          {signedIn ? t("account.signedInNote") : t("account.signedOutNote")}
        </div>

        {/* EN HAUT ET NON EN BAS DU TIROIR. Placé sous les trois boutons
            d'effacement, le lien ne serait lu que par qui a déjà décidé
            de partir — or ces conditions se lisent AVANT d'ouvrir un
            compte, et le tiroir s'ouvre pour qui n'en a pas. */}
        <button
          onClick={() => setLegal(true)}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 20,
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            color: C.inkFaded,
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <Scale size={11} /> {t("legal.title")}
        </button>

        {/* ---- the state ---- */}
        <Label>{t("account.sync")}</Label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            marginBottom: 18,
            background: C.card,
            border: `1px solid ${C.line}`,
            fontFamily: F.mono,
            fontSize: 11,
            color: C.inkFaded,
          }}
        >
          {report.state === "up-to-date" && <Check size={14} color={C.pine} />}
          {report.state === "waiting" && <CloudOff size={14} color={C.inkFaded} />}
          {report.state === "running" && <RefreshCw size={14} color={C.inkFaded} />}
          <span style={{ flex: 1 }}>
            {report.state === "absent" && t("account.noServer")}
            {report.state === "no-account" && t("account.allStaysHere")}
            {report.state === "running" && t("account.running")}
            {report.state === "up-to-date" &&
              t("account.upToDate", { when: whenSaid(report.at, t, i18n.language) })}
            {/* "0 CARDS ARE WAITING FOR THE NETWORK" MEANS NOTHING, and
                that is nonetheless what showed when the server was
                unreachable without our having changed anything: an empty
                countdown instead of the one useful piece of news. */}
            {report.state === "waiting" &&
              (report.pending === 0
                ? t("account.unreachable")
                : t("account.pending", { count: report.pending }))}
            {report.state === "error" && (report.message || t("account.refused"))}
          </span>
          {signedIn && (
            <button
              onClick={onSync}
              title={t("account.syncNow")}
              style={{ ...tap, all: "unset", cursor: "pointer", color: C.burgundy }}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* WHAT THE CONTAINER REFUSED, SAID HERE. The blobs travel last
            and outside the guard that watches the cards, so a container
            in trouble leaves the synchronisation "up to date" — which is
            true of the cards and says nothing of the posters. Without
            this line the only trace was a row of failed uploads in the
            browser's network panel, which is not a place one looks. */}
        {signedIn && mediaSays.kind !== "none" && (
          <div
            style={{
              display: "flex",
              gap: 7,
              padding: "9px 11px",
              marginBottom: 18,
              background: C.card,
              borderLeft: `2px solid ${C.burgundy}`,
              fontFamily: F.hand,
              fontSize: 15,
              color: C.inkFaded,
            }}
          >
            <CloudOff size={14} style={{ flexShrink: 0, color: C.burgundy }} aria-hidden />
            <span>
              {mediaSays.kind === "cors"
                ? t("account.mediaCors")
                : /* Which DIRECTION failed. The two sentences below are not
                     interchangeable: one says nothing is leaving, the other
                     that nothing is arriving, and sending somebody to look
                     at the wrong end of the mirror costs hours. */
                  t(
                    mediaSays.kind === "read-refused"
                      ? "account.mediaPullRefused"
                      : "account.mediaRefused",
                    { detail: mediaSays.detail || "" }
                  )}
            </span>
          </div>
        )}

        {/* ---- entrer, ou partir ---- */}
        {!signedIn ? (
          <>
            <Label>{t("account.handle")}</Label>
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder={t("account.handlePlaceholder")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                ...tap,
                padding: "10px 12px",
                marginBottom: 10,
                background: C.card,
                border: `1px solid ${C.line}`,
                fontFamily: F.mono,
                fontSize: 13,
                color: C.ink,
              }}
            />
            <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginBottom: 12 }}>
              {/* We explain the passkey in one sentence: nobody should
                  have to know what WebAuthn is in order to sign up. */}
              {t("account.passkeyNote")}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                disabled={busy || pseudo.trim().length < 3}
                onClick={() => attempt(signUp)}
                style={button(C.burgundy, busy || pseudo.trim().length < 3)}
              >
                <UserPlus size={12} /> {t("account.signUp")}
              </button>
              <button disabled={busy} onClick={() => attempt(signIn)} style={button(C.ink, busy)}>
                <KeyRound size={12} /> {t("account.signIn")}
              </button>
            </div>

            {/* ------------------------------------------------------
                ARRIVING FROM ANOTHER MACHINE

                The handle above needs a passkey THIS computer holds, and
                it holds none: that is the whole situation of a second
                computer. On a real domain the telephone answers for it;
                on `localhost` — two machines, two domains, nothing in
                common to sign for — nothing can, and a code is the only
                way across.

                It is placed under the sign-in rather than beside it: it
                is the second thing one tries, after finding out that the
                first cannot work here.
                ------------------------------------------------------ */}
            <div style={{ borderTop: `1px dashed ${C.line}`, marginTop: 16, paddingTop: 12 }}>
              <Label>{t("account.pairClaimTitle")}</Label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && claim()}
                  placeholder="XXXXXXXXXX"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={12}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    ...tap,
                    padding: "10px 12px",
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    fontFamily: F.mono,
                    fontSize: 15,
                    letterSpacing: 3,
                    color: C.ink,
                  }}
                />
                <button
                  disabled={busy || code.trim().length < 8}
                  onClick={claim}
                  style={button(C.pine, busy || code.trim().length < 8)}
                >
                  {t("account.pairClaim")}
                </button>
              </div>
              <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
                {t("account.pairClaimNote")}
              </div>
            </div>
            {trouble && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: F.hand,
                  fontSize: 16,
                  color: C.burgundy,
                }}
              >
                {trouble}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Share />
            <Standing />

            <Devices lang={i18n.language} />
            <Usage />

            <Blocks />

            <Reminders />

            <button
              onClick={async () => {
                await signOut();
                /* The collection STAYS: signing out is not being
                   dispossessed. Only the link with the server is cut. */
                forgetSync();
                onAccountChange(null);
              }}
              style={button(C.ink, false)}
            >
              <LogOut size={12} /> {t("account.signOut")}
            </button>

            {/* ------------------------------------------------------
                WHAT IS YOURS, AND THE RIGHT TO LEAVE

                Both routes had existed since the server's first day and
                had no button at all: a right one cannot exercise with a
                finger is not a right, it is a line in a configuration
                file.
                ------------------------------------------------------ */}
            <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
              <Label>{t("account.yourData")}</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setTrouble(null);
                    setBusy(true);
                    try {
                      const everything = await myData();
                      /* A file, not a screen: what one takes away must
                         be readable elsewhere, and in ten years. */
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(
                        new Blob([JSON.stringify(everything, null, 2)], {
                          type: "application/json",
                        })
                      );
                      link.download = `cine-hub-${report.person!.pseudo}.json`;
                      link.click();
                      URL.revokeObjectURL(link.href);
                    } catch (e) {
                      setTrouble((e as Error).message || t("account.exportFailed"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={button(C.slate, busy)}
                >
                  <Download size={12} /> {t("account.takeEverything")}
                </button>

                {/* REPARTIR DE ZÉRO, entre exporter et s'en aller.

                    Sa place est ici et pas ailleurs : c'est là qu'on
                    vient quand on veut faire le ménage, et l'avoir mis
                    à côté du bouton qui SUPPRIME oblige à écrire
                    clairement ce qui les sépare. Les deux cartes de
                    confirmation le disent, mot pour mot. */}
                <button
                  disabled={busy}
                  onClick={() =>
                    setRequest({
                      title: t("account.wipeTitle"),
                      body: t("account.wipeBody"),
                      action: t("account.wipeAction"),
                      severe: true,
                      onConfirm: async () => {
                        setRequest(null);
                        setBusy(true);
                        /* LES DEUX CÔTÉS, ET LE SERVEUR EN PREMIER.

                           Le classeur est local d'abord : effacer le
                           serveur seul laissait tous les films en place,
                           et la synchro suivante les y aurait repoussés
                           — le ménage défait par son propre envoi. */
                        try {
                          const survived = await startOver(wipeMyData);
                          if (survived.local || survived.images) {
                            setTrouble(t("account.wipePartly"));
                            setBusy(false);
                            return;
                          }
                          location.reload();
                        } catch (e) {
                          setTrouble((e as Error).message || t("account.wipeFailed"));
                          setBusy(false);
                        }
                      },
                    })
                  }
                  style={{ ...button(C.ochre, busy), background: "transparent", color: C.ochre }}
                >
                  <Eraser size={12} /> {t("account.wipeMine")}
                </button>

                <button
                  disabled={busy}
                  onClick={() =>
                    setRequest({
                      title: t("account.deleteTitle"),
                      body: t("account.deleteBody"),
                      action: t("account.deleteAction"),
                      severe: true,
                      onConfirm: async () => {
                        setRequest(null);
                        setBusy(true);
                        try {
                          await deleteMyAccount();
                          forgetSync();
                          onAccountChange(null);
                        } catch (e) {
                          setTrouble((e as Error).message || t("account.deleteFailed"));
                        } finally {
                          setBusy(false);
                        }
                      },
                    })
                  }
                  style={{
                    ...button(C.burgundy, busy),
                    background: "transparent",
                    color: C.burgundy,
                  }}
                >
                  <Trash2 size={12} /> {t("account.deleteMine")}
                </button>
              </div>
            </div>

            {trouble && (
              <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy }}>{trouble}</div>
            )}
          </div>
        )}

        <Confirmation request={request} onClose={() => setRequest(null)} />
        {legal && <LegalPanel onClose={() => setLegal(false)} />}

        <div
          style={{
            marginTop: 24,
            fontFamily: F.mono,
            fontSize: 9.5,
            color: alpha(C.inkFaded, 0.7),
            lineHeight: 1.7,
          }}
        >
          {ADDRESS || t("account.noServerShort")}
          <br />
          {/* THIS SENTENCE SAID THE OPPOSITE OF WHAT HAPPENS, and I saw
              it lie by watching what actually left: the whole card is
              sent, notes and screenings included.

              That is as it should be: a noted that does not follow onto
              the phone is a noted lost. But it cannot be guessed, so it is
              said — and sharing, for its part, will send only the public
              part of the card (see `publicPart`). */}
          {t("account.footer")}
        </div>
      </div>
    </Layer>
  );
}

const button = (ink: string, off: boolean) => ({
  all: "unset" as const,
  ...tap,
  cursor: off ? "default" : "pointer",
  opacity: off ? 0.45 : 1,
  gap: 6,
  padding: "8px 14px",
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  color: C.card,
  background: ink,
  border: `1px solid ${ink}`,
});

/* ============================================================
   SHOWING ONE'S COLLECTION — three states, and not two
   ============================================================

   "Public" or "private" does not say what one really wants to do: show
   one's video library to somebody without posting it to the world. Hence
   the secret link, which is the most frequent and most useful case.

   THE SETTING LIVES ON THE SERVER, not here: it is the server that will
   decide whether or not to answer a stranger, and a preference filed in
   the browser would have no hold on that decision.
   ============================================================ */
/* ============================================================
   THE CHALLENGE REMINDERS
   ============================================================

   THE ONLY PRETEXT TO RING IN THIS WHOLE PROJECT: a challenge starting,
   a challenge ending. No "somebody you follow rated a film", no "come
   back, your collection is waiting". An application that finds itself
   reasons to ring ends up uninstalled.

   THE SETTING DOES NOT APPEAR IF IT CAN DO NOTHING. It takes a server,
   keys laid on it, a service worker and the system's permission; three
   of those four conditions escape the application. A switch that does
   nothing would be worse than its absence.

   THE SUBSCRIPTION IS THIS DEVICE'S, and the text says so: the same
   person on a phone and a computer sets it twice, which is exactly what
   we want — one does not want to be rung on one's work computer because
   one accepted it on one's phone.
   ============================================================ */
/* ============================================================
   THOSE WE HAVE SILENCED — and the right to change one's mind
   ============================================================

   `Elsewhere`, on a card, knows how to silence a review's author in one
   gesture. That gesture worked, it was even tested end to end — and it
   was WITHOUT RETURN: nothing, nowhere, said whom one had blocked, and
   no screen called `unblock`. Both functions existed on the client side,
   the route on the server side, the table in the schema. Fifteen lines
   of drawer were missing.

   A gesture that cannot be undone is not a setting, it is an accident
   waiting to happen. We repair it here rather than removing the button
   opposite: silencing somebody is legitimate, no longer being able to
   go back on it is not.

   THE SECTION STAYS QUIET WHEN THE LIST IS EMPTY, like the reminders
   above: there is nothing to undo, and a "nobody" heading on such a
   subject teaches nobody anything. */
function Blocks() {
  const { t } = useTranslation();
  const [list, setList] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reread = () =>
    myBlocks()
      .then((r) => setList(r.blocks))
      /* With no server or offline: we stay quiet, we do not show an
         error for a heading that may have nothing to say. */
      .catch(() => setList(null));

  useEffect(() => {
    reread();
  }, []);

  if (!list?.length) return null;

  const giveSpeechBack = async (pseudo: string) => {
    setBusy(pseudo);
    try {
      await unblock(pseudo);
    } finally {
      setBusy(null);
      await reread();
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>{t("account.silenced")}</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {list.map((pseudo) => (
          <div key={pseudo} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VolumeX size={13} style={{ flexShrink: 0, color: C.inkFaded }} aria-hidden />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: F.body,
                fontSize: 13,
                color: C.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pseudo}
            </span>
            <button
              onClick={() => giveSpeechBack(pseudo)}
              disabled={busy === pseudo}
              aria-label={t("account.unblockOne", { pseudo })}
              style={{
                all: "unset",
                ...tap,
                cursor: busy === pseudo ? "default" : "pointer",
                opacity: busy === pseudo ? 0.45 : 1,
                flexShrink: 0,
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: C.inkFaded,
                borderBottom: `1px dashed ${C.line}`,
              }}
            >
              {t("account.unblock")}
            </button>
          </div>
        ))}
      </div>
      {/* WHAT UNBLOCKING DOES NOT DO, and it is better said than left to
          be guessed: the server resubscribes nobody. The link was undone
          at the blocking; we reopen a door, we do not call somebody
          back. */}
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 7 }}>
        {t("account.unblockNote")}
      </div>
    </div>
  );
}

/* ============================================================
   MY DEVICES — getting an account out of the computer it was born in
   ============================================================

   A PASSKEY BELONGS TO THE THING THAT HOLDS IT. The one Windows Hello
   made lives in that computer and goes nowhere: nothing exports it,
   nothing carries it. So an account opened on one machine was shut
   inside it — and nothing in the binder said so, nor offered a way out.

   THE WAY OUT IS NOT TO MOVE THAT KEY, IT IS TO ADD A SECOND ONE, held
   by something that goes about with you. A telephone. Once it holds a
   key of this account, ANY other computer signs in by showing a code for
   it to scan: nothing to type, nothing to copy, and the key itself never
   crosses.

   THE SECTION SHOWS ITSELF EVEN WITH A SINGLE KEY, unlike `Blocks` above
   which stays quiet when it has nothing to undo. The difference is the
   point: with one key there is exactly one thing to do, and it is the
   one nobody thinks of before the evening they need it.
   ============================================================ */
/* ============================================================
   CE QU'ON OCCUPE CHEZ NOUS
   ============================================================

   Le miroir des médias et les décors ont désormais un plafond — sans
   quoi une place illimitée qu'on héberge est une facture illimitée. Un
   plafond qui ne se voit pas est un plafond qu'on découvre en le
   heurtant, c'est-à-dire au moment où l'on vient de déposer quelque
   chose et où l'on ne comprend pas pourquoi ça n'a pas marché.

   ELLE SE TAIT SUR UNE PANNE, comme la section des appareils juste
   au-dessus : hors ligne on ne sait pas, et un compteur inventé vaut
   moins que pas de compteur.

   CE QU'ELLE NE MONTRE PAS : les fiches. Ranger et noter ne se paient
   jamais et ne se bornent pas — les afficher ici, à côté de deux
   jauges, laisserait croire le contraire.
   ============================================================ */
function Usage() {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<UsageReport | null>(null);

  useEffect(() => {
    let alive = true;
    myUsage()
      .then((u) => alive && setUsage(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!usage) return null;

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>{t("account.usage")}</Label>
      <div style={{ marginTop: 6 }}>
        <Tally
          label={t("account.usageMedia")}
          value={`${usage.media} / ${usage.mediaCeiling}`}
          /* LE VERDICT SE DIT PAR UN MOT, PAS PAR UNE COULEUR — mais un
             compteur n'est pas un verdict. On teinte seulement quand il
             ne reste presque rien, et la phrase en dessous le dit. */
          ink={usage.media >= usage.mediaCeiling ? C.burgundy : undefined}
        />
        <Tally
          label={t("account.usageDecors")}
          value={`${usage.decors} / ${usage.decorCeiling}`}
          ink={usage.decors >= usage.decorCeiling ? C.burgundy : undefined}
        />
      </div>
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 15,
          color: C.inkFaded,
          marginTop: 6,
          lineHeight: 1.35,
        }}
      >
        {t("account.usageNote")}
      </div>
    </div>
  );
}

function Devices({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<DeviceKey[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    myKeys()
      .then((r) => alive && setKeys(r))
      /* Offline, or a server that is out: the heading stays mute rather
         than announcing a trouble one did not ask about. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!keys) return null;

  /* WHAT DISTINGUISHES A TELEPHONE FROM THIS COMPUTER, IN ONE WORD.
     `hybrid` is the transport of the QR ceremony: a key that announces it
     can be offered to a machine that has never seen it, which is the
     whole subject of this section. `internal` alone stays home. */
  const nameOf = (k: DeviceKey) =>
    k.device ||
    (k.transports.includes("hybrid") ? t("account.devicePhone") : t("account.deviceThisOne"));

  const add = async (where: "phone" | "here") => {
    setTrouble(null);
    setSaid(null);
    setBusy(true);
    try {
      setKeys(await addKey(name.trim() || undefined, where));
      setName("");
      setSaid(t("account.deviceAdded"));
    } catch (e) {
      const m = (e as Error).message || "";
      setTrouble(/NotAllowed|abort/i.test(m) ? t("account.cancelled") : m || t("account.failed"));
    } finally {
      setBusy(false);
    }
  };

  const forget = async (k: DeviceKey) => {
    setTrouble(null);
    setSaid(null);
    setBusy(true);
    try {
      setKeys(await forgetKey(k.id));
    } catch (e) {
      /* The refusal to remove the last key is the SERVER's sentence, and
         we show it as it stands. Repeating the rule here would make two
         copies of it, of which only one would stay true. */
      setTrouble((e as Error).message || t("account.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    /* No `data-tour` of its own: the tour cannot open this drawer on
       itself, so the step aims at the rail's account button and names
       what is inside — as sharing and the reminders already do. */
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>{t("account.devices")}</Label>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {keys.map((k) => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {k.transports.includes("hybrid") ? (
              <Smartphone size={13} style={{ flexShrink: 0, color: C.inkFaded }} aria-hidden />
            ) : (
              <Laptop size={13} style={{ flexShrink: 0, color: C.inkFaded }} aria-hidden />
            )}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: F.body,
                fontSize: 13,
                color: C.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nameOf(k)}
              <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                {"  "}
                {k.seen_at
                  ? t("account.deviceSeen", {
                      when: whenSaid(new Date(k.seen_at).getTime(), t, lang),
                    })
                  : t("account.deviceNeverSeen")}
              </span>
            </span>
            <button
              onClick={() => forget(k)}
              disabled={busy || keys.length < 2}
              aria-label={t("account.forgetDeviceOne", { device: nameOf(k) })}
              style={{
                all: "unset",
                ...tap,
                cursor: busy || keys.length < 2 ? "default" : "pointer",
                opacity: busy || keys.length < 2 ? 0.35 : 1,
                flexShrink: 0,
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: C.inkFaded,
                borderBottom: `1px dashed ${C.line}`,
              }}
            >
              {t("account.forgetDevice")}
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("account.deviceNamePlaceholder")}
          maxLength={60}
          style={{
            flex: 1,
            minWidth: 0,
            ...tap,
            padding: "8px 10px",
            background: C.card,
            border: `1px solid ${C.line}`,
            fontFamily: F.mono,
            fontSize: 11,
            color: C.ink,
          }}
        />
        <button onClick={() => add("phone")} disabled={busy} style={button(C.burgundy, busy)}>
          <Smartphone size={12} /> {busy ? t("account.addingDevice") : t("account.addDevice")}
        </button>
        {/* THE MACHINE ONE IS SITTING AT, which is what somebody wants
            immediately after arriving here with a pairing code. It asks
            the browser for the LOCAL sensor — offering a QR code for the
            computer under one's hands would be absurd. */}
        <button
          onClick={() => add("here")}
          disabled={busy}
          title={t("account.addThisDevice")}
          aria-label={t("account.addThisDevice")}
          style={{ ...button(C.slate, busy), padding: "8px 10px" }}
        >
          <Laptop size={12} />
        </button>
      </div>

      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 7 }}>
        {t("account.devicesNote")}
      </div>

      <Pairing />
      {keys.length < 2 && (
        <div
          style={{ fontFamily: F.mono, fontSize: 9, color: alpha(C.inkFaded, 0.75), marginTop: 6 }}
        >
          {t("account.deviceLastNote")}
        </div>
      )}
      {said && <div style={{ fontFamily: F.hand, fontSize: 16, color: C.pine }}>{said}</div>}
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy }}>{trouble}</div>
      )}
    </div>
  );
}

/* ============================================================
   A PAIRING CODE — the door the passkeys cannot open
   ============================================================

   A passkey is signed for a DOMAIN, which is what makes it unphishable
   and also what shuts an account inside one machine. On `localhost`
   each computer is its own domain: two machines at home have nothing in
   common to sign for, so the telephone and its QR code are of no use
   there whatsoever — the one case where somebody most obviously wants
   their binder on both screens.

   A code crosses that. It is worth an account for a week — long enough
   that one is not racing a timer to the other room — so it is shown
   once, here, and never kept: what the other machine gets from it is a
   session, and the first thing it should do with that session is
   register a passkey of its own, after which the code is of no further
   use to anybody.
   ============================================================ */
function Pairing() {
  const { t } = useTranslation();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const ask = async () => {
    setBusy(true);
    try {
      setCode((await makePairingCode()).code);
      setCopied(false);
    } catch {
      /* Offline: nothing to show, and nothing to apologise for. */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      {code ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              flex: 1,
              padding: "8px 10px",
              background: C.card,
              border: `1px dashed ${C.burgundy}`,
              fontFamily: F.mono,
              fontSize: 16,
              letterSpacing: 3,
              color: C.ink,
              textAlign: "center",
            }}
          >
            {code}
          </span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(code);
              setCopied(true);
            }}
            style={button(C.slate, false)}
          >
            {copied ? <Check size={12} /> : <LinkIcon size={12} />}
          </button>
        </div>
      ) : (
        <button onClick={ask} disabled={busy} style={button(C.ink, busy)}>
          <KeyRound size={12} /> {t("account.pairMake")}
        </button>
      )}
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
        {code ? t("account.pairMadeNote") : t("account.pairNote")}
      </div>
    </div>
  );
}

function Reminders() {
  const { t } = useTranslation();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const reread = () =>
    pushState()
      .then(setState)
      .catch(() => setState(null));

  useEffect(() => {
    reread();
  }, []);

  if (!state?.possible) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (state.subscribed) await unsubscribeFromPush();
      else await subscribeToPush();
    } finally {
      setBusy(false);
      await reread();
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>{t("account.reminders")}</Label>
      {state.denied ? (
        /* The refusal is final in most browsers: there is no second
           request to make, only a setting to reopen by hand. Saying so is
           better than a button that fails. */
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 4 }}>
          {t("account.notificationsDenied")}
        </div>
      ) : (
        <>
          <button onClick={toggle} disabled={busy} style={button(C.pine, state.subscribed)}>
            <Bell size={12} />{" "}
            {state.subscribed ? t("account.remindStop") : t("account.remindStart")}
          </button>
          <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
            {t("account.remindNote")}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   OÙ L'ON ACCEPTE D'ÊTRE CLASSÉ
   ------------------------------------------------------------

   À CÔTÉ DU PARTAGE, ET PAS CONFONDU AVEC LUI. « Je montre ma
   collection » et « je concours publiquement » ne sont pas la même
   phrase, et c'est pour cela que le serveur en fait deux colonnes plutôt
   qu'une. Les mettre dans le même bouton aurait publié un pseudonyme sur
   la foi d'une décision prise à propos d'autre chose.

   Le défaut est « ceux qui me suivent » : suivre quelqu'un est déjà un
   lien consenti, et un classement d'amis vide au premier jour est un
   classement qu'on ne rouvre pas.

   On lit avant d'écrire, comme le partage juste au-dessus — sans quoi le
   tiroir n'apprend votre réglage qu'au moment où vous le changez, donc
   trop tard pour vous aider à décider. */
function Standing() {
  const { t } = useTranslation();
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    myPurse()
      .then((p) => alive && setState(p.ladder))
      /* Hors ligne : on se tait plutôt que de marquer un état inventé. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const set = async (wanted: "non" | "suivis" | "tous") => {
    setBusy(true);
    try {
      const r = await setLadder(wanted);
      setState(r.ladder);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>{t("account.appearOnBoard")}</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {(
          [
            ["non", t("account.boardNobody")],
            ["suivis", t("account.boardFollowers")],
            ["tous", t("account.boardEveryone")],
          ] as ["non" | "suivis" | "tous", string][]
        ).map(([key, word]) => (
          <button
            key={key}
            disabled={busy}
            onClick={() => set(key)}
            style={{
              ...button(state === key ? C.ochre : C.ink, busy),
              background: state === key ? C.ochre : "transparent",
              color: state === key ? C.card : C.inkFaded,
              borderColor: state === key ? C.ochre : C.line,
            }}
          >
            {word}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
        {state === "non" && t("account.boardNobodyNote")}
        {state === "suivis" && t("account.boardFollowersNote")}
        {state === "tous" && t("account.boardEveryoneNote")}
      </div>
    </div>
  );
}

function Share() {
  const { t } = useTranslation();
  const [state, setState] = useState<Sharing | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  /* IT OPENED ON THREE BUTTONS OF WHICH NONE WAS MARKED. The write route
     existed alone: the drawer only learned your sharing mode at the
     moment you changed it — that is to say too late to help you decide,
     and at the price of a change you may not have wanted to make. We
     read first. */
  useEffect(() => {
    let alive = true;
    mySharing()
      .then((r) => {
        if (!alive) return;
        setState(r.sharing);
        setToken(r.token);
      })
      /* Offline: we stay mute rather than marking an invented state.
         Clicking a mode will set it and say so. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const address =
    state === "publique"
      ? `${location.origin}${location.pathname}#/chez/${pseudoOfThePage()}`
      : token
        ? `${location.origin}${location.pathname}#/chez/${pseudoOfThePage()}?jeton=${token}`
        : null;

  const set = async (wanted: Sharing) => {
    setBusy(true);
    try {
      const r = await setSharing(wanted);
      setState(r.sharing);
      setToken(r.token);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>{t("account.showCollection")}</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {(
          [
            ["privee", t("account.shareNobody")],
            ["lien", t("account.shareLink")],
            ["publique", t("account.shareEveryone")],
          ] as [Sharing, string][]
        ).map(([key, word]) => (
          <button
            key={key}
            disabled={busy}
            onClick={() => set(key)}
            style={{
              ...button(state === key ? C.burgundy : C.ink, busy),
              background: state === key ? C.burgundy : "transparent",
              color: state === key ? C.card : C.inkFaded,
              borderColor: state === key ? C.burgundy : C.line,
            }}
          >
            {word}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
        {state === null && t("account.shareDefaultNote")}
        {state === "privee" && t("account.shareNobodyNote")}
        {state === "lien" && t("account.shareLinkNote")}
        {state === "publique" && t("account.shareEveryoneNote")}
      </div>

      {address && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
          <input
            readOnly
            value={address}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1,
              minWidth: 0,
              ...tap,
              padding: "8px 10px",
              background: C.card,
              border: `1px solid ${C.line}`,
              fontFamily: F.mono,
              fontSize: 10,
              color: C.ink,
            }}
          />
          <button
            onClick={() => {
              navigator.clipboard?.writeText(address);
              setCopied(true);
            }}
            style={button(C.slate, false)}
          >
            {copied ? <Check size={12} /> : <LinkIcon size={12} />}{" "}
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      )}

      {/* WHAT NEVER LEAVES, SAID WHERE ONE DECIDES. Recalling it in the
          footer is not enough: it is HERE that one hesitates. */}
      <div
        style={{ fontFamily: F.mono, fontSize: 9, color: alpha(C.inkFaded, 0.75), marginTop: 8 }}
      >
        {t("account.shareNeverNote")}
      </div>
    </div>
  );
}

/* The handle is already shown at the head of the drawer: we re-read it
   from the document rather than passing it down as a prop through three
   components for a single address line. */
const pseudoOfThePage = (): string =>
  document.querySelector("[data-pseudo]")?.getAttribute("data-pseudo") || "";
