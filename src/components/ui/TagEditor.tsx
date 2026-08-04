/* ============================================================
   MOTS-CLÉS — le champ `themes` du modèle, rendu vraiment utilisable.
   Il existait depuis le début mais n'était saisissable qu'à la création,
   en une ligne séparée par des virgules. Ici : ajout, suppression, et
   suggestions tirées des mots-clés déjà employés ailleurs, pour éviter
   qu'« Solitude » et « solitude » deviennent deux étiquettes distinctes.
   ============================================================ */
import { useState } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { hash, pickFrom } from "../../domain/seeded";

const TAG_INKS = [C.pine, C.cobalt, C.vermillion, C.ochre, C.moss] as const;

export const tagInk = (t: string): string => pickFrom(TAG_INKS, Math.abs(hash(t)));

export function TagChip({
  tag,
  onRemove,
  onClick,
  active,
  small,
}: {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  small?: boolean;
}) {
  const ink = tagInk(tag);
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "'Special Elite', monospace",
        fontSize: small ? 9.5 : 10.5,
        border: `1px solid ${ink}`,
        borderRadius: 12,
        padding: small ? "2px 8px" : "3px 10px",
        color: active ? C.card : ink,
        background: active ? ink : "transparent",
        cursor: onClick ? "pointer" : "default",
        transform: `rotate(${(Math.abs(hash(tag)) % 5) - 2}deg)`,
      }}
    >
      {tag}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ all: "unset", cursor: "pointer", display: "flex" }}
        >
          <X size={9} />
        </button>
      )}
    </span>
  );
}

export function TagEditor({
  tags = [],
  allTags = [],
  onChange,
}: {
  tags?: string[];
  allTags?: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const clean = (s: string) => s.trim().replace(/\s+/g, " ");

  const add = (raw: string) => {
    const t = clean(raw);
    if (!t) return;
    // on réutilise la casse déjà en usage plutôt que d'en créer une variante
    const existing = allTags.find((x) => x.toLowerCase() === t.toLowerCase());
    const final = existing || t;
    if (!tags.some((x) => x.toLowerCase() === final.toLowerCase())) onChange([...tags, final]);
    setDraft("");
  };

  const suggestions = draft.trim()
    ? allTags
        .filter((t) => t.toLowerCase().includes(draft.trim().toLowerCase()) && !tags.includes(t))
        .slice(0, 6)
    : [];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {tags.map((t) => (
          <TagChip key={t} tag={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />
        ))}
        {tags.length === 0 && (
          <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded }}>
            aucun mot-clé
          </span>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <input
          style={{ ...underlineInput, fontSize: 14 }}
          value={draft}
          placeholder="ajouter un mot-clé, puis Entrée"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
            if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
          }}
        />
        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 10,
              background: C.card,
              border: `1px solid ${C.line}`,
              boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
              minWidth: 160,
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 11px",
                  fontFamily: "'Lora', serif",
                  fontSize: 13,
                  color: C.ink,
                  borderBottom: `1px solid ${C.line}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
