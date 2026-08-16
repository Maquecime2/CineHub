/* ============================================================
   A MOTIF'S GATHERING, OPENED
   ============================================================

   THE HALF OF THE MODEL NOBODY COULD REACH. `note`, `filmIds`,
   `excluded`, the colour, the name — all of it existed, all of it was
   tested, all of it was indexed by the search, and NOTHING in the
   interface led to any of it. A gathering could not be renamed, could
   not be recoloured, could not be written under, and above all could not
   be undone: made by mistake, it stayed for good short of restoring a
   backup.

   WHAT IS WRITTEN HERE IS A DEVIATION, never the gathering itself. The
   stars come from the cards; this panel says "call this one otherwise",
   "draw it in plum", "that film does not belong in it". Hence
   "back to plain", which erases the row rather than writing a fresh
   default over it — a stored copy of the default would freeze today's
   name and contradict the catalogue at the first relabelling.
   ============================================================ */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { CAT_KEYS, catInk } from "../../theme/palette";
import { Layer } from "../ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { isCustom, motifById } from "../../domain/motifs";
import {
  countOfMotif,
  isPlainDefault,
  makeThread,
  threadLabel,
  threadMembers,
  withFilm,
  withoutFilm,
  STAR_FROM,
} from "../../domain/threads";
import type { Thread } from "../../domain/threads";
import type { Film } from "../../types";

const section = {
  fontFamily: F.mono,
  fontSize: 9.5,
  color: C.inkFaded,
  letterSpacing: 1,
  margin: "16px 0 5px",
} as const;

