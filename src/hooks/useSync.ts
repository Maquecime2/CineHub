/* ============================================================
   THE RHYTHM OF SYNCHRONISATION
   ============================================================

   When it fires, and never more often than needed:

   — on opening, once the binder is loaded;
   — when the network comes back, because that is the exact moment what
     was waiting can finally go;
   — when the tab becomes visible again, because we are coming back from
     elsewhere and another device may have spoken;
   — and every five minutes, for want of anything better.

   NOT ON EVERY WRITE, and deliberately so: we write on every keystroke
   in a review. One synchronisation per keystroke would make every note a
   network round trip, and every outage an error message. What is waiting
   goes out on the next pass — that is the whole point of having a
   waiting list rather than an immediate send.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { lastReport, pending, synchronise, type SyncReport } from "../services/sync";
import { serverConfigured, lastKnownPerson, type Person } from "../services/server";
import type { Film } from "../types";

const RHYTHM_MS = 5 * 60 * 1000;

export function useSync(
  ready: boolean,
  onFilms: (films: Film[]) => void,
  /** Called when documents came in: up to the caller to re-read. */
  rereadDocuments: () => void
) {
  const [report, setReport] = useState<SyncReport>(() => {
    if (!serverConfigured()) {
      return { state: "absent", person: null, at: lastReport().at, pending: 0 };
    }
    /* "EVERYTHING STAYS HERE" MEANS "YOU HAVE NO ACCOUNT", and saying it
       to somebody who has one — for the second or two before the first
       round trip answers — is the same lie the drawer used to tell after
       signing in. If we remember a person, we are waiting, not alone. */
    const known = lastKnownPerson();
    return {
      state: known ? "running" : "no-account",
      person: known,
      at: lastReport().at,
      pending: 0,
    };
  });

  /* `onFilms` changes on every render of the application: keeping it in
     a ref avoids restarting the loop each time. */
  const onFilmsRef = useRef(onFilms);
  const rereadRef = useRef(rereadDocuments);
  useEffect(() => {
    onFilmsRef.current = onFilms;
    rereadRef.current = rereadDocuments;
  }, [onFilms, rereadDocuments]);
  const running = useRef(false);

  /* ============================================================
     WHO ONE IS DOES NOT WAIT FOR THE ROUND TRIP
     ============================================================

     Signing in used to leave the drawer showing the sign-up form —
     handle field, "create an account", "sign in" — to somebody who had
     just signed in, and it stayed that way until a whole synchronisation
     had pulled, pushed and come back. On a full collection that is
     seconds; offline it was for ever, because a failed round trip
     answered `person: null` and the screen took that for "nobody".

     The cause was that `report.person` was the only place the answer
     lived, and only `synchronise` wrote there. So the account is held
     HERE now, as its own state, fed from two sides:

       - the gesture, the instant it succeeds (`noteAccount`), because
         at that point we know perfectly well who it is;
       - the round trip, which corrects it.

     AND A REPORT THAT BRINGS NO PERSON DOES NOT ALWAYS MEAN "NOBODY".
     `sync.ts` already draws that distinction and it must not be lost
     here: a network that did not answer leaves the account as it was, a
     server that ANSWERED 401 clears it. Reading `null` as "signed out"
     in both cases is what logged people out of their own screen every
     time a train went into a tunnel. */
  const [account, setAccount] = useState<Person | null>(() =>
    /* SEEDED FROM DISK, so that a reload does not begin by denying who
       one is. Same hunch as `accountOpen()` in `server.ts`, and same
       correction: `whoAmI` is authoritative on the first round trip, and
       clears this if the server answers that we are nobody. It grants
       nothing — the cookie opens doors, not this. */
    serverConfigured() ? lastKnownPerson() : null
  );

  const noteAccount = useCallback((person: Person | null) => {
    setAccount(person);
    setReport((b) => ({ ...b, person, state: person ? "running" : "no-account" }));
  }, []);

  const run = useCallback(async () => {
    if (!serverConfigured() || running.current) return;
    running.current = true;
    setReport((b) => ({ ...b, state: "running" }));
    try {
      const report = await synchronise((films) => onFilmsRef.current(films));
      /* "waiting" is the offline state: the server said nothing, so it
         said nothing about who we are either. */
      if (report.person) setAccount(report.person);
      else if (report.state !== "waiting") setAccount(null);
      setReport(report);
      if (report.documentsIn) rereadRef.current();
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!ready || !serverConfigured()) return;
    run();

    const onOnline = () => run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(run, RHYTHM_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [ready, run]);

  /* The count of what is waiting is re-read on every render: it changes
     when we write, not when the network speaks. */
  const waiting = serverConfigured() ? pending() : 0;

  /* "UP TO DATE" CANNOT BE TRUE IF THERE IS STILL SOMETHING TO SAY.

     The report dates from the last round; we write between two rounds.
     So the drawer announced "up to date, just now" with a card waiting
     and the server switched off — technically an account of the last
     pass, practically a lie. The state displayed is deduced from what is
     waiting, not from what happened a while ago. */
  const state = report.state === "up-to-date" && waiting > 0 ? "waiting" : report.state;

  return {
    /* `account` overrides the report's own person for the reason above:
       it is the one that survives a round trip that could not be made. */
    report: { ...report, person: account ?? report.person, state, pending: waiting },
    synchronise: run,
    noteAccount,
  };
}
