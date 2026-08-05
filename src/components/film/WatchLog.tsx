/* ============================================================
   LE JOURNAL DES SÉANCES — combien de fois, et ce qu'on en pensait
   ============================================================

   La fiche ne disait qu'« vu le 2 mars 2019 ». Un film qu'on a revu
   quatre fois y ressemblait trait pour trait à un film vu une fois, et
   la seule chose qui aurait valu la peine d'être regardée — que la note
   soit passée de trois à cinq entre deux décennies — n'était consignée
   nulle part.

   D'où trois choses ici, et pas une de plus : COMBIEN, QUAND, et DE
   COMBIEN LA NOTE A BOUGÉ. Le reste est déjà ailleurs dans la fiche.

   La variation se lit face à la dernière séance NOTÉE (voir
   `ratingDrift`) : un revisionnage sans note ne rompt pas la chaîne, il
   n'a simplement rien à en dire. */
import { X, Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { Tally, InkStars } from "../ui";
import { ratingDrift, sortWatches, withWatches } from "../../domain/film";
import type { Film } from "../../types";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* « +½ » se lit d'un coup d'œil là où « +0.5 » demande une lecture. Le
   signe est ce qui compte : on veut voir MONTER ou DESCENDRE, la
   grandeur exacte vient après. */
const écart = (d: number): string => {
  const signe = d > 0 ? "+" : "−";
  const n = Math.abs(d);
  const entier = Math.floor(n);
  const demi = n - entier >= 0.5;
  return `${signe}${entier || ""}${demi ? "½" : ""}`;
};

export function WatchLog({ film, onUpdate }: { film: Film; onUpdate: (film: Film) => void }) {
  const watches = sortWatches(film.watches || []);
  const drift = ratingDrift(watches);

  /* Une séance de plus prend la note COURANTE du film : c'est celle
     qu'on vient de poser en revoyant, et si elle n'a pas bougé, la
     variation se taira d'elle-même. */
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
          {/* La variation ne s'affiche que lorsqu'il y a variation : un
              « =0 » sous chaque séance dirait exactement rien, trois fois. */}
          {drift[i] ? (
            <span
              title="depuis la fois d'avant"
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                color: drift[i]! > 0 ? C.pine : C.burgundy,
              }}
            >
              {écart(drift[i]!)}
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
