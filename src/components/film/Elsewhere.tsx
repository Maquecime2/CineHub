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
import { useTranslation } from "react-i18next";
import { Flag, Star, UserMinus, Users } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { Stamp } from "../atmosphere/hall";
import { STAMP_INK, stampLabel } from "../play/stamps";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import { block, echoOfWork, serverConfigured, report, type Echo } from "../../services/server";
import type { Film } from "../../types";

export function Elsewhere({ film, signedIn }: { film: Film; signedIn: boolean }) {
  const { t } = useTranslation();
  const [echo, setEcho] = useState<Echo | null>(null);
  const tmdbId = film.tmdbId;

  useEffect(() => {
    setEcho(null);
    if (!serverConfigured() || !signedIn || !tmdbId) return;
    let alive = true;
    echoOfWork(tmdbId)
      .then((e) => alive && setEcho(e))
      /* Silence is the right answer to a breakdown here: this section is
         an extra, and a card must not show an error for something it was
         not asked for. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tmdbId, signedIn]);

  if (!echo || echo.collections === 0) return null;

  const hide = (pseudo: string) =>
    setEcho((e) => (e ? { ...e, reviews: e.reviews.filter((a) => a.pseudo !== pseudo) } : e));

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
          {t("elsewhere.filedBy", { count: echo.collections })}
          {echo.collections > 1 ? "nt" : ""}
        </span>
        {echo.mean !== null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.burgundy }}>
            <Star size={12} fill={C.burgundy} strokeWidth={1.4} />
            {echo.mean.toFixed(1)}
            <span style={{ color: C.inkFaded }}>
              sur {echo.ratings} noted{echo.ratings > 1 ? "s" : ""}
            </span>
          </span>
        )}
      </div>

      {echo.reviews.map((a) => (
        <OneOpinion key={`${a.pseudo}-${a.card}`} opinion={a} onSilence={() => hide(a.pseudo)} />
      ))}
    </div>
  );
}

function OneOpinion({
  opinion,
  onSilence,
}: {
  opinion: Echo["reviews"][number];
  onSilence: () => void;
}) {
  const { t } = useTranslation();
  const [said, setSaid] = useState<string | null>(null);

  const mute = async () => {
    await block(opinion.pseudo);
    onSilence();
  };

  const say = async () => {
    /* `prompt` is ugly, and it is the right tool: a motif is stated in
       one sentence, and one more modal in an already dense card would be
       paid for in confusion, for a gesture made twice a year. */
    const reason = window.prompt(t("elsewhere.reportPrompt", { pseudo: opinion.pseudo }));
    if (!reason?.trim()) return;
    await report({ pseudo: opinion.pseudo, card: opinion.card, reason });
    setSaid(t("elsewhere.reported"));
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
          href={`#/chez/${opinion.pseudo}`}
          style={{ fontFamily: F.mono, fontSize: 10, color: C.burgundy, textDecoration: "none" }}
        >
          {t("elsewhere.at", { pseudo: opinion.pseudo })}
        </a>
        {opinion.stamp && (
          <Stamp text={t(stampLabel(opinion.stamp))} ink={STAMP_INK[opinion.stamp] ?? C.burgundy} />
        )}
        {opinion.rating !== null && (
          <span style={{ display: "flex", gap: 1 }} aria-label={`${opinion.rating} sur 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={10}
                color={C.burgundy}
                fill={opinion.rating! >= n ? C.burgundy : "none"}
                strokeWidth={1.4}
              />
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {said ? (
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{said}</span>
        ) : (
          <>
            <button onClick={say} title="Signaler" style={small}>
              <Flag size={11} />
            </button>
            <button
              onClick={mute}
              title={t("elsewhere.muteSomebody", { pseudo: opinion.pseudo })}
              style={small}
            >
              <UserMinus size={11} />
            </button>
          </>
        )}
      </div>
      {opinion.review && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {opinion.review}
        </div>
      )}
    </div>
  );
}

const small = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  color: C.inkFaded,
};
