/* ============================================================
   ELSEWHERE — what other people said of the same film
   ============================================================

   The only place in the binder where somebody else's text enters a card.
   Three choices govern it, and they hold together.

   IT STAYS QUIET RATHER THAN APOLOGISING. No server, no account, no
   `tmdbId`, nobody has said anything: there is nothing to show, and
   above all no banner to announce that there is nothing. A card that
   lives very well alone must not start demanding an account.

   IT DOES NOT MIX ITS OWN RATING WITH OTHER PEOPLE'S. The average
   returned by the server excludes yours: reading your own opinion inside
   "what they think of it elsewhere" would give an average you had voted
   in twice, and the impression of being approved of by yourself.

   BLOCKING AND REPORTING ARE THERE FROM THE FIRST PUBLISHED LINE. The
   day a text causes a problem is not the day one writes the button to
   silence it.
   ============================================================ */
import { useEffect, useState } from "react";
import { Flag, Star, UserMinus, Users } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import { block, echoOfWork, serverConfigured, report, type Echo } from "../../services/server";
import type { Film } from "../../types";

export function Elsewhere({ film, signedIn }: { film: Film; signedIn: boolean }) {
  const [echo, setEcho] = useState<Echo | null>(null);
  const tmdbId = film.tmdbId;

  useEffect(() => {
    setEcho(null);
    if (!serverConfigured() || !signedIn || !tmdbId) return;
    let vivant = true;
    echoOfWork(tmdbId)
      .then((e) => vivant && setEcho(e))
      /* Silence is the right answer to a breakdown here: this section is
         an extra, and a card must not show an error for something it was
         not asked for. */
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [tmdbId, signedIn]);

  if (!echo || echo.collections === 0) return null;

  const cacher = (pseudo: string) =>
    setEcho((e) => (e ? { ...e, avis: e.avis.filter((a) => a.pseudo !== pseudo) } : e));

  return (
    <div data-tour="detail-ailleurs" style={{ marginTop: 22 }}>
      <Label>Elsewhere</Label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 4,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
        }}
      >
        <Users size={12} />
        <span>
          {echo.collections} vidéothèque{echo.collections > 1 ? "s" : ""} le range
          {echo.collections > 1 ? "nt" : ""}
        </span>
        {echo.moyenne !== null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.burgundy }}>
            <Star size={12} fill={C.burgundy} strokeWidth={1.4} />
            {echo.moyenne.toFixed(1)}
            <span style={{ color: C.inkFaded }}>
              sur {echo.notes} note{echo.notes > 1 ? "s" : ""}
            </span>
          </span>
        )}
      </div>

      {echo.avis.map((a) => (
        <AvisLu key={`${a.pseudo}-${a.fiche}`} avis={a} onSilence={() => cacher(a.pseudo)} />
      ))}
    </div>
  );
}

function AvisLu({ avis, onSilence }: { avis: Echo["avis"][number]; onSilence: () => void }) {
  const [fait, setFait] = useState<string | null>(null);

  const faireTaire = async () => {
    await block(avis.pseudo);
    onSilence();
  };

  const dire = async () => {
    /* `prompt` is ugly, and it is the right tool: a motif is stated in
       one sentence, and one more modal in an already dense card would be
       paid for in confusion, for a gesture made twice a year. */
    const motif = window.prompt(`Qu'est-ce qui ne va pas dans ce qu'a écrit ${avis.pseudo} ?`);
    if (!motif?.trim()) return;
    await report({ pseudo: avis.pseudo, fiche: avis.fiche, motif });
    setFait("signalé — nous le lirons");
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: "9px 11px",
        background: alpha(C.ink, 0.03),
        borderLeft: `2px solid ${C.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <a
          href={`#/chez/${avis.pseudo}`}
          style={{ fontFamily: F.mono, fontSize: 10, color: C.burgundy, textDecoration: "none" }}
        >
          chez {avis.pseudo}
        </a>
        {avis.note !== null && (
          <span style={{ display: "flex", gap: 1 }} aria-label={`${avis.note} sur 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={10}
                color={C.burgundy}
                fill={avis.note! >= n ? C.burgundy : "none"}
                strokeWidth={1.4}
              />
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {fait ? (
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{fait}</span>
        ) : (
          <>
            <button onClick={dire} title="Signaler" style={petit}>
              <Flag size={11} />
            </button>
            <button
              onClick={faireTaire}
              title={`Ne plus rien voir de ${avis.pseudo}`}
              style={petit}
            >
              <UserMinus size={11} />
            </button>
          </>
        )}
      </div>
      {avis.critique && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {avis.critique}
        </div>
      )}
    </div>
  );
}

const petit = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  color: C.inkFaded,
};
