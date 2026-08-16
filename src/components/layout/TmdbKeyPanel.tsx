/* ============================================================
   THE TMDB KEY — the setting drawer

   It could only be set in the "Letterboxd Import" tab, in the middle of a
   screen that speaks of something else, and nobody went looking for it
   there in order to make Discoveries work. A setting that commands eight
   screens belongs to none of them: it is at the foot of the rail, beside
   the site skin and the tour, with the other settings of everything.

   The Import drawer stays — it is useful just where one decides to
   enrich an import — but it writes to the same place as this one.
   ============================================================ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { X, KeyRound, Check, Loader2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { checkApiKey } from "../../tmdb";
import { writtenKey, setTmdbKey } from "../../services/tmdbKey";
import { accountOpen, relayServesTmdb } from "../../services/server";
import { useDialog } from "../../hooks/useDialog";

/* The same band as the skin picker: they are two drawers of the same
   rail, and the `z-index` budget reserves 59–60 for them. */
const PANEL: CSSProperties = {
  position: "fixed",
  right: 40,
  top: 90,
  zIndex: 60,
  width: 330,
  maxHeight: "calc(100vh - 140px)",
  overflowY: "auto",
  padding: "14px 16px",
  background: C.card,
  border: `1px solid ${C.line}`,
  boxShadow: "2px 8px 24px rgba(20,14,8,0.4)",
};

/* The state of the check. "Not tried yet" is not "wrong": confusing the
   two would cry error in front of an untouched field. */
type Attempt = { state: "repos" | "essai" | "bonne" | "mauvaise"; message?: string };

export function TmdbKeyPanel({ onClose }: { onClose: () => void }) {
  /* Le focus entre, tourne, et revient au bouton d'ouverture. */
  const box = useDialog();
  const { t } = useTranslation();
  const [key, setKey] = useState(writtenKey);
  /* Asked once, and only when there is somebody to ask for: the relay
     refuses anyone who is not signed in, so its key is of no use to a
     visitor either way. */
  const [relayServes, setRelayServes] = useState(false);
  useEffect(() => {
    if (!accountOpen()) return;
    let alive = true;
    relayServesTmdb()
      .then((yes) => alive && setRelayServes(yes))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [essai, setEssai] = useState<Attempt>({ state: "repos" });

  /* Escape closes, as everywhere else: a drawer one can only close with
     the mouse is one drawer too many for whoever navigates by keyboard. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* WE TRY BEFORE SAVING. A wrong key saved without a word gives eight
     screens each failing in its own corner, and nothing to point at the
     cause. An EMPTY key, for its part, is saved without a try: that is a
     deliberate erasure, not an attempt. */
  const lay = async () => {
    const clean = key.trim();
    if (!clean) {
      setTmdbKey("");
      setEssai({ state: "repos" });
      return;
    }
    setEssai({ state: "essai" });
    try {
      /* `checkApiKey` returns `{ ok, error }` and NOT a boolean: an
         object is always truthy, and testing it as such would announce
         "it works" on a refused key. */
      const r = await checkApiKey(clean);
      if (r.ok) {
        setTmdbKey(clean);
        setEssai({ state: "bonne" });
      } else {
        setEssai({
          state: "mauvaise",
          /* `checkApiKey` swallows the exception: a wrong key and an
             absence of network both come out of it as a failure. So we do
             not decide in its place — we report what we know, and the two
             possible gestures. */
          message: r.error ? t("tmdbKey.failedWith", { error: r.error }) : t("tmdbKey.unknown"),
        });
      }
    } catch {
      /* `checkApiKey` does not throw — but the day it did, a drawer
         stuck on "trying…" would be worse than the fault. */
      setEssai({ state: "mauvaise", message: t("tmdbKey.offline") });
    }
  };

  const placedOne = writtenKey();

  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div ref={box} style={PANEL} role="dialog" aria-modal="true" aria-label={t("tmdbKey.title")}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>
            {t("tmdbKey.kicker")}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginBottom: 10 }}>
          {t("tmdbKey.note")}
        </div>

        {/* WHETHER THIS KEY IS NEEDED AT ALL DEPENDS ON THE SERVER, and
            the panel used to ask for it in both cases with the same
            words. Signed in against a server that relays TMDB, the key
            below is never used — Discoveries, the posters and the wake
            already work. It stays reachable, because it is what answers
            the moment one signs out. */}
        {relayServes && (
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 14,
              color: C.pine,
              marginBottom: 10,
              paddingLeft: 8,
              borderLeft: `2px solid ${C.pine}`,
            }}
          >
            {t("tmdbKey.relayServes")}
          </div>
        )}

        <label
          htmlFor="tmdb-key-champ"
          style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}
        >
          {t("tmdbKey.field")}
        </label>
        <input
          id="tmdb-key-champ"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setEssai({ state: "repos" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void lay();
          }}
          placeholder={t("tmdbKey.placeholder")}
          spellCheck={false}
          autoComplete="off"
          style={{
            boxSizing: "border-box",
            width: "100%",
            marginTop: 4,
            padding: "7px 9px",
            fontFamily: F.mono,
            fontSize: 12,
            color: C.ink,
            background: C.paperDark,
            border: `1px solid ${essai.state === "mauvaise" ? C.vermillion : C.line}`,
            borderRadius: "var(--tag-radius)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => void lay()}
            disabled={essai.state === "essai"}
            style={{
              all: "unset",
              cursor: essai.state === "essai" ? "default" : "pointer",
              padding: "5px 12px",
              fontFamily: F.hand,
              fontSize: 14,
              color: C.card,
              background: C.burgundy,
              borderRadius: "var(--tag-radius)",
              opacity: essai.state === "essai" ? 0.6 : 1,
            }}
          >
            {essai.state === "essai" ? t("tmdbKey.trying") : t("tmdbKey.tryAndSave")}
          </button>
          {essai.state === "essai" && <Loader2 size={13} color={C.inkFaded} />}
          {essai.state === "bonne" && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: F.hand,
                fontSize: 14,
                color: C.pine,
              }}
            >
              <Check size={13} /> {t("tmdbKey.works")}
            </span>
          )}
        </div>

        {essai.state === "mauvaise" && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              fontFamily: F.hand,
              fontSize: 13.5,
              color: C.ink,
              background: alpha(C.vermillion, 0.1),
              border: `1px solid ${alpha(C.vermillion, 0.35)}`,
            }}
          >
            {essai.message}
          </div>
        )}

        {/* Where one is found, said here rather than nowhere: without
            this line, "paste it" assumes one already has one. */}
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 13.5,
            color: C.inkFaded,
            marginTop: 12,
            borderTop: `1px solid ${C.line}`,
            paddingTop: 8,
          }}
        >
          {t("tmdbKey.whereFrom")}
        </div>

        {placedOne && (
          <button
            onClick={() => {
              setTmdbKey("");
              setKey("");
              setEssai({ state: "repos" });
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: F.hand,
              fontSize: 13.5,
              color: C.inkFaded,
              textDecoration: "underline",
            }}
          >
            <KeyRound size={12} /> {t("tmdbKey.remove")}
          </button>
        )}
      </div>
    </>
  );
}
