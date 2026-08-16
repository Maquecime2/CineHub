/* ============================================================
   THE SCREENING LOG — how many times, and what one thought of it
   ============================================================

   The card only said "seen on 2 March 2019". A film seen four times
   looked exactly like a film seen once, and the only thing that would
   have been worth looking at — that the rating went from three to five
   between two decades — was recorded nowhere.

   Hence three things here, and not one more: HOW MANY, WHEN, and BY HOW
   MUCH THE RATING MOVED. The rest is already elsewhere in the card.

   The drift is read against the last RATED screening (see `ratingDrift`):
   a rewatch with no rating does not break the chain, it simply has
   nothing to say about it. */
import { X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally, InkStars } from "../ui";
import { ratingDrift, sortWatches, withWatches } from "../../domain/film";
import type { Film } from "../../types";

const today = () => new Date().toISOString().slice(0, 10);

/* "+½" is read at a glance where "+0.5" demands reading. The sign is what
   counts: one wants to see it GO UP or GO DOWN, the exact magnitude comes
   after. */
const gap = (d: number): string => {
  const sign = d > 0 ? "+" : "−";
  const n = Math.abs(d);
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  return `${sign}${whole || ""}${half ? "½" : ""}`;
};

export function WatchLog({ film, onUpdate }: { film: Film; onUpdate: (film: Film) => void }) {
  const { t } = useTranslation();
  const watches = sortWatches(film.watches || []);
  const drift = ratingDrift(watches);

  /* One more screening takes the film's CURRENT rating: it is the one
     just laid down on rewatching, and if it has not moved, the drift will
     keep quiet on its own. */
  const rewatched = () =>
    onUpdate(withWatches(film, [...watches, { date: today(), rating: film.rating || null }]));

  const remove = (date: string) =>
    onUpdate(
      withWatches(
        film,
        watches.filter((w) => w.date !== date)
      )
    );

  return (
    <div style={{ marginTop: 12 }}>
      <Tally label={t("watchlog.viewingsLabel")} value={watches.length} />

      {watches.map((w, i) => (
        <div
          key={w.date}
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 6,
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
          }}
        >
          <span style={{ minWidth: 84 }}>{w.date}</span>
          {w.rating != null ? (
            <InkStars value={w.rating} size={11} />
          ) : (
            <span style={{ fontSize: 14, opacity: 0.7 }}>{t("watchlog.noRating")}</span>
          )}
          {/* The drift only shows when there is a drift: an "=0" under
              every screening would say exactly nothing, three times. */}
          {drift[i] ? (
            <span
              title={t("watchlog.sinceLastTime")}
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                color: drift[i]! > 0 ? C.pine : C.burgundy,
              }}
            >
              {gap(drift[i]!)}
            </span>
          ) : null}
          {w.rewatch && <span style={{ fontFamily: F.mono, fontSize: 9, opacity: 0.6 }}>REVU</span>}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => remove(w.date)}
            title={t("watchlog.removeOne")}
            aria-label={t("watchlog.removeOneOn", { date: w.date })}
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded, opacity: 0.5 }}
          >
            <X size={11} />
          </button>
        </div>
      ))}

      <button
        onClick={rewatched}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: C.inkFaded,
          fontFamily: F.mono,
          fontSize: 10,
        }}
      >
        <Plus size={11} /> {t("watchlog.iSawItAgain")}
      </button>
    </div>
  );
}
