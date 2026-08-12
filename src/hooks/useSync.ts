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
import { serverConfigured } from "../services/server";
import type { Film } from "../types";

const RHYTHM_MS = 5 * 60 * 1000;

export function useSync(
  ready: boolean,
  onFilms: (films: Film[]) => void,
  /** Called when documents came in: up to the caller to re-read. */
  rereadDocuments: () => void
) {
  const [report, setReport] = useState<SyncReport>({
    state: serverConfigured() ? "no-account" : "absent",
    person: null,
    at: lastReport().at,
    pending: 0,
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

  const run = useCallback(async () => {
    if (!serverConfigured() || running.current) return;
    running.current = true;
    setReport((b) => ({ ...b, state: "running" }));
    try {
      const report = await synchronise((films) => onFilmsRef.current(films));
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

  return { report: { ...report, state, pending: waiting }, synchronise: run };
}
