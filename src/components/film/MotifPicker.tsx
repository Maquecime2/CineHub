/* ============================================================
   LES MOTIFS D'UNE FICHE — on choisit, on n'écrit pas
   ============================================================

   La différence avec `TagEditor` est tout le sujet : là-bas on tape ce
   qu'on veut, ici on prend dans une liste. Un champ libre redonnerait
   « fin triste » et « ça finit mal », et c'est justement ce qu'on essaie
   de ne plus avoir.

   LES MOTIFS QUI RACONTENT LA FIN SE POSENT COMME LES AUTRES, MAIS NE
   S'AFFICHENT PAS COMME EUX. Ranger sa collection ne doit pas gâcher les
   films qu'on n'a pas encore vus : un motif `spoiler` reste gratté tant
   qu'on ne l'a pas dévoilé, et le dévoilement ne vaut que pour la fiche
   ouverte — il ne s'enregistre nulle part.
   ============================================================ */
import { useMemo, useState } from "react";
import { Eye, Plus, Spool, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { MOTIFS, chercheMotifs, motifById, parFamille } from "../../domain/motifs";
import type { Motif } from "../../domain/motifs";

const chipStyle = (encre: string, actif: boolean) => ({
  all: "unset" as const,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: F.mono,
  fontSize: 10.5,
  padding: "3px 10px",
  borderRadius: "var(--tag-radius)",
  border: `1px solid ${encre}`,
  color: actif ? C.card : encre,
  background: actif ? encre : "transparent",
});

/** Un motif posé sur la fiche, gratté s'il raconte la fin. */
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
  onFaireUnFil,
}: {
  motifs?: string[];
  onChange: (next: string[]) => void;
  /** Ce que TMDB propose. Rien n'entre sans un clic. */
  suggestions?: Motif[];
  /** Faire de ce motif une question posée à toute la collection. */
  onFaireUnFil?: (motifId: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [révélés, setRévélés] = useState<string[]>([]);

  const posés = useMemo(() => MOTIFS.filter((m) => motifs.includes(m.id)), [motifs]);
  const familles = useMemo(() => parFamille(), []);
  const trouvés = useMemo(() => (q.trim() ? chercheMotifs(q) : []), [q]);
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

      {/* Ce que TMDB propose, en pointillé et jamais posé d'office : ses
          mots-clés vont du très juste au franchement faux, et ils
          serviront ensuite à bâtir la carte. */}
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

      {posés.length > 0 && onFaireUnFil && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {posés.map((m) => (
            <button
              key={m.id}
              onClick={() => onFaireUnFil(m.id)}
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
                  style={chipStyle(C.pine, motifs.includes(m.id))}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            familles.map((f) => (
              <div key={f.famille} style={{ marginBottom: 10 }}>
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
                    <button
                      key={m.id}
                      onClick={() => (motifs.includes(m.id) ? ôter(m.id) : poser(m.id))}
                      style={chipStyle(C.pine, motifs.includes(m.id))}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export { motifById };
