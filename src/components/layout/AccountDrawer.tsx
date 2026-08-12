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
import { useEffect, useState } from "react";
import {
  CloudOff,
  RefreshCw,
  LogOut,
  KeyRound,
  UserPlus,
  Check,
  X,
  Download,
  Trash2,
  Link as LinkIcon,
  Bell,
  VolumeX,
} from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../ui/Layer";
import { Label } from "../ui";
import { Confirmation, type ConfirmRequest } from "../ui/Confirmation";
import {
  ADDRESS,
  deleteMyAccount,
  myData,
  signIn,
  setSharing,
  mySharing,
  signOut,
  signUp,
  myBlocks,
  unblock,
  type Sharing,
  type Person,
} from "../../services/server";
import {
  pushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "../../services/push";
import { forgetSync } from "../../services/sync";
import type { SyncReport } from "../../services/sync";

const quandDit = (le: number | null): string => {
  if (!le) return "jamais encore";
  const seconds = Math.round((Date.now() - le) / 1000);
  if (seconds < 90) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  return new Date(le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

export function AccountDrawer({
  report,
  onFermer,
  onSync,
  onChangement,
}: {
  report: SyncReport;
  onFermer: () => void;
  onSync: () => void;
  /** The account has changed: the application must find its bearings again. */
  onChangement: (person: Person | null) => void;
}) {
  const [pseudo, setPseudo] = useState("");
  const [busy, setBusy] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const tenter = async (what: (p: string) => Promise<Person>) => {
    setSouci(null);
    setBusy(true);
    try {
      const who = await what(pseudo.trim().toLowerCase());
      /* AN ACCOUNT THAT CHANGES STARTS OVER. Keeping the old one's read
         cursor would make the binder believe it had already seen all of
         the new one's collection — which would stay invisible. */
      forgetSync();
      onChangement(who);
    } catch (e) {
      /* Refusing one's own fingerprint is not an error to dramatise: one
         changes one's mind, and that is all. */
      const m = (e as Error).message || "";
      setSouci(/NotAllowed|abort/i.test(m) ? "Geste annulé." : m || "Ça n'a pas marché.");
    } finally {
      setBusy(false);
    }
  };

  const signedIn = !!report.person;

  return (
    <Layer>
      <div
        onClick={onFermer}
        data-veil
        style={{ position: "fixed", inset: 0, zIndex: 59, background: alpha(C.ink, 0.45) }}
      />
      <div
        role="dialog"
        aria-label="Votre compte"
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
              {signedIn ? report.person!.pseudo : "Votre compte"}
            </span>
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            style={{ ...tap, all: "unset", cursor: "pointer", marginLeft: "auto" }}
          >
            <X size={16} color={C.inkFaded} />
          </button>
        </div>

        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginBottom: 20 }}>
          {signedIn
            ? "Votre collection se retrouve sur vos autres appareils."
            : "Un compte sert à retrouver votre collection ailleurs. Le classeur marche très bien sans."}
        </div>

        {/* ---- l'état ---- */}
        <Label>Synchronisation</Label>
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
            {report.state === "absent" && "Aucun serveur réglé."}
            {report.state === "no-account" && "Tout reste ici."}
            {report.state === "running" && "En cours…"}
            {report.state === "up-to-date" && `À jour, ${quandDit(report.at)}.`}
            {/* "0 CARDS ARE WAITING FOR THE NETWORK" MEANS NOTHING, and
                that is nonetheless what showed when the server was
                unreachable without our having changed anything: an empty
                countdown instead of the one useful piece of news. */}
            {report.state === "waiting" &&
              (report.pending === 0
                ? "Serveur injoignable. Rien à envoyer, rien de perdu."
                : `${report.pending} fiche${report.pending > 1 ? "s" : ""} attend${
                    report.pending > 1 ? "ent" : ""
                  } le réseau.`)}
            {report.state === "error" && (report.message || "Le serveur a refusé.")}
          </span>
          {signedIn && (
            <button
              onClick={onSync}
              title="Synchroniser maintenant"
              style={{ ...tap, all: "unset", cursor: "pointer", color: C.burgundy }}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* ---- entrer, ou partir ---- */}
        {!signedIn ? (
          <>
            <Label>Pseudonyme</Label>
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="agnes-varda"
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
              Pas de word de pass : votre téléphone ou votre ordinateur sign à votre place, withCrew
              ce qui le déverrouille existing.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                disabled={busy || pseudo.trim().length < 3}
                onClick={() => tenter(signUp)}
                style={button(C.burgundy, busy || pseudo.trim().length < 3)}
              >
                <UserPlus size={12} /> CRÉER UN COMPTE
              </button>
              <button disabled={busy} onClick={() => tenter(signIn)} style={button(C.ink, busy)}>
                <KeyRound size={12} /> J'EN AI DÉJÀ UN
              </button>
            </div>
            {souci && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: F.hand,
                  fontSize: 16,
                  color: C.burgundy,
                }}
              >
                {souci}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Share />

            <Blocks />

            <Reminders />

            <button
              onClick={async () => {
                await signOut();
                /* The collection STAYS: signing out is not being
                   dispossessed. Only the link with the server is cut. */
                forgetSync();
                onChangement(null);
              }}
              style={button(C.ink, false)}
            >
              <LogOut size={12} /> SE DÉCONNECTER
            </button>

            {/* ------------------------------------------------------
                WHAT IS YOURS, AND THE RIGHT TO LEAVE

                Both routes had existed since the server's first day and
                had no button at all: a right one cannot exercise with a
                finger is not a right, it is a line in a configuration
                file.
                ------------------------------------------------------ */}
            <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
              <Label>Vos données</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setSouci(null);
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
                      setSouci((e as Error).message || "L'export a échoué.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={button(C.slate, busy)}
                >
                  <Download size={12} /> TOUT EMPORTER
                </button>

                <button
                  disabled={busy}
                  onClick={() =>
                    setRequest({
                      title: "Effacer votre compte ?",
                      body: `La copie de votre collection sur le serveur est effacée, avec vos clés d'accès et vos sessions. Votre classeur, lui, reste entier sur cet appareil — mais vos autres appareils ne se synchroniseront plus.`,
                      action: "EFFACER LE COMPTE",
                      severe: true,
                      onConfirm: async () => {
                        setRequest(null);
                        setBusy(true);
                        try {
                          await deleteMyAccount();
                          forgetSync();
                          onChangement(null);
                        } catch (e) {
                          setSouci((e as Error).message || "L'effacement a échoué.");
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
                  <Trash2 size={12} /> EFFACER MON COMPTE
                </button>
              </div>
            </div>

            {souci && (
              <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy }}>{souci}</div>
            )}
          </div>
        )}

        <Confirmation request={request} onClose={() => setRequest(null)} />

        <div
          style={{
            marginTop: 24,
            fontFamily: F.mono,
            fontSize: 9.5,
            color: alpha(C.inkFaded, 0.7),
            lineHeight: 1.7,
          }}
        >
          {ADDRESS || "aucun serveur"}
          <br />
          {/* THIS SENTENCE SAID THE OPPOSITE OF WHAT HAPPENS, and I saw
              it lie by watching what actually left: the whole card is
              sent, notes and screenings included.

              That is as it should be: a note that does not follow onto
              the phone is a note lost. But it cannot be guessed, so it is
              said — and sharing, for its part, will send only the public
              part of the card (see `publicPart`). */}
          Votre collection entière est copiée sur votre count, notes et screenings comprises.
          Nothing n'est public : le partage se décide fiche par fiche, et n'emportera never vos
          notes.
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
  const [list, setListe] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reread = () =>
    myBlocks()
      .then((r) => setListe(r.blocages))
      /* With no server or offline: we stay quiet, we do not show an
         error for a heading that may have nothing to say. */
      .catch(() => setListe(null));

  useEffect(() => {
    reread();
  }, []);

  if (!list?.length) return null;

  const rendreLaParole = async (pseudo: string) => {
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
      <Label>Ceux que vous avez fait taire</Label>
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
              onClick={() => rendreLaParole(pseudo)}
              disabled={busy === pseudo}
              aria-label={`Rendre la parole à ${pseudo}`}
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
              RENDRE LA PAROLE
            </button>
          </div>
        ))}
      </div>
      {/* WHAT UNBLOCKING DOES NOT DO, and it is better said than left to
          be guessed: the server resubscribes nobody. The link was undone
          at the blocking; we reopen a door, we do not call somebody
          back. */}
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 7 }}>
        Leurs critiques reparaîtront sous les fiches. Vous ne les suivrez pas pour autant — le
        blocage avait défait le lien, et le défaire ne le renoue pas.
      </div>
    </div>
  );
}

function Reminders() {
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
      <Label>Les rappels</Label>
      {state.denied ? (
        /* The refusal is final in most browsers: there is no second
           request to make, only a setting to reopen by hand. Saying so is
           better than a button that fails. */
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 4 }}>
          Ce navigateur a refusé les notifications. Cela se rouvre dans ses réglages de site, pas
          ici.
        </div>
      ) : (
        <>
          <button onClick={toggle} disabled={busy} style={button(C.pine, state.subscribed)}>
            <Bell size={12} /> {state.subscribed ? "NE PLUS ME RAPPELER" : "ME RAPPELER MES DÉFIS"}
          </button>
          <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
            Un défi qui commence, un défi qui s'achève — rien d'autre ne vous sonnera. Le réglage
            vaut pour cet appareil seulement.
          </div>
        </>
      )}
    </div>
  );
}