export function MotifPanel({
  motifId,
  thread,
  films,
  onPatch,
  onDeleteMotif,
  onOpen,
  onClose,
}: {
  motifId: string;
  /** What is stored about it, or a plain default when nothing is. */
  thread: Thread;
  films: Film[];
  onPatch: (patch: Partial<Thread>) => void;
  /** Only a motif of one's own can be deleted; the catalogue's is hidden. */
  onDeleteMotif?: (motifId: string) => void;
  onOpen?: (filmId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const box = useDialog(onClose, { autoFocus: false });
  const [adding, setAdding] = useState("");

  const motif = motifById(motifId);
  const name = threadLabel(thread, t);
  const members = useMemo(() => threadMembers(thread, films), [thread, films]);
  const carried = countOfMotif(motifId, films);

  /* What one can still put in: everything that is not already a member.
     Searching by title, because a collection is not a list one scrolls. */
  const candidates = useMemo(() => {
    const q = adding.trim().toLowerCase();
    if (!q) return [];
    const inside = new Set(members);
    return films
      .filter((f) => !inside.has(f.id) && (f.title || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [adding, films, members]);

  const titleOf = (id: string) => films.find((f) => f.id === id)?.title || id;
  const byHand = (id: string) => !(films.find((f) => f.id === id)?.motifs || []).includes(motifId);

  return (
    <Layer>
      <>
        <div
          onClick={onClose}
          data-veil
          style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }}
        />
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={t("constellation.settingsOf", { name })}
          data-tour="motif-panel"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(460px, 94vw)",
            zIndex: 60,
            background: C.paper,
            borderLeft: `1px solid ${C.line}`,
            boxShadow: "-6px 0 24px rgba(0,0,0,0.28)",
            overflowY: "auto",
            padding: "26px 26px 40px",
            animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 26,
                color: C.ink,
              }}
            >
              {name}
            </div>
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginLeft: "auto",
                display: "flex",
              }}
            >
              <X size={16} color={C.inkFaded} />
            </button>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 2 }}>
            {t("constellation.carriedBy", { count: carried })}
          </div>

          <div style={section}>{t("constellation.nameOfYourOwn")}</div>
          <input
            value={thread.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            aria-label={t("constellation.nameOfYourOwn")}
            placeholder={motif ? name : motifId}
            style={{ ...underlineInput, fontSize: 15 }}
          />

          <div style={section}>{t("constellation.colour")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {CAT_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => onPatch({ color: key })}
                title={key}
                aria-label={key}
                aria-pressed={thread.color === key}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: catInk(key),
                  outline: thread.color === key ? `2px solid ${C.ink}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>

          <div style={section}>{t("constellation.noteUnder")}</div>
          <textarea
            value={thread.note}
            onChange={(e) => onPatch({ note: e.target.value })}
            aria-label={t("constellation.noteUnder")}
            rows={3}
            style={{
              ...underlineInput,
              fontFamily: F.hand,
              fontSize: 16,
              resize: "vertical",
              width: "100%",
            }}
          />

          {/* WHAT IT GATHERS, AND WHERE EACH ONE COMES FROM. A card the
              motif brings in and a card set there by hand are not undone
              by the same write — `withoutFilm` knows it, and the panel
              says which is which rather than making one guess. */}
          <div style={section}>{t("constellation.whatItGathers", { count: members.length })}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {members.length === 0 && (
              <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
                {t("constellation.gathersNothing")}
              </span>
            )}
            {members.map((id) => (
              <span key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => onOpen?.(id)}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: onOpen ? "pointer" : "default",
                    fontFamily: F.body,
                    fontSize: 13.5,
                    color: C.ink,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {titleOf(id)}
                </button>
                {byHand(id) && (
                  <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.inkFaded }}>
                    {t("constellation.setByHand")}
                  </span>
                )}
                <button
                  onClick={() => onPatch(withoutFilm(thread, id, films))}
                  aria-label={t("constellation.setAsideOne", { title: titleOf(id) })}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    color: C.inkFaded,
                    display: "flex",
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          {thread.excluded.length > 0 && (
            <>
              <div style={section}>
                {t("constellation.setAsideCount", { count: thread.excluded.length })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {thread.excluded.map((id) => (
                  <button
                    key={id}
                    onClick={() => onPatch(withFilm(thread, id))}
                    title={t("constellation.putBackOne")}
                    style={{
                      all: "unset",
                      ...tap,
                      cursor: "pointer",
                      fontFamily: F.mono,
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: "var(--tag-radius)",
                      border: `1px dashed ${C.inkFaded}`,
                      color: C.inkFaded,
                    }}
                  >
                    {titleOf(id)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={section}>{t("constellation.addByHand")}</div>
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            aria-label={t("constellation.addByHand")}
            placeholder={t("constellation.searchATitle")}
            style={{ ...underlineInput, fontSize: 14 }}
          />
          {candidates.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
              {candidates.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    onPatch(withFilm(thread, f.id));
                    setAdding("");
                  }}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: F.mono,
                    fontSize: 10,
                    padding: "3px 9px",
                    borderRadius: "var(--tag-radius)",
                    border: `1px solid ${C.cobalt}`,
                    color: C.cobalt,
                  }}
                >
                  <Plus size={10} />
                  {f.title}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              borderTop: `1px solid ${C.line}`,
              marginTop: 22,
              paddingTop: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => onPatch({ off: !thread.off })}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                fontFamily: F.mono,
                fontSize: 10,
                color: C.ink,
                borderBottom: `1px solid ${C.ink}`,
              }}
            >
              {t(thread.off ? "constellation.lightItUp" : "constellation.putItOut")}
            </button>

            {/* Erasing the row, and not writing a default over it: a
                stored default would freeze today's name and contradict
                the catalogue the day the motif is relabelled. */}
            {!isPlainDefault(thread) && (
              <button
                onClick={() => onPatch(makeThread({ motif: motifId }))}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                  borderBottom: `1px solid ${C.inkFaded}`,
                }}
              >
                {t("constellation.backToPlain")}
              </button>
            )}

            {isCustom(motifId) && onDeleteMotif && (
              <button
                onClick={() => {
                  onDeleteMotif(motifId);
                  onClose();
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.burgundy,
                }}
              >
                <Trash2 size={11} />
                {t("motifs.deleteThisOne")}
              </button>
            )}
          </div>

          {carried < STAR_FROM && members.length > 0 && (
            <div
              style={{
                marginTop: 14,
                fontFamily: F.hand,
                fontSize: 15,
                color: C.inkFaded,
                background: alpha(C.ink, 0.05),
                padding: "8px 10px",
              }}
            >
              {t("constellation.belowTheCount", { count: STAR_FROM })}
            </div>
          )}
        </div>
      </>
    </Layer>
  );
}
