/* ============================================================
   LA CLÉ TMDB — le tiroir de réglage

   Elle ne se posait que dans l'onglet « Import Letterboxd », au milieu
   d'un écran qui parle d'autre chose, et personne n'allait l'y chercher
   pour faire marcher les Découvertes. Un réglage qui commande huit
   écrans n'appartient à aucun d'eux : il est au pied du rail, à côté de
   la peau du site et de la visite, avec les autres réglages de tout.

   Le tiroir d'Import reste — il est utile là où l'on décide justement
   d'enrichir un import — mais il écrit au même endroit que celui-ci.
   ============================================================ */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { X, KeyRound, Check, Loader2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { checkApiKey } from "../../tmdb";
import { getTmdbKey, setTmdbKey } from "../../services/tmdbKey";

/* Même tranche que le choix des peaux : ce sont deux tiroirs du même
   rail, et le budget de `z-index` leur réserve 59–60. */
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

/* L'état de la vérification. « Pas encore essayé » n'est pas « fausse » :
   confondre les deux ferait crier à l'erreur devant un champ intact. */
type Essai = { état: "repos" | "essai" | "bonne" | "mauvaise"; message?: string };

export function TmdbKeyPanel({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(getTmdbKey);
  const [essai, setEssai] = useState<Essai>({ état: "repos" });

  /* Échap ferme, comme partout ailleurs : un tiroir qu'on ne peut fermer
     qu'à la souris est un tiroir de trop pour qui navigue au clavier. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ON ESSAIE AVANT D'ENREGISTRER. Une clé fausse enregistrée sans un mot
     donne huit écrans qui échouent chacun dans leur coin, et rien qui
     désigne la cause. Une clé VIDE, elle, s'enregistre sans essai : c'est
     un effacement volontaire, pas une tentative. */
  const poser = async () => {
    const propre = key.trim();
    if (!propre) {
      setTmdbKey("");
      setEssai({ état: "repos" });
      return;
    }
    setEssai({ état: "essai" });
    try {
      /* `checkApiKey` rend `{ ok, error }` et NON un booléen : un objet
         est toujours vrai, et le tester tel quel annoncerait « elle
         marche » sur une clé refusée. */
      const r = await checkApiKey(propre);
      if (r.ok) {
        setTmdbKey(propre);
        setEssai({ état: "bonne" });
      } else {
        setEssai({
          état: "mauvaise",
          /* `checkApiKey` avale l'exception : une clé fausse et une
             absence de réseau en ressortent toutes deux comme un échec.
             On ne tranche donc pas à sa place — on rapporte ce qu'on
             sait, et les deux gestes possibles. */
          message: r.error
            ? `Échec : ${r.error}. Clé erronée, ou TMDB injoignable.`
            : "TMDB ne reconnaît pas cette clé.",
        });
      }
    } catch {
      /* `checkApiKey` ne lève pas — mais le jour où il le ferait, un
         tiroir bloqué sur « on essaie… » serait pire que le défaut. */
      setEssai({ état: "mauvaise", message: "Impossible de joindre TMDB — êtes-vous en ligne ?" });
    }
  };

  const posée = getTmdbKey();

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

        {/* Où l'on en trouve une, dit ici plutôt que nulle part : sans
            cette ligne, « collez-la » suppose qu'on en a déjà une. */}
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