function Share() {
  const [state, setState] = useState<Sharing | null>(null);
  const [token, setJeton] = useState<string | null>(null);
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
        setState(r.partage);
        setJeton(r.token);
      })
      /* Offline: we stay mute rather than marking an invented state.
         Clicking a mode will set it and say so. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const adresse =
    state === "publique"
      ? `${location.origin}${location.pathname}#/chez/${pseudoDeLaPage()}`
      : token
        ? `${location.origin}${location.pathname}#/chez/${pseudoDeLaPage()}?jeton=${token}`
        : null;

  const set = async (voulu: Sharing) => {
    setBusy(true);
    try {
      const r = await setSharing(voulu);
      setState(r.partage);
      setJeton(r.token);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>Montrer ma collection</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        {(
          [
            ["privee", "PERSONNE"],
            ["lien", "PAR LIEN"],
            ["publique", "TOUT LE MONDE"],
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
        {state === null && "Par défaut, personne ne voit votre collection."}
        {state === "privee" && "Personne. Les liens déjà donnés ne valent plus rien."}
        {state === "lien" && "Qui a le lien. Il ne se devine pas, et se coupe quand vous voulez."}
        {state === "publique" && "Qui connaît votre pseudonyme."}
      </div>

      {adresse && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
          <input
            readOnly
            value={adresse}
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
              navigator.clipboard?.writeText(adresse);
              setCopied(true);
            }}
            style={button(C.slate, false)}
          >
            {copied ? <Check size={12} /> : <LinkIcon size={12} />} {copied ? "COPIÉ" : "COPIER"}
          </button>
        </div>
      )}

      {/* WHAT NEVER LEAVES, SAID WHERE ONE DECIDES. Recalling it in the
          footer is not enough: it is HERE that one hesitates. */}
      <div
        style={{ fontFamily: F.mono, fontSize: 9, color: alpha(C.inkFaded, 0.75), marginTop: 8 }}
      >
        Vos notes et votre journal de séances ne sont jamais montrés.
      </div>
    </div>
  );
}

/* The handle is already shown at the head of the drawer: we re-read it
   from the document rather than passing it down as a prop through three
   components for a single address line. */
const pseudoDeLaPage = (): string =>
  document.querySelector("[data-pseudo]")?.getAttribute("data-pseudo") || "";
