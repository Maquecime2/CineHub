/* ============================================================
   THE INVITATION TO INSTALL — awaited, never provoked
   ============================================================

   The browser decides on its own that a site deserves installing, and it
   says so with an event, `beforeinstallprompt`. We cannot trigger it; we
   can only CATCH it and keep it aside, because once gone it does not
   come back. It is that retained event which will open the system's
   dialog, later, on a gesture of the hand.

   `preventDefault` cancels nothing: it only prevents the banner Chrome
   would lay down of its own accord, at the bottom of the screen, over
   the rail — so that the invitation comes from the binder and looks like
   it.

   IOS EMITS NOTHING, and that is half the phones. Over there no button
   is possible: only a sentence saying where to find "Add to Home Screen"
   in the share menu. */
import { useCallback, useEffect, useState } from "react";
import { isIOS, noteInstalled, noteDismissal, mayOffer } from "../services/installation";

/** What the browser passes in `beforeinstallprompt`. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface Installation {
  /** There is reason to show the invitation. */
  invite: boolean;
  /** On iOS, we explain instead of offering. */
  apple: boolean;
  /** Opens the system dialog. No effect on iOS. */
  install: () => Promise<void>;
  /** "No thanks" — twice, and we keep quiet for good. */
  dismiss: () => void;
}

export function useInstallation(): Installation {
  const [held, setHeld] = useState<InstallEvent | null>(null);
  const [invite, setInvite] = useState(false);
  const apple = isIOS();

  useEffect(() => {
    if (!mayOffer()) return;

    const onInvite = (e: Event) => {
      e.preventDefault();
      setHeld(e as InstallEvent);
      setInvite(true);
    };
    /* Installed from the invitation OR from the browser's menu: either
       way we have nothing left to offer. */
    const onInstalled = () => {
      noteInstalled();
      setInvite(false);
      setHeld(null);
    };

    window.addEventListener("beforeinstallprompt", onInvite);
    window.addEventListener("appinstalled", onInstalled);

    /* On iOS no event will ever come: it is up to us to open our mouth,
       and only if we have not already been shown the door. */
    if (apple) setInvite(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInvite);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [apple]);

  const install = useCallback(async () => {
    if (!held) return;
    await held.prompt();
    const { outcome } = await held.userChoice;
    /* Refusing the system dialog is not refusing the binder: we count
       that refusal as a "not now", and the event is consumed
       anyway. */
    if (outcome === "accepted") noteInstalled();
    else noteDismissal();
    setHeld(null);
    setInvite(false);
  }, [held]);

  const dismiss = useCallback(() => {
    noteDismissal();
    setInvite(false);
  }, []);

  return { invite, apple, install, dismiss };
}
