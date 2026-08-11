import { useRef, useState } from "react";
import { Clapperboard, Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { tiltOf } from "../../domain/seeded";
import { deleteImage } from "../../db";
import { Carton, Consigne, TitreSection } from "../ui";
import { IdbImage } from "./IdbImage";
import { STILL_TOKEN } from "./tokens";
import type { Film } from "../../types";

interface StillsStripProps {
  film: Film;
  onUpdate: (f: Film) => void;
  onOpen: (i: number) => void;
  onInsert: (n: number) => void;
  /** Index de la capture à mettre en avant, par exemple après insertion. */
  highlight?: number | null;
  onAddFiles: (files: FileList | null) => void;
  /** Nombre de captures encore en cours d'ajout ; 0 quand il n'y a rien à attendre. */
  busy?: number;
}

/* La pellicule : toutes les captures du film, en bande. Chaque vignette
   porte son numéro — celui qu'on écrit entre crochets dans le texte. */
export function StillsStrip({
  film,
  onUpdate,
  onOpen,
  onInsert,
  highlight,
  onAddFiles,
  busy,
}: StillsStripProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stills = film.stills || [];

  /* Retirer une capture décale les numéros : les jetons [img:N] du texte
     sont réécrits pour continuer de désigner les bonnes images. */
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
    <Carton>
      <TitreSection
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
        La pellicule
      </TitreSection>
      <Consigne>
        {stills.length === 0
          ? "aucune capture — Ctrl+V colle directement une image du presse-papier"
          : "Ctrl+V pour coller · « insérer » place la vignette à l'endroit du curseur"}
      </Consigne>

      {stills.length > 0 && (
        <div
          /* LES CAPTURES SE REPLIENT, ELLES NE DÉFILENT PLUS.

             C'était une bande à défilement horizontal : au-delà de six
             ou sept captures, la moitié de la planche vivait hors du
             cadre, et rien ne le disait — une barre grise sous des
             photos ne se lit pas comme « il y en a d'autres ». On ne
             sait pas ce qu'on a sans traîner la souris dessus, ce qui
             est le contraire de l'idée : des tirages posés sur une
             table se voient tous à la fois.

             `wrap` et rien d'autre. Les vignettes gardent leur calibre
             — les rétrécir pour tout faire tenir sur une ligne les
             rendrait illisibles, et une planche-contact assume ses
             rangées. */
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            paddingBottom: 12,
            alignItems: "flex-start",
          }}
        >
          {stills.map((s, i) => {
            const lit = highlight === i;
            return (
              <div
                key={s.id}
                style={{
                  flexShrink: 0,
                  width: 190,
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
                  {/* fond sombre : la capture garde son format, on ne la rogne pas */}
                  <IdbImage
                    imageKey={s.thumbKey || s.key}
                    style={{
                      display: "block",
                      width: "100%",
                      height: 108,
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
                    {s.caption || "légender…"}
                  </div>
                )}
                {/* ce qui est réellement stocké — définition et poids d'origine */}
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
                    onClick={() => onInsert(i + 1)}
                    style={{ all: "unset", cursor: "pointer", color: C.pine }}
                  >
                    insérer
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
    </Carton>
  );
}
