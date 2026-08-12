/* ============================================================
   LE TIROIR DU COMPTE — ce que le classeur dit du dehors
   ============================================================

   Un seul endroit pour trois choses qui vont ensemble : qui l'on est,
   ce qui a été synchronisé, et ce qui attend encore. Les éparpiller —
   l'état dans le rail, le compte dans les réglages — obligerait à
   chercher la mauvaise nouvelle à deux endroits.

   LE TON N'EST PAS CELUI D'UN SERVICE EN LIGNE. « Hors ligne » n'est
   pas une panne ici, c'est le fonctionnement normal d'un classeur qui
   vit chez soi. On dit donc ce qui attend, pas ce qui manque.
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
import { Calque } from "../ui/Calque";
import { Label } from "../ui";
import { Confirmation, type ConfirmRequest } from "../ui/Confirmation";
import {
  ADRESSE,
  effacerMonCompte,
  mesDonnees,
  seConnecter,
  reglerLePartage,
  monPartage,
  seDeconnecter,
  sInscrire,
  mesBlocages,
  debloquer,
  type Partage,
  type Person,
} from "../../services/serveur";
import {
  pushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "../../services/push";
import { oublierLaSynchro } from "../../services/synchro";
import type { Bilan } from "../../services/synchro";

const quandDit = (le: number | null): string => {
  if (!le) return "jamais encore";
  const secondes = Math.round((Date.now() - le) / 1000);
  if (secondes < 90) return "à l'instant";
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} minutes`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} heure${heures > 1 ? "s" : ""}`;
  return new Date(le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

export function CompteDrawer({
  bilan,
  onFermer,
  onSynchroniser,
  onChangement,
}: {
  bilan: Bilan;
  onFermer: () => void;
  onSynchroniser: () => void;
  /** Le compte a changé : l'application doit se resituer. */
  onChangement: (personne: Person | null) => void;
}) {
  const [pseudo, setPseudo] = useState("");
  const [occupé, setOccupé] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const tenter = async (quoi: (p: string) => Promise<Person>) => {
    setSouci(null);
    setOccupé(true);
    try {
      const personne = await quoi(pseudo.trim().toLowerCase());
      /* UN COMPTE QUI CHANGE REPART DE ZÉRO. Garder le rang de lecture
         de l'ancien ferait croire au classeur qu'il a déjà tout vu de la
         collection du nouveau — qui resterait invisible. */
      oublierLaSynchro();
      onChangement(personne);
    } catch (e) {
      /* Refuser sa propre empreinte n'est pas une erreur à dramatiser :
         on se ravise, et c'est tout. */
      const m = (e as Error).message || "";
      setSouci(/NotAllowed|abort/i.test(m) ? "Geste annulé." : m || "Ça n'a pas marché.");
    } finally {
      setOccupé(false);
    }
  };

  const connecté = !!bilan.personne;

  return (
    <Calque>
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
            <span data-pseudo={connecté ? bilan.personne!.pseudo : undefined}>
              {connecté ? bilan.personne!.pseudo : "Votre compte"}
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
          {connecté
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
          {bilan.état === "à-jour" && <Check size={14} color={C.pine} />}
          {bilan.état === "en-attente" && <CloudOff size={14} color={C.inkFaded} />}
          {bilan.état === "en-cours" && <RefreshCw size={14} color={C.inkFaded} />}
          <span style={{ flex: 1 }}>
            {bilan.état === "absent" && "Aucun serveur réglé."}
            {bilan.état === "hors-compte" && "Tout reste ici."}
            {bilan.état === "en-cours" && "En cours…"}
            {bilan.état === "à-jour" && `À jour, ${quandDit(bilan.le)}.`}
            {/* « 0 FICHE ATTEND LE RÉSEAU » NE VEUT RIEN DIRE, et c'est
                pourtant ce qui s'affichait quand le serveur était
                injoignable sans qu'on ait rien modifié : un compte à
                rebours vide au lieu de la seule information utile. */}
            {bilan.état === "en-attente" &&
              (bilan.enAttente === 0
                ? "Serveur injoignable. Rien à envoyer, rien de perdu."
                : `${bilan.enAttente} fiche${bilan.enAttente > 1 ? "s" : ""} attend${
                    bilan.enAttente > 1 ? "ent" : ""
                  } le réseau.`)}
            {bilan.état === "erreur" && (bilan.message || "Le serveur a refusé.")}
          </span>
          {connecté && (
            <button
              onClick={onSynchroniser}
              title="Synchroniser maintenant"
              style={{ ...tap, all: "unset", cursor: "pointer", color: C.burgundy }}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {/* ---- entrer, ou partir ---- */}
        {!connecté ? (
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
              {/* On explique la clé d'accès en une phrase : personne ne
                  doit avoir à savoir ce qu'est WebAuthn pour s'inscrire. */}
              Pas de mot de passe : votre téléphone ou votre ordinateur signe à votre place, avec ce
              qui le déverrouille déjà.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                disabled={occupé || pseudo.trim().length < 3}
                onClick={() => tenter(sInscrire)}
                style={bouton(C.burgundy, occupé || pseudo.trim().length < 3)}
              >
                <UserPlus size={12} /> CRÉER UN COMPTE
              </button>
              <button
                disabled={occupé}
                onClick={() => tenter(seConnecter)}
                style={bouton(C.ink, occupé)}
              >
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
            <Partager />

            <Blocages />

            <Rappels />

            <button
              onClick={async () => {
                await seDeconnecter();
                /* La collection RESTE : se déconnecter n'est pas se
                   déposséder. Seul le lien avec le serveur se coupe. */
                oublierLaSynchro();
                onChangement(null);
              }}
              style={bouton(C.ink, false)}
            >
              <LogOut size={12} /> SE DÉCONNECTER
            </button>

            {/* ------------------------------------------------------
                CE QUI EST À VOUS, ET LE DROIT DE PARTIR

                Les deux routes existaient depuis le premier jour du
                serveur et n'avaient aucun bouton : un droit qu'on ne
                peut pas exercer d'un doigt n'est pas un droit, c'est une
                ligne dans un fichier de configuration.
                ------------------------------------------------------ */}
            <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
              <Label>Vos données</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <button
                  disabled={occupé}
                  onClick={async () => {
                    setSouci(null);
                    setOccupé(true);
                    try {
                      const tout = await mesDonnees();
                      /* Un fichier, pas un écran : ce qu'on emporte doit
                         pouvoir être relu ailleurs, et dans dix ans. */
                      const lien = document.createElement("a");
                      lien.href = URL.createObjectURL(
                        new Blob([JSON.stringify(tout, null, 2)], { type: "application/json" })
                      );
                      lien.download = `cine-hub-${bilan.personne!.pseudo}.json`;
                      lien.click();
                      URL.revokeObjectURL(lien.href);
                    } catch (e) {
                      setSouci((e as Error).message || "L'export a échoué.");
                    } finally {
                      setOccupé(false);
                    }
                  }}
                  style={bouton(C.slate, occupé)}
                >
                  <Download size={12} /> TOUT EMPORTER
                </button>

                <button
                  disabled={occupé}
                  onClick={() =>
                    setRequest({
                      title: "Effacer votre compte ?",
                      body: `La copie de votre collection sur le serveur est effacée, avec vos clés d'accès et vos sessions. Votre classeur, lui, reste entier sur cet appareil — mais vos autres appareils ne se synchroniseront plus.`,
                      action: "EFFACER LE COMPTE",
                      severe: true,
                      onConfirm: async () => {
                        setRequest(null);
                        setOccupé(true);
                        try {
                          await effacerMonCompte();
                          oublierLaSynchro();
                          onChangement(null);
                        } catch (e) {
                          setSouci((e as Error).message || "L'effacement a échoué.");
                        } finally {
                          setOccupé(false);
                        }
                      },
                    })
                  }
                  style={{
                    ...bouton(C.burgundy, occupé),
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
          {ADRESSE || "aucun serveur"}
          <br />
          {/* CETTE PHRASE DISAIT LE CONTRAIRE DE CE QUI SE PASSE, et je
              l'ai vue mentir en regardant ce qui partait vraiment : la
              fiche entière est envoyée, notes et séances comprises.

              C'est ce qu'il faut : une note qui ne suit pas sur le
              téléphone est une note perdue. Mais cela ne se devine pas,
              donc cela se dit — et le partage, lui, n'enverra que la
              part publique de la fiche (voir `publicPart`). */}
          Votre collection entière est copiée sur votre compte, notes et séances comprises. Rien
          n'est public : le partage se décide fiche par fiche, et n'emportera jamais vos notes.
        </div>
      </div>
    </Calque>
  );
}

const bouton = (encre: string, éteint: boolean) => ({
  all: "unset" as const,
  ...tap,
  cursor: éteint ? "default" : "pointer",
  opacity: éteint ? 0.45 : 1,
  gap: 6,
  padding: "8px 14px",
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  color: C.card,
  background: encre,
  border: `1px solid ${encre}`,
});

/* ============================================================
   MONTRER SA COLLECTION — trois états, et pas deux
   ============================================================

   « Public » ou « privé » ne dit pas ce qu'on veut vraiment faire :
   montrer sa vidéothèque à quelqu'un sans l'afficher au monde. D'où le
   lien secret, qui est le cas le plus fréquent et le plus utile.

   LE RÉGLAGE VIT SUR LE SERVEUR, pas ici : c'est lui qui décidera de
   répondre ou non à un inconnu, et une préférence rangée dans le
   navigateur n'aurait aucune prise sur cette décision-là.
   ============================================================ */
/* ============================================================
   LES RAPPELS DE DÉFI
   ============================================================

   LE SEUL PRÉTEXTE À SONNER DE TOUT CE PROJET : un défi qui commence,
   un défi qui s'achève. Pas de « quelqu'un que vous suivez a noté un
   film », pas de « revenez, votre collection vous attend ». Une
   application qui se trouve des motifs de sonner finit désinstallée.

   LE RÉGLAGE NE PARAÎT PAS S'IL NE PEUT RIEN FAIRE. Il faut un
   serveur, des clés posées dessus, un service worker et la permission
   du système ; trois de ces quatre conditions échappent à
   l'application. Un interrupteur qui ne fait rien serait pire que son
   absence.

   L'ABONNEMENT EST CELUI DE CET APPAREIL, et le texte le dit : la même
   personne sur un téléphone et un ordinateur les règle deux fois, ce
   qui est exactement ce qu'on veut — on n'a pas envie d'être sonné sur
   son ordinateur de travail parce qu'on l'a accepté sur son téléphone.
   ============================================================ */
/* ============================================================
   CEUX QU'ON A FAIT TAIRE — et le droit de se raviser
   ============================================================

   `Ailleurs`, sur une fiche, sait faire taire l'auteur d'une critique
   d'un geste. Ce geste marchait, il était même testé de bout en bout —
   et il était SANS RETOUR : rien, nulle part, ne disait qui l'on avait
   bloqué, et aucun écran n'appelait `debloquer`. Les deux fonctions
   existaient côté client, la route côté serveur, la table dans le
   schéma. Il manquait quinze lignes de tiroir.

   Un geste qu'on ne peut pas défaire n'est pas un réglage, c'est un
   accident qui attend. On le répare ici plutôt que d'enlever le bouton
   d'en face : faire taire quelqu'un est légitime, ne plus pouvoir
   revenir dessus ne l'est pas.

   LA SECTION SE TAIT QUAND LA LISTE EST VIDE, comme les rappels
   au-dessus : il n'y a rien à défaire, et une rubrique « personne » sur
   un sujet pareil n'apprend rien à personne. */
function Blocages() {
  const [liste, setListe] = useState<string[] | null>(null);
  const [occupé, setOccupé] = useState<string | null>(null);

  const relire = () =>
    mesBlocages()
      .then((r) => setListe(r.blocages))
      /* Sans serveur ou hors ligne : on se tait, on n'affiche pas une
         erreur pour une rubrique qui n'a peut-être rien à dire. */
      .catch(() => setListe(null));

  useEffect(() => {
    relire();
  }, []);

  if (!liste?.length) return null;

  const rendreLaParole = async (pseudo: string) => {
    setOccupé(pseudo);
    try {
      await debloquer(pseudo);
    } finally {
      setOccupé(null);
      await relire();
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>Ceux que vous avez fait taire</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {liste.map((pseudo) => (
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
              disabled={occupé === pseudo}
              aria-label={`Rendre la parole à ${pseudo}`}
              style={{
                all: "unset",
                ...tap,
                cursor: occupé === pseudo ? "default" : "pointer",
                opacity: occupé === pseudo ? 0.45 : 1,
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
      {/* CE QUE DÉBLOQUER NE FAIT PAS, et il vaut mieux le dire que le
          laisser deviner : le serveur ne réabonne personne. Le lien a été
          défait au blocage ; on rouvre une porte, on ne rappelle pas
          quelqu'un. */}
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 7 }}>
        Leurs critiques reparaîtront sous les fiches. Vous ne les suivrez pas pour autant — le
        blocage avait défait le lien, et le défaire ne le renoue pas.
      </div>
    </div>
  );
}

function Rappels() {
  const [état, setÉtat] = useState<PushState | null>(null);
  const [occupé, setOccupé] = useState(false);

  const relire = () =>
    pushState()
      .then(setÉtat)
      .catch(() => setÉtat(null));

  useEffect(() => {
    relire();
  }, []);

  if (!état?.possible) return null;

  const basculer = async () => {
    setOccupé(true);
    try {
      if (état.subscribed) await unsubscribeFromPush();
      else await subscribeToPush();
    } finally {
      setOccupé(false);
      await relire();
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 14 }}>
      <Label>Les rappels</Label>
      {état.denied ? (
        /* Le refus est définitif dans la plupart des navigateurs : il
           n'y a pas de seconde request à faire, seulement un réglage à
           rouvrir à la main. Le dire vaut mieux qu'un bouton qui
           échoue. */
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 4 }}>
          Ce navigateur a refusé les notifications. Cela se rouvre dans ses réglages de site, pas
          ici.
        </div>
      ) : (
        <>
          <button onClick={basculer} disabled={occupé} style={bouton(C.pine, état.subscribed)}>
            <Bell size={12} /> {état.subscribed ? "NE PLUS ME RAPPELER" : "ME RAPPELER MES DÉFIS"}
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

function Partager() {
  const [état, setÉtat] = useState<Partage | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [occupé, setOccupé] = useState(false);
  const [copié, setCopié] = useState(false);

  /* IL OUVRAIT SUR TROIS BOUTONS DONT AUCUN N'ÉTAIT MARQUÉ. La route
     d'écriture existait seule : le tiroir n'apprenait votre mode de
     partage qu'au moment où vous en changiez — c'est-à-dire trop tard
     pour vous aider à décider, et au prix d'un changement qu'on ne
     voulait peut-être pas faire. On lit d'abord. */
  useEffect(() => {
    let vivant = true;
    monPartage()
      .then((r) => {
        if (!vivant) return;
        setÉtat(r.partage);
        setJeton(r.jeton);
      })
      /* Hors ligne : on reste muet plutôt que de marquer un état
         inventé. Cliquer un mode le réglera et le dira. */
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  const adresse =
    état === "publique"
      ? `${location.origin}${location.pathname}#/chez/${pseudoDeLaPage()}`
      : jeton
        ? `${location.origin}${location.pathname}#/chez/${pseudoDeLaPage()}?jeton=${jeton}`
        : null;

  const régler = async (voulu: Partage) => {
    setOccupé(true);
    try {
      const r = await reglerLePartage(voulu);
      setÉtat(r.partage);
      setJeton(r.jeton);
      setCopié(false);
    } finally {
      setOccupé(false);
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
          ] as [Partage, string][]
        ).map(([clé, mot]) => (
          <button
            key={clé}
            disabled={occupé}
            onClick={() => régler(clé)}
            style={{
              ...bouton(état === clé ? C.burgundy : C.ink, occupé),
              background: état === clé ? C.burgundy : "transparent",
              color: état === clé ? C.card : C.inkFaded,
              borderColor: état === clé ? C.burgundy : C.line,
            }}
          >
            {mot}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
        {état === null && "Par défaut, personne ne voit votre collection."}
        {état === "privee" && "Person. Les liens déjà donnés ne valent plus rien."}
        {état === "lien" && "Qui a le lien. Il ne se devine pas, et se coupe quand vous voulez."}
        {état === "publique" && "Qui connaît votre pseudonyme."}
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
              setCopié(true);
            }}
            style={bouton(C.slate, false)}
          >
            {copié ? <Check size={12} /> : <LinkIcon size={12} />} {copié ? "COPIÉ" : "COPIER"}
          </button>
        </div>
      )}

      {/* CE QUI NE PART JAMAIS, DIT LÀ OÙ ON DÉCIDE. Le rappeler dans le
          bas de page ne suffit pas : c'est ICI qu'on hésite. */}
      <div
        style={{ fontFamily: F.mono, fontSize: 9, color: alpha(C.inkFaded, 0.75), marginTop: 8 }}
      >
        Vos notes et votre journal de séances ne sont jamais montrés.
      </div>
    </div>
  );
}

/* Le pseudonyme s'affiche déjà en tête du tiroir : on le relit dans le
   document plutôt que de le faire descendre en prop à travers trois
   composants pour une seule ligne d'adresse. */
const pseudoDeLaPage = (): string =>
  document.querySelector("[data-pseudo]")?.getAttribute("data-pseudo") || "";
