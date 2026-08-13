/* ============================================================
   RANGER DANS UNE LISTE — le geste, partout où il se présente
   ============================================================

   THE GESTURE USED TO START FROM THE CARD ONLY, and the reasoning that
   put it there was sound: it is on the card that one has the film before
   one's eyes, and above all its work identifier. What that reasoning
   missed is that one also has the film before one's eyes on the WALL,
   where forty of them hang — and that opening a card to file a film one
   was already looking at is a detour, not a gesture.

   So the choosing of a list moved here, and three shells use it: the
   badge on a poster, the footer of a multiple selection, and the bottom
   of the detail card, which keeps the place it had.

   A CARD WITHOUT A `tmdbId` IS FILED NOWHERE, and that is still not a
   defect. A list holds WORKS, not copies; a film typed in by hand has no
   identity in common with the same film at somebody else's. What changes
   is that we now SAY it — silently dropping four films out of thirty
   was the part that deserved fixing.

   AND ONE CAN NOW MAKE THE LIST FROM HERE. Before, with no list yet, the
   whole section vanished: the one moment one most wants to file
   something is the first, and the first is precisely when no list
   exists.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPlus, Plus, Check } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import { addToList, createList } from "../../services/server";
import { useMyLists, refreshLists } from "../../hooks/useMyLists";

/** A work as a list holds it: an identity, and what to read on the row. */
export interface Fileable {
  tmdbId: string | number;
  title: string;
  year?: string | number;
}

export function ListFiler({
  works,
  /** Films in the selection that have no `tmdbId` — counted, not hidden. */
  strangers = 0,
  compact = false,
  onDone,
}: {
  works: Fileable[];
  strangers?: number;
  compact?: boolean;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const lists = useMyLists();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [told, setDit] = useState<string | null>(null);

  /* The lists have not arrived, or the server refused to say: we show
     nothing rather than an empty menu that looks broken. */
  if (!lists) return null;

  const file = async (listId: string) => {
    setBusy(true);
    setDit(null);
    try {
      /* ONE CALL PER WORK, AND THE SERVER MAKES IT HARMLESS: the pair
         (list, work) is the primary key over there, so filing the same
         film twice writes once. "Already in it" is not an error either —
         it is the same gesture, and it deserves the same calm answer. */
      const answers = await Promise.all(works.map((w) => addToList(listId, w)));
      const fresh = answers.filter((r) => r.fresh).length;
      setDit(
        works.length === 1
          ? answers[0]!.fresh
            ? t("lists.filed")
            : t("lists.alreadyThere")
          : fresh === 0
            ? t("lists.allAlreadyThere")
            : t("lists.filedCount", { count: fresh })
      );
      onDone?.();
    } catch (e) {
      setDit((e as Error).message || t("lists.filingFailed"));
    } finally {
      setBusy(false);
    }
  };

  const makeAndFile = async () => {
    const title = name.trim();
    if (!title) return;
    setBusy(true);
    setDit(null);
    try {
      const { id } = await createList({ title });
      /* Every other badge on screen reads the same store: the new list
         must appear under all of them, not only under this one. */
      await refreshLists();
      setName("");
      await file(id);
    } catch (e) {
      setDit((e as Error).message || t("lists.creationFailed"));
      setBusy(false);
    }
  };

  return (
    <div data-tour="ranger-listes" style={{ minWidth: compact ? 210 : undefined }}>
      {!compact && <Label>{t("lists.fileIn")}</Label>}

      {works.length === 0 ? (
        /* THE WHOLE SELECTION IS UNFILEABLE. Offering the lists anyway
           would make a button that does nothing and says nothing. */
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, padding: "4px 0" }}>
          {t("lists.noneFileable", { count: strangers })}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
            {lists.map((l) => (
              <button
                key={l.id}
                disabled={busy}
                onClick={() => file(l.id)}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.5 : 1,
                  gap: 7,
                  padding: "6px 8px",
                  fontFamily: F.body,
                  fontSize: 13,
                  color: C.ink,
                }}
              >
                <ListPlus size={12} style={{ flexShrink: 0, color: C.moss }} aria-hidden />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.title}
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                  {l.works}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && makeAndFile()}
              placeholder={t("lists.newListPlaceholder")}
              maxLength={120}
              style={{
                flex: 1,
                minWidth: 0,
                ...tap,
                padding: "6px 8px",
                background: C.card,
                border: `1px solid ${C.line}`,
                fontFamily: F.mono,
                fontSize: 11,
                color: C.ink,
              }}
            />
            <button
              onClick={makeAndFile}
              disabled={busy || !name.trim()}
              aria-label={t("lists.createAndFile")}
              style={{
                all: "unset",
                ...tap,
                cursor: busy || !name.trim() ? "default" : "pointer",
                opacity: busy || !name.trim() ? 0.4 : 1,
                padding: "6px 9px",
                color: C.card,
                background: C.moss,
              }}
            >
              <Plus size={12} />
            </button>
          </div>

          {/* WHAT COULD NOT BE FILED IS NAMED, NOT DROPPED. Thirty films
              selected and twenty-six filed, with no word about the other
              four, reads as a bug — and is not one. */}
          {strangers > 0 && (
            <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginTop: 6 }}>
              {t("lists.strangers", { count: strangers })}
            </div>
          )}
        </>
      )}

      {told && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 6,
            fontFamily: F.hand,
            fontSize: 15,
            color: C.inkFaded,
          }}
        >
          <Check size={12} aria-hidden /> {told}
        </div>
      )}
    </div>
  );
}
