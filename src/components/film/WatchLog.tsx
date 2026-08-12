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
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally, InkStars } from "../ui";
import { ratingDrift, sortWatches, withWatches } from "../../domain/film";
import type { Film } from "../../types";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* "+½" is read at a glance where "+0.5" demands reading. The sign is what
   counts: one wants to see it GO UP or GO DOWN, the exact magnitude comes
   after. */
const gap = (d: number): string => {
  const signe = d > 0 ? "+" : "−";
  const n = Math.abs(d);
  const entier = Math.floor(n);
  const demi = n - entier >= 0.5;
  return `${signe}${entier || ""}${demi ? "½" : ""}`;
};

export function WatchLog({ film, onUpdate }: { film: Film; onUpdate: (film: Film) => void }) {
  const watches = sortWatches(film.watches || []);
  const drift = ratingDrift(watches);

  /* One more screening takes the film's CURRENT rating: it is the one
     just laid down on rewatching, and if it has not moved, the drift will
     keep quiet on its own. */
  const revu = () =>
    onUpdate(withWatches(film, [...watches, { date: aujourdhui(), rating: film.rating || null }]));

  const retirer = (date: string) =>
    onUpdate(
      withWatches(
        film,
        watches.filter((w) => w.date !== date)
      )
    );

  return (
    <div style={{ marginTop: 12 }}>
      <Tally label="visionnages" value={watches.length} />

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
            <span style={{ fontSize: 14, opacity: 0.7 }}>sans note</span>
          )}
          {/* The drift only shows when there is a drift: an "=0" under
              every screening would say exactly nothing, three times. */}
          {drift[i] ? (
            <span
              title="depuis la fois d'avant"
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
            onClick={() => retirer(w.date)}
            title="Retirer cette séance"
            aria-label={`Retirer la séance du ${w.date}`}
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded, opacity: 0.5 }}
          >
            <X size={11} />
          </button>
        </div>
      ))}

      <button
        onClick={revu}
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
        <Plus size={11} /> JE L&apos;AI REVU
      </button>
    </div>
  );
}
