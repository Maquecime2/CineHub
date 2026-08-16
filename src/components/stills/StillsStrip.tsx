import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { tiltOf } from "../../domain/seeded";
import { deleteImage } from "../../db";
import { Cardstock, Guideline, SectionTitle } from "../ui";
import { IdbImage } from "./IdbImage";
import { STILL_TOKEN } from "./tokens";
import type { Film } from "../../types";

interface StillsStripProps {
  film: Film;
  onUpdate: (f: Film) => void;
  onOpen: (i: number) => void;
  onInsert: (n: number) => void;
  /** Index of the still to bring forward, for instance after insertion. */
  highlight?: number | null;
  onAddFiles: (files: FileList | null) => void;
  /** Number of stills still being added; 0 when there is nothing to wait for. */
  busy?: number;
  /* LA PELLICULE EN COLONNE, À CÔTÉ DU TEXTE QU'ELLE ILLUSTRE.

     Elle était sous les champs, en planche contact. Insérer une capture
     voulait dire poser le curseur, descendre chercher la vignette,
     cliquer, remonter — quatre gestes pour une image, et on les fait
     dix fois. À droite de la critique, la vignette est à portée de
     main : on la prend et on la pose dans la phrase.

     Les vignettes rétrécissent, forcément — c'est le prix d'une colonne
     — mais elles gardent leur numéro et leur légende, et un clic ouvre
     toujours la capture en grand. */
  narrow?: boolean;
}

/* The film strip: all the film's stills, in a band. Each thumbnail
   carries its number — the one written in brackets in the text. */
