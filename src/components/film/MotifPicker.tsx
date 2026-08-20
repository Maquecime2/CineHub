/* ============================================================
   A CARD'S MOTIFS — one chooses, one does not write
   ============================================================

   The difference from `TagEditor` is the whole subject: there you type
   whatever you want, here you take from a list. A free field would give
   back "sad ending" and "it ends badly", and that is precisely what we
   are trying not to have any more.

   THE MOTIFS THAT TELL THE ENDING ARE LAID LIKE THE OTHERS, BUT ARE NOT
   SHOWN LIKE THEM. Filing one's collection must not spoil the films one
   has not seen yet: a `spoiler` motif stays scratched out until it is
   revealed, and the revealing counts only for the open card — it is
   saved nowhere.
   ============================================================ */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Plus, Star, Trash2, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import {
  FAMILIES,
  searchMotifs,
  isCustom,
  motifById,
  motifLabel,
  motifsOf,
  byFamily,
} from "../../domain/motifs";
import type { Motif, MotifFamily } from "../../domain/motifs";
import { countOfMotif, effectiveThreads } from "../../domain/threads";
import type { Thread } from "../../domain/threads";
import type { Film } from "../../types";

const section = {
  fontFamily: F.mono,
  fontSize: 9.5,
  color: C.inkFaded,
  letterSpacing: 1,
  marginBottom: 4,
} as const;

const chipStyle = (ink: string, active: boolean) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  /* The same rule as `TagChip`: "A happy ending nobody believes in" is
     wider than the column it is laid in, and without this it pushes it.
     It wraps inside the chip. */
  maxWidth: "100%",
  whiteSpace: "normal" as const,
  fontFamily: F.mono,
  fontSize: 10.5,
  padding: "3px 10px",
  borderRadius: "var(--tag-radius)",
  border: `1px solid ${ink}`,
  color: active ? C.card : ink,
  background: active ? ink : "transparent",
});

/* ============================================================
   A MOTIF LAID ON THE CARD

   It carries THREE things beyond its name, and they replace the button
   that used to sit under the row: how many cards carry it, whether it is
   a star of the map, and — one click on the count — WHICH cards.

   "MAKE A THREAD OF IT" IS GONE, and the reason is the whole change.
   The same button showed whether or not the gathering already existed;
   from a second card carrying the motif it went silently to the map and
   made nothing, so one believed one had. A count and a star say the
   state instead of hiding it, and the star is the only gesture left. */
function MotifChip({
  motif,
  revealed,
  onReveal,
  onRemove,
  count,
  starred,
  onStar,
  onPreview,
  previewing,
}: {
  motif: Motif;
  revealed: boolean;
  onReveal: () => void;
  onRemove: () => void;
  /** How many cards carry it. `undefined`: the card does not know the collection. */
  count?: number;
  starred?: boolean;
  onStar?: () => void;
  onPreview?: () => void;
  previewing?: boolean;
}) {
  const { t } = useTranslation();
  const isHiddenHere = !!motif.spoiler && !revealed;
  const name = motifLabel(motif, t);
  return (
    <span
      style={{
        ...chipStyle(isHiddenHere ? C.inkFaded : C.pine, false),
        background: isHiddenHere ? alpha(C.ink, 0.12) : "transparent",
        cursor: isHiddenHere ? "pointer" : "default",
      }}
      onClick={isHiddenHere ? onReveal : undefined}
      title={isHiddenHere ? t("motifs.spoilerHint") : undefined}
    >
      {isHiddenHere ? (
        <>
          <Eye size={10} />
          {t("motifs.endingMotif")}
        </>
      ) : (
        name
      )}

      {!isHiddenHere && count !== undefined && count > 1 && onPreview && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          aria-expanded={!!previewing}
          aria-label={t("motifs.showTheOthers", { count })}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: F.mono,
            fontSize: 9,
            opacity: 0.75,
          }}
        >
          {count}
        </button>
      )}

      {!isHiddenHere && onStar && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          aria-pressed={!!starred}
          aria-label={t(starred ? "motifs.unstar" : "motifs.star", { name })}
          title={t(starred ? "motifs.unstar" : "motifs.star", { name })}
          data-tour="motif-star"
          style={{ all: "unset", cursor: "pointer", display: "flex" }}
        >
          <Star size={10} fill={starred ? "currentColor" : "none"} />
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={t("motifs.removeOne", { name })}
        style={{ all: "unset", cursor: "pointer", display: "flex" }}
      >
        <X size={9} />
      </button>
    </span>
  );
}

