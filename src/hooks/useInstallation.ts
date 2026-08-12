/* ============================================================
   L'INVITATION À INSTALLER — attendue, jamais provoquée
   ============================================================

   Le navigateur décide seul qu'un site mérite d'être installé, et il le
   dit par un événement, `beforeinstallprompt`. On ne peut pas le
   déclencher ; on peut seulement l'ATTRAPER et le garder de côté, parce
   qu'une fois passé il ne revient pas. C'est cet événement retenu qui
   ouvrira la boîte du système, plus tard, sur un geste de la main.

   `preventDefault` n'annule rien : il empêche seulement la bannière que
   Chrome poserait de lui-même, en bas de l'écran, par-dessus le rail —
   pour que l'invitation vienne du classeur et lui ressemble.

   IOS N'ÉMET RIEN, et c'est la moitié des téléphones. Là-bas il n'y a
   pas de bouton possible : seulement une phrase qui dit où trouver
   « Sur l'écran d'accueil » dans le menu de partage. */
import { useCallback, useEffect, useState } from "react";
import { isIOS, noteInstalled, noteDismissal, mayOffer } from "../services/installation";

/** Ce que le navigateur passe dans `beforeinstallprompt`. */
interface ÉvénementInstall extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface Installation {
  /** L'invitation a lieu d'être montrée. */
  invite: boolean;
  /** Sur iOS, on explique au lieu de proposer. */
  pomme: boolean;
  /** Ouvre la boîte du système. Sans effet sur iOS. */
  installer: () => Promise<void>;
  /** « Non merci » — deux fois, et on se tait pour de bon. */
  écarter: () => void;
}

export function useInstallation(): Installation {
  const [attendu, setAttendu] = useState<ÉvénementInstall | null>(null);
  const [invite, setInvite] = useState(false);
  const pomme = isIOS();

  useEffect(() => {
    if (!mayOffer()) return;

    const surInvite = (e: Event) => {
      e.preventDefault();
      setAttendu(e as ÉvénementInstall);
      setInvite(true);
    };
    /* Installée depuis l'invitation OU depuis le menu du navigateur : dans
       les deux cas on n'a plus rien à proposer. */
    const surPosée = () => {
      noteInstalled();
      setInvite(false);
      setAttendu(null);
    };

    window.addEventListener("beforeinstallprompt", surInvite);
    window.addEventListener("appinstalled", surPosée);

    /* Sur iOS, aucun événement ne viendra jamais : c'est à nous
       d'ouvrir la bouche, et seulement si l'on n'a pas déjà été
       éconduit. */
    if (pomme) setInvite(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", surInvite);
      window.removeEventListener("appinstalled", surPosée);
    };
  }, [pomme]);

  const installer = useCallback(async () => {
    if (!attendu) return;
    await attendu.prompt();
    const { outcome } = await attendu.userChoice;
    /* Refuser la boîte du système n'est pas refuser le classeur : on
       compte ce refus comme un « pas maintenant », et l'événement est
       consommé de toute façon. */
    if (outcome === "accepted") noteInstalled();
    else noteDismissal();
    setAttendu(null);
    setInvite(false);
  }, [attendu]);

  const écarter = useCallback(() => {
    noteDismissal();
    setInvite(false);
  }, []);

  return { invite, pomme, installer, écarter };
}