export function StillsStrip({
  film,
  onUpdate,
  onOpen,
  onInsert,
  highlight,
  onAddFiles,
  busy,
  narrow,
}: StillsStripProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stills = film.stills || [];

  /* Removing a still shifts the numbers: the [img:N] tokens in the text
     are rewritten so as to go on pointing at the right images. */
  const remove = async (idx: number) => {
    const still = stills[idx];
    if (!still) return;
    const renumber = (t: string) =>
      (t || "").replace(STILL_TOKEN, (full, n: string) => {
        const k = Number(n);
        if (k === idx + 1) return "";
        return k > idx + 1 ? `[img:${k - 1}]` : full;
      });
    onUpdate({
      ...film,
      stills: stills.filter((_, i) => i !== idx),
      review: renumber(film.review),
      notes: renumber(film.notes),
    });
    await deleteImage(still.key).catch(console.error);
    if (still.thumbKey) await deleteImage(still.thumbKey).catch(console.error);
  };

  return (
    <Cardstock>
      <SectionTitle
        icon={<Clapperboard size={15} color={C.burgundy} />}
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                onAddFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                padding: "5px 11px",
                background: C.burgundy,
                color: C.card,
                fontFamily: F.mono,
                fontSize: 10,
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <Plus size={12} /> {busy ? `${busy}…` : "AJOUTER"}
            </button>
          </>
        }
      >
        {t("stills.theFilmStrip")}
      </SectionTitle>
      <Guideline>
        {stills.length === 0
          ? "aucune capture — Ctrl+V colle directement une image du presse-papier"
          : t("stills.pasteHint")}
      </Guideline>

      {stills.length > 0 && (
        <div
          /* THE STILLS FOLD, THEY NO LONGER SCROLL.

             It was a horizontally scrolling band: past six or seven
             stills, half the plate lived outside the frame, and nothing
             said so — a grey bar under some photos does not read as
             "there are more". You cannot know what you have without
             dragging the mouse over it, which is the opposite of the
             idea: prints laid on a table are all seen at once.

             `wrap` and nothing else. The thumbnails keep their size —
             shrinking them to fit everything on one line would make
             them unreadable, and a contact sheet owns its rows. */
          style={
            narrow
              ? {
                  /* UNE GRILLE, ET NON UNE FILE.

                     En colonne, les vignettes étaient à cent pour cent
                     de large : une seule de front, quelle que soit la
                     place. `auto-fill` en pose autant que la largeur
                     l'accepte et les répartit — deux sur une colonne
                     étroite, quatre sur un grand écran — sans qu'aucun
                     nombre ne soit écrit nulle part.

                     150 px est le plancher : en dessous, on ne
                     reconnaît plus ce qu'on a photographié, et une
                     planche contact illisible ne sert à rien. */
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 10,
                  paddingBottom: 12,
                  alignItems: "flex-start",
                }
              : {
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  paddingBottom: 12,
                  alignItems: "flex-start",
                }
          }
        >
          {stills.map((s, i) => {
            const lit = highlight === i;
            return (
              <div
                key={s.id}
                /* ON NE GLISSE PLUS DEPUIS LA PELLICULE.

                   Elle l'a permis un moment, et c'était un geste de
                   trop : deux façons de poser la même image, dont une
                   qui demande de viser un point dans un texte qu'on ne
                   voit pas encore. « Insérer » pose au curseur, et c'est
                   DANS le texte qu'on déplace ensuite la vignette — là
                   où l'on voit ce qu'on fait. */
                style={{
                  flexShrink: 0,
                  width: narrow ? "100%" : 190,
                  background: C.card,
                  padding: "9px 9px 10px",
                  boxShadow: lit
                    ? `0 0 0 2px ${C.burgundy}, 3px 7px 16px rgba(30,20,10,0.3)`
                    : "2px 5px 12px rgba(30,20,10,0.24)",
                  transform: `rotate(${Number(tiltOf(s.id)) / 3}deg)`,
                  transition: "box-shadow .2s ease",
                }}
              >
                <div style={{ position: "relative", cursor: "zoom-in" }} onClick={() => onOpen(i)}>
                  {/* dark background: the still keeps its format, we do not crop it */}
                  <IdbImage
                    imageKey={s.thumbKey || s.key}
                    style={{
                      display: "block",
                      width: "100%",
                      height: narrow ? 84 : 108,
                      objectFit: "contain",
                      background: "#1c1712",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: 5,
                      left: 5,
                      background: C.card,
                      color: C.burgundy,
                      fontFamily: F.mono,
                      fontSize: 10,
                      padding: "1px 6px",
                      border: `1px solid ${C.burgundy}`,
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
                {editing === s.id ? (
                  <input
                    autoFocus
                    style={{ ...underlineInput, fontSize: 13, marginTop: 6 }}
                    defaultValue={s.caption}
                    onBlur={(e) => {
                      onUpdate({
                        ...film,
                        stills: stills.map((x) =>
                          x.id === s.id ? { ...x, caption: e.target.value } : x
                        ),
                      });
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setEditing(s.id)}
                    style={{
                      cursor: "text",
                      fontFamily: F.hand,
                      fontSize: 16,
                      color: s.caption ? C.ink : C.inkFaded,
                      marginTop: 5,
                      minHeight: 22,
                    }}
                  >
                    {s.caption || t("stills.caption")}
                  </div>
                )}
                {/* what is actually stored — original size and weight */}
                {(s.w ?? 0) > 0 && (
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 9,
                      color: C.inkFaded,
                      marginTop: 3,
                    }}
                  >
                    {s.w}×{s.h} ·{" "}
                    {(s.bytes ?? 0) > 1e6
                      ? `${((s.bytes ?? 0) / 1e6).toFixed(1)} Mo`
                      : `${Math.round((s.bytes ?? 0) / 1024)} Ko`}
                    {s.type === "image/png" && <span style={{ color: C.pine }}> · sans perte</span>}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 4,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                  }}
                >
                  <button
                    /* LE CHAMP NE DOIT PAS PERDRE SA SÉLECTION.

                       C'est ce qui faisait atterrir la vignette n'importe
                       où : presser un bouton déplace le focus, donc la
                       sélection, et le champ ne savait plus où l'on
                       écrivait. Retenir la position après coup ne
                       suffisait pas — selon le navigateur, la sélection
                       est déjà partie quand on la relit.

                       `preventDefault` sur `mousedown` empêche le bouton
                       de prendre le focus. Le curseur reste dans la
                       phrase, visible, et l'insertion tombe exactement
                       là. C'est la façon dont se fait toute barre
                       d'outils d'éditeur, et la seule qui tienne. */
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onInsert(i + 1)}
                    style={{ all: "unset", cursor: "pointer", color: C.pine }}
                  >
                    {t("stills.insert")}
                  </button>
                  <button
                    onClick={() => remove(i)}
                    style={{
                      all: "unset",
                      ...tap,
                      cursor: "pointer",
                      color: C.inkFaded,
                      marginLeft: "auto",
                    }}
                  >
                    retirer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Cardstock>
  );
}