export function MotifPicker({
  motifs = [],
  onChange,
  suggestions = [],
  films = [],
  fils = [],
  onStar,
  onOpenInSky,
  onOpenFilm,
  onCreate,
  onSupprimer,
  onHide,
  hiddenOnes = [],
}: {
  motifs?: string[];
  onChange: (next: string[]) => void;
  /** What TMDB offers. Nothing enters without a click. */
  suggestions?: Motif[];
  /**
   * The whole collection — how a chip knows it says something about more
   * than this one card. Absent: no counts, no stars, no preview.
   */
  films?: Film[];
  /** What was changed about the gatherings; the stars come from `films`. */
  fils?: Thread[];
  /** Light this motif's star, or put it out. */
  onStar?: (motifId: string, on: boolean) => void;
  /** Open the map on this gathering. */
  onOpenInSky?: (motifId: string) => void;
  onOpenFilm?: (filmId: string) => void;
  /** Add a motif to the vocabulary. Absent: the list stays read-only. */
  onCreate?: (label: string, family: MotifFamily, spoiler: boolean) => void;
  /** Remove one of your own — the confirmation and the tidying are the caller's. */
  onSupprimer?: (motif: Motif) => void;
  /** Set one of the catalogue's aside, or put it back. */
  onHide?: (motifId: string, hidden: boolean) => void;
  /** Those of the catalogue already set aside, to offer them back. */
  hiddenOnes?: Motif[];
}) {
  const { t } = useTranslation();
  const [open, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [neuf, setNeuf] = useState("");
  const [family, setFamille] = useState<MotifFamily>("narrative");
  const [spoiler, setSpoiler] = useState(false);
  /** The motif whose other cards are unfolded, right here. */
  const [preview, setPreview] = useState<string | null>(null);

  /* `motifsOf` and not a filter on the catalogue: a motif of yours is not
     in `MOTIFS`, and the card would have lost it on display. */
  const placed = useMemo(() => motifsOf({ motifs }), [motifs]);

  /* The stars of the map, read off the collection and not off a list:
     laying the same motif on a second card lights one, and nothing is
     stored for it. */
  const stars = useMemo(
    () => new Set(effectiveThreads(films, fils).map((th) => th.motif)),
    [films, fils]
  );
  const previewed = useMemo(() => {
    if (!preview) return null;
    return {
      motifId: preview,
      titles: films.filter((f) => (f.motifs || []).includes(preview)),
    };
  }, [preview, films]);
  const families = useMemo(() => byFamily(), [open, motifs]);
  const foundIds = useMemo(() => (q.trim() ? searchMotifs(q, t) : []), [q, t]);
  const toOffer = suggestions.filter((m) => !motifs.includes(m.id));

  const lay = (id: string) => {
    if (!motifs.includes(id)) onChange([...motifs, id]);
  };
  const strike = (id: string) => onChange(motifs.filter((x) => x !== id));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {placed.map((m) => (
          <MotifChip
            key={m.id}
            motif={m}
            revealed={revealedIds.includes(m.id)}
            onReveal={() => setRevealedIds((c) => [...c, m.id])}
            onRemove={() => strike(m.id)}
            count={films.length ? countOfMotif(m.id, films) : undefined}
            starred={stars.has(m.id)}
            onStar={onStar ? () => onStar(m.id, !stars.has(m.id)) : undefined}
            previewing={preview === m.id}
            onPreview={() => setPreview((cur) => (cur === m.id ? null : m.id))}
          />
        ))}
        {placed.length === 0 && (
          <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
            {t("motifs.noneLaid")}
          </span>
        )}
      </div>

      {/* WHAT THE MOTIF SAYS BEYOND THIS CARD, WITHOUT LEAVING IT.

          The old button's whole trouble was that it navigated: one landed
          in the tangle of the map with no idea what had just happened.
          The titles are right here, and going to the map stays a
          deliberate second click. */}
      {previewed && (
        <div
          style={{
            border: `1px dashed ${C.line}`,
            padding: "8px 10px",
            marginBottom: 8,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <div style={section}>{t("motifs.alsoCarriedBy", { count: previewed.titles.length })}</div>
          {previewed.titles.map((f) => (
            <button
              key={f.id}
              onClick={() => onOpenFilm?.(f.id)}
              style={{
                all: "unset",
                ...tap,
                cursor: onOpenFilm ? "pointer" : "default",
                fontFamily: F.body,
                fontSize: 13,
                color: C.ink,
              }}
            >
              {f.title}
            </button>
          ))}
          {onOpenInSky && (
            <button
              onClick={() => onOpenInSky(previewed.motifId)}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginTop: 4,
                fontFamily: F.mono,
                fontSize: 9.5,
                color: C.burgundy,
                borderBottom: `1px solid ${C.burgundy}`,
                alignSelf: "flex-start",
              }}
            >
              {t("motifs.seeInTheSky")}
            </button>
          )}
        </div>
      )}

      {/* What TMDB offers, dotted and never laid automatically: its
          keywords range from the very apt to the frankly wrong, and they
          will then serve to build the map. */}
      {toOffer.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginRight: 2 }}>
            {t("motifs.suggestedByTmdb")}
          </span>
          {toOffer.map((m) => (
            <button
              key={m.id}
              onClick={() => lay(m.id)}
              style={{ ...chipStyle(C.ochre, false), borderStyle: "dashed" }}
            >
              <Plus size={10} />
              {m.spoiler ? t("motifs.endingMotif") : motifLabel(m, t)}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOuvert((v) => !v)}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          fontFamily: F.mono,
          fontSize: 10,
          color: C.burgundy,
          borderBottom: `1px solid ${C.burgundy}`,
        }}
      >
        {open ? t("motifs.closeList") : t("motifs.chooseMotifs")}
      </button>

      {open && (
        <div style={{ marginTop: 10, border: `1px dashed ${C.line}`, padding: "12px 14px" }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("motifs.searchPlaceholder")}
            style={{ ...underlineInput, fontSize: 14, marginBottom: 10 }}
          />
          {q.trim() ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {foundIds.length === 0 && (
                <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
                  {t("motifs.noneByThatName")}
                </span>
              )}
              {foundIds.map((m) => (
                <button
                  key={m.id}
                  onClick={() => lay(m.id)}
                  style={chipStyle(isCustom(m.id) ? C.cobalt : C.pine, motifs.includes(m.id))}
                >
                  {motifLabel(m, t)}
                </button>
              ))}
              {onCreate &&
                !foundIds.some(
                  (m) => motifLabel(m, t).toLowerCase() === q.trim().toLowerCase()
                ) && (
                  <button
                    onClick={() => {
                      onCreate(q, family, spoiler);
                      setQ("");
                    }}
                    style={{ ...chipStyle(C.cobalt, false), borderStyle: "dashed" }}
                  >
                    <Plus size={10} />
                    {t("motifs.create", { name: q.trim() })}
                  </button>
                )}
            </div>
          ) : (
            families.map((f) => (
              <div key={f.family} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    color: C.inkFaded,
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {t(`motifs.families.${f.family}`).toUpperCase()}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {f.motifs.map((m) => (
                    <span
                      key={m.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        maxWidth: "100%",
                      }}
                    >
                      <button
                        onClick={() => (motifs.includes(m.id) ? strike(m.id) : lay(m.id))}
                        style={chipStyle(isCustom(m.id) ? C.cobalt : C.pine, motifs.includes(m.id))}
                      >
                        {motifLabel(m, t)}
                      </button>
                      {/* WHAT CAN BE DONE WITH A MOTIF DEPENDS ON WHERE IT COMES FROM.

                          Yours is DELETED: it exists only in your data,
                          nobody else will put it back. The catalogue's is
                          only HIDDEN — erasing it from your data would see
                          it return at the next update, which is worse
                          than not having removed it. */}
                      {isCustom(m.id) && onSupprimer && (
                        <button
                          onClick={() => onSupprimer(m)}
                          aria-label={t("motifs.deleteOne", { name: motifLabel(m, t) })}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            color: C.inkFaded,
                            display: "flex",
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                      {!isCustom(m.id) && onHide && (
                        <button
                          onClick={() => onHide(m.id, true)}
                          aria-label={t("motifs.hideOne", { name: motifLabel(m, t) })}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            color: C.inkFaded,
                            display: "flex",
                          }}
                        >
                          <EyeOff size={10} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* CREATING ONE'S OWN, WHERE ONE WAS LOOKING.

              The catalogue cannot foresee everything, and the moment one
              notices is exactly this one: one has just gone through the
              list without finding one's idea in it. */}
          {onCreate && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 4 }}>
              <div style={section}>{t("motifs.yourOwn")}</div>
              <input
                value={neuf}
                onChange={(e) => setNeuf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !neuf.trim()) return;
                  e.preventDefault();
                  onCreate(neuf, family, spoiler);
                  setNeuf("");
                  setSpoiler(false);
                }}
                aria-label={t("motifs.newMotif")}
                placeholder={t("motifs.newPlaceholder")}
                style={{ ...underlineInput, fontSize: 13.5 }}
              />
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <select
                  value={family}
                  onChange={(e) => setFamille(e.target.value as MotifFamily)}
                  aria-label={t("motifs.familyOf")}
                  style={{
                    ...underlineInput,
                    flex: "1 1 140px",
                    minWidth: 0,
                    fontFamily: F.mono,
                    fontSize: 10,
                  }}
                >
                  {FAMILIES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {t(`motifs.families.${f.id}`)}
                    </option>
                  ))}
                </select>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    color: C.inkFaded,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={spoiler}
                    onChange={(e) => setSpoiler(e.target.checked)}
                  />
                  {t("motifs.tellsTheEnding")}
                </label>
              </div>
            </div>
          )}

          {/* What has been set aside stays recallable: hiding is not
              throwing away, and a vocabulary one cannot reopen closes for
              good at the first hesitation. */}
          {onHide && hiddenOnes.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
              <div style={section}>{t("motifs.setAside", { count: hiddenOnes.length })}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {hiddenOnes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onHide(m.id, false)}
                    title={t("motifs.putBack")}
                    style={{ ...chipStyle(C.inkFaded, false), borderStyle: "dashed" }}
                  >
                    <Eye size={9} />
                    {motifLabel(m, t)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { motifById };
