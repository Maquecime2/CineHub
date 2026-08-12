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
import { Eye, EyeOff, Plus, Spool, Trash2, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import {
  FAMILIES,
  searchMotifs,
  isCustom,
  motifById,
  motifsOf,
  byFamily,
} from "../../domain/motifs";
import type { Motif, MotifFamily } from "../../domain/motifs";

const rubrique = {
  fontFamily: F.mono,
  fontSize: 9.5,
  color: C.inkFaded,
  letterSpacing: 1,
  marginBottom: 4,
} as const;

const chipStyle = (encre: string, actif: boolean) => ({
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
  border: `1px solid ${encre}`,
  color: actif ? C.card : encre,
  background: actif ? encre : "transparent",
});

/** A motif laid on the card, scratched out if it tells the ending. */
function MotifChip({
  motif,
  révélé,
  onRévéler,
  onRemove,
}: {
  motif: Motif;
  révélé: boolean;
  onRévéler: () => void;
  onRemove: () => void;
}) {
  const caché = !!motif.spoiler && !révélé;
  return (
    <span
      style={{
        ...chipStyle(caché ? C.inkFaded : C.pine, false),
        background: caché ? alpha(C.ink, 0.12) : "transparent",
        cursor: caché ? "pointer" : "default",
      }}
      onClick={caché ? onRévéler : undefined}
      title={caché ? "Ce motif raconte la fin — cliquez pour le lire" : undefined}
    >
      {caché ? (
        <>
          <Eye size={10} />
          motif de fin
        </>
      ) : (
        motif.label
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Retirer « ${motif.label} »`}
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
  onMakeThread,
  onCréer,
  onSupprimer,
  onHide,
  masqués = [],
}: {
  motifs?: string[];
  onChange: (next: string[]) => void;
  /** What TMDB offers. Nothing enters without a click. */
  suggestions?: Motif[];
  /** Turn this motif into a question asked of the whole collection. */
  onMakeThread?: (motifId: string) => void;
  /** Add a motif to the vocabulary. Absent: the list stays read-only. */
  onCréer?: (label: string, famille: MotifFamily, spoiler: boolean) => void;
  /** Remove one of your own — the confirmation and the tidying are the caller's. */
  onSupprimer?: (motif: Motif) => void;
  /** Set one of the catalogue's aside, or put it back. */
  onHide?: (motifId: string, hidden: boolean) => void;
  /** Those of the catalogue already set aside, to offer them back. */
  masqués?: Motif[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [révélés, setRévélés] = useState<string[]>([]);
  const [neuf, setNeuf] = useState("");
  const [famille, setFamille] = useState<MotifFamily>("narrative");
  const [spoiler, setSpoiler] = useState(false);

  /* `motifsOf` and not a filter on the catalogue: a motif of yours is not
     in `MOTIFS`, and the card would have lost it on display. */
  const posés = useMemo(() => motifsOf({ motifs }), [motifs]);
  const familles = useMemo(() => byFamily(), [ouvert, motifs]);
  const trouvés = useMemo(() => (q.trim() ? searchMotifs(q) : []), [q]);
  const àProposer = suggestions.filter((m) => !motifs.includes(m.id));

  const poser = (id: string) => {
    if (!motifs.includes(id)) onChange([...motifs, id]);
  };
  const ôter = (id: string) => onChange(motifs.filter((x) => x !== id));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {posés.map((m) => (
          <MotifChip
            key={m.id}
            motif={m}
            révélé={révélés.includes(m.id)}
            onRévéler={() => setRévélés((c) => [...c, m.id])}
            onRemove={() => ôter(m.id)}
          />
        ))}
        {posés.length === 0 && (
          <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>aucun motif</span>
        )}
      </div>

      {/* What TMDB offers, dotted and never laid automatically: its
          keywords range from the very apt to the frankly wrong, and they
          will then serve to build the map. */}
      {àProposer.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginRight: 2 }}>
            PROPOSÉ PAR TMDB —
          </span>
          {àProposer.map((m) => (
            <button
              key={m.id}
              onClick={() => poser(m.id)}
              style={{ ...chipStyle(C.ochre, false), borderStyle: "dashed" }}
            >
              <Plus size={10} />
              {m.spoiler ? "motif de fin" : m.label}
            </button>
          ))}
        </div>
      )}

      {posés.length > 0 && onMakeThread && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {posés.map((m) => (
            <button
              key={m.id}
              onClick={() => onMakeThread(m.id)}
              title={`Rassembler tous les films portant « ${m.label} »`}
              style={{ ...chipStyle(C.slate, false), fontSize: 9.5 }}
            >
              <Spool size={10} />
              EN FAIRE UN FIL
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
        {ouvert ? "REFERMER LA LISTE" : "CHOISIR DES MOTIFS"}
      </button>

      {ouvert && (
        <div style={{ marginTop: 10, border: `1px dashed ${C.line}`, padding: "12px 14px" }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="chercher un motif…"
            style={{ ...underlineInput, fontSize: 14, marginBottom: 10 }}
          />
          {q.trim() ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {trouvés.length === 0 && (
                <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
                  aucun motif de ce nom
                </span>
              )}
              {trouvés.map((m) => (
                <button
                  key={m.id}
                  onClick={() => poser(m.id)}
                  style={chipStyle(isCustom(m.id) ? C.cobalt : C.pine, motifs.includes(m.id))}
                >
                  {m.label}
                </button>
              ))}
              {onCréer &&
                !trouvés.some((m) => m.label.toLowerCase() === q.trim().toLowerCase()) && (
                  <button
                    onClick={() => {
                      onCréer(q, famille, spoiler);
                      setQ("");
                    }}
                    style={{ ...chipStyle(C.cobalt, false), borderStyle: "dashed" }}
                  >
                    <Plus size={10} />
                    créer « {q.trim()} »
                  </button>
                )}
            </div>
          ) : (
            familles.map((f) => (
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
                  {f.label.toUpperCase()}
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
                        onClick={() => (motifs.includes(m.id) ? ôter(m.id) : poser(m.id))}
                        style={chipStyle(isCustom(m.id) ? C.cobalt : C.pine, motifs.includes(m.id))}
                      >
                        {m.label}
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
                          aria-label={"Supprimer le motif " + m.label}
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
                          aria-label={"Écarter le motif " + m.label}
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
          {onCréer && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 4 }}>
              <div style={rubrique}>LE VÔTRE</div>
              <input
                value={neuf}
                onChange={(e) => setNeuf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !neuf.trim()) return;
                  e.preventDefault();
                  onCréer(neuf, famille, spoiler);
                  setNeuf("");
                  setSpoiler(false);
                }}
                aria-label="Nouveau motif"
                placeholder="« il pleut sans arrêt », puis Entrée"
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
                  value={famille}
                  onChange={(e) => setFamille(e.target.value as MotifFamily)}
                  aria-label="Famille du motif"
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
                      {f.label}
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
                  il raconte la fin
                </label>
              </div>
            </div>
          )}

          {/* What has been set aside stays recallable: hiding is not
              throwing away, and a vocabulary one cannot reopen closes for
              good at the first hesitation. */}
          {onHide && masqués.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
              <div style={rubrique}>ÉCARTÉS ({masqués.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {masqués.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onHide(m.id, false)}
                    title="Le remettre dans la liste"
                    style={{ ...chipStyle(C.inkFaded, false), borderStyle: "dashed" }}
                  >
                    <Eye size={9} />
                    {m.label}
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
