import { useState } from "react";
import { Trash2 } from "lucide-react";
import { C, F } from "../theme/tokens";
import { underlineInput, ruledTextarea, tap } from "../theme/styles";
import { tiltOf } from "../domain/seeded";
import { uid } from "../domain/film";
import { StampCorner } from "../components/atmosphere";
import type { Note } from "../types";

/* ============================================================
   VUE — CARNET
   ============================================================ */
interface NotebookViewProps {
  notes: Note[];
  onAdd: (n: Note) => void;
  onUpdate: (n: Note) => void;
  onDelete: (id: string) => void;
}

export function NotebookView({ notes, onAdd, onUpdate, onDelete }: NotebookViewProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = () => {
    if (!body.trim() && !title.trim()) return;
    onAdd({ id: uid(), title: title.trim() || "Sans titre", body, createdAt: Date.now() });
    setTitle("");
    setBody("");
  };
  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 720, position: "relative" }}>
      <StampCorner text="CARNET" />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 42,
          color: C.ink,
        }}
      >
        Le carnet
      </div>
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 20,
          color: C.inkFaded,
          marginTop: -4,
          marginBottom: 26,
        }}
      >
        des pensées libres, qui n'appartiennent à aucun film en particulier
      </div>

      <div
        data-tour="notebook-new"
        style={{
          background: C.card,
          padding: 20,
          boxShadow: "3px 5px 12px rgba(30,20,10,0.22)",
          transform: "rotate(-0.6deg)",
        }}
      >
        <input
          style={{
            ...underlineInput,
            fontFamily: F.title,
            fontStyle: "italic",
            fontSize: 19,
            fontWeight: 700,
          }}
          placeholder="Titre de la note"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          style={{ ...ruledTextarea, minHeight: 90, marginTop: 8 }}
          placeholder="Écrivez librement…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          onClick={create}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            marginTop: 14,
            background: C.pine,
            color: C.card,
            padding: "8px 16px",
            fontFamily: F.mono,
            fontSize: 11,
          }}
        >
          + AJOUTER LA PAGE
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 30 }}>
        {notes.length === 0 && (
          <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded }}>
            le carnet attend sa première page…
          </div>
        )}
        {[...notes]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((n) => (
            <div
              key={n.id}
              style={{
                background: C.card,
                padding: 18,
                boxShadow: "2px 4px 10px rgba(30,20,10,0.2)",
                transform: `rotate(${Number(tiltOf(n.id)) / 3}deg)`,
                position: "relative",
              }}
            >
              <button
                onClick={() => onDelete(n.id)}
                style={{
                  all: "unset",
                  ...tap,
                  position: "absolute",
                  top: 12,
                  right: 14,
                  cursor: "pointer",
                  color: C.inkFaded,
                }}
              >
                <Trash2 size={13} />
              </button>
              <input
                style={{
                  ...underlineInput,
                  fontFamily: F.title,
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: 18,
                  border: "none",
                }}
                value={n.title}
                onChange={(e) => onUpdate({ ...n, title: e.target.value })}
              />
              <textarea
                style={{ ...ruledTextarea, minHeight: 50, border: "none" }}
                value={n.body}
                onChange={(e) => onUpdate({ ...n, body: e.target.value })}
              />
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 9.5,
                  color: C.inkFaded,
                  marginTop: 6,
                }}
              >
                {new Date(n.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
