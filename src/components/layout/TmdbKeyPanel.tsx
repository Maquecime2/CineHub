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
import type { CSSProperties } from "react";
import { X, KeyRound, Check, Loader2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { checkApiKey } from "../../tmdb";
import { writtenKey, setTmdbKey } from "../../services/tmdbKey";

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
type Essai = { état: "repos" | "essai" | "bonne" | "mauvaise"; message?: string };

export function TmdbKeyPanel({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(writtenKey);
  const [essai, setEssai] = useState<Essai>({ état: "repos" });

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
  const poser = async () => {
    const propre = key.trim();
    if (!propre) {
      setTmdbKey("");
      setEssai({ état: "repos" });
      return;
    }
    setEssai({ état: "essai" });
    try {
      /* `checkApiKey` returns `{ ok, error }` and NOT a boolean: an
         object is always truthy, and testing it as such would announce
         "it works" on a refused key. */
      const r = await checkApiKey(propre);
      if (r.ok) {
        setTmdbKey(propre);
        setEssai({ état: "bonne" });
      } else {
        setEssai({
          état: "mauvaise",
          /* `checkApiKey` swallows the exception: a wrong key and an
             absence of network both come out of it as a failure. So we do
             not decide in its place — we report what we know, and the two
             possible gestures. */
          message: r.error
            ? `Échec : ${r.error}. Clé erronée, ou TMDB injoignable.`
            : "TMDB ne reconnaît pas cette clé.",
        });
      }
    } catch {
      /* `checkApiKey` does not throw — but the day it did, a drawer
         stuck on "trying…" would be worse than the fault. */
      setEssai({ état: "mauvaise", message: "Impossible de joindre TMDB — êtes-vous en ligne ?" });
    }
  };

  const posée = writtenKey();

  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div style={PANEL} role="dialog" aria-label="Clé TMDB">
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>
            CLÉ TMDB
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginBottom: 10 }}>
          elle ouvre les Découvertes, les affiches, les fiches d&apos;équipe et le sillage — elle
          reste sur votre machine, elle ne part nulle part
        </div>

        <label
          htmlFor="tmdb-key-champ"
          style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}
        >
          VOTRE CLÉ (API KEY V3)
        </label>
        <input
          id="tmdb-key-champ"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setEssai({ état: "repos" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void poser();
          }}
          placeholder="collez-la ici"
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
            border: `1px solid ${essai.état === "mauvaise" ? C.vermillion : C.line}`,
            borderRadius: "var(--tag-radius)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => void poser()}
            disabled={essai.état === "essai"}
            style={{
              all: "unset",
              cursor: essai.état === "essai" ? "default" : "pointer",
              padding: "5px 12px",
              fontFamily: F.hand,
              fontSize: 14,
              color: C.card,
              background: C.burgundy,
              borderRadius: "var(--tag-radius)",
              opacity: essai.état === "essai" ? 0.6 : 1,
            }}
          >
            {essai.état === "essai" ? "on essaie…" : "Essayer et enregistrer"}
          </button>
          {essai.état === "essai" && <Loader2 size={13} color={C.inkFaded} />}
          {essai.état === "bonne" && (
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
              <Check size={13} /> elle marche
            </span>
          )}
        </div>

        {essai.état === "mauvaise" && (
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
          une clé est gratuite : compte TMDB → Paramètres → API. Sans elle, le classeur marche
          entièrement — seuls l&apos;enrichissement et les propositions venues du dehors se taisent.
        </div>

        {posée && (
          <button
            onClick={() => {
              setTmdbKey("");
              setKey("");
              setEssai({ état: "repos" });
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
            <KeyRound size={12} /> retirer la clé de cette machine
          </button>
        )}
      </div>
    </>
  );
}
