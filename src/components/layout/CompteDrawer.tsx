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
import { useState } from "react";
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
} from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Calque } from "../ui/Calque";
import { Label } from "../ui";
import { Confirmation, type DemandeConfirmation } from "../ui/Confirmation";
import {
  ADRESSE,
  effacerMonCompte,
  mesDonnees,
  seConnecter,
  seDeconnecter,
  sInscrire,
  type Personne,
} from "../../services/serveur";
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
  onChangement: (personne: Personne | null) => void;
}) {
  const [pseudo, setPseudo] = useState("");
  const [occupé, setOccupé] = useState(false);
  const [souci, setSouci] = useState<string | null>(null);
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);

  const tenter = async (quoi: (p: string) => Promise<Personne>) => {
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
            {connecté ? bilan.personne!.pseudo : "Votre compte"}
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
            {bilan.état === "en-attente" &&
              `${bilan.enAttente} fiche${bilan.enAttente > 1 ? "s" : ""} attend${
                bilan.enAttente > 1 ? "ent" : ""
              } le réseau.`}
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
                    setDemande({
                      titre: "Effacer votre compte ?",
                      corps: `La copie de votre collection sur le serveur est effacée, avec vos clés d'accès et vos sessions. Votre classeur, lui, reste entier sur cet appareil — mais vos autres appareils ne se synchroniseront plus.`,
                      action: "EFFACER LE COMPTE",
                      grave: true,
                      onConfirm: async () => {
                        setDemande(null);
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

        <Confirmation demande={demande} onClose={() => setDemande(null)} />

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
              part publique de la fiche (voir `partiePublique`). */}
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
