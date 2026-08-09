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
import { Eye, EyeOff, Plus, Spool, Trash2, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import {
  FAMILLES,
  chercheMotifs,
  estPerso,
  motifById,
  motifsDe,
  parFamille,
} from "../../domain/motifs";
import type { Motif, MotifFamille } from "../../domain/motifs";

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
  /* Même règle que `TagChip` : « Une fin heureuse à laquelle on ne croit
     pas » est plus large que la colonne où il se pose, et sans ceci il la
     pousse. Il passe à la ligne dans la puce. */
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
  onCréer,
  onSupprimer,
  onMasquer,
  masqués = [],
}: {
  motifs?: string[];
  onChange: (next: string[]) => void;
  /** Ce que TMDB propose. Rien n'entre sans un clic. */
  suggestions?: Motif[];
  /** Faire de ce motif une question posée à toute la collection. */
  onFaireUnFil?: (motifId: string) => void;
  /** Ajouter un motif au vocabulaire. Absent : la liste reste en lecture. */
  onCréer?: (label: string, famille: MotifFamille, spoiler: boolean) => void;
  /** Retirer l'un des vôtres — la confirmation et le ménage sont à l'appelant. */
  onSupprimer?: (motif: Motif) => void;
  /** Écarter l'un du catalogue, ou le remettre. */
  onMasquer?: (motifId: string, masqué: boolean) => void;
  /** Ceux du catalogue déjà écartés, pour les proposer au retour. */
  masqués?: Motif[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [révélés, setRévélés] = useState<string[]>([]);
  const [neuf, setNeuf] = useState("");
  const [famille, setFamille] = useState<MotifFamille>("récit");
  const [spoiler, setSpoiler] = useState(false);

  /* `motifsDe` et non un filtre sur le catalogue : un motif à vous n'est
     pas dans `MOTIFS`, et la fiche l'aurait perdu à l'affichage. */
  const posés = useMemo(() => motifsDe({ motifs }), [motifs]);
  const familles = useMemo(() => parFamille(), [ouvert, motifs]);
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
                  style={chipStyle(estPerso(m.id) ? C.cobalt : C.pine, motifs.includes(m.id))}
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
                        style={chipStyle(estPerso(m.id) ? C.cobalt : C.pine, motifs.includes(m.id))}
                      >
                        {m.label}
                      </button>
                      {/* CE QU'ON PEUT FAIRE D'UN MOTIF DÉPEND DE SON ORIGINE.

                          Le vôtre se SUPPRIME : il n'existe que dans vos
                          données, personne d'autre ne le remettra. Celui du
                          catalogue se MASQUE seulement — l'effacer de vos
                          données le verrait revenir à la prochaine mise à
                          jour, ce qui est pire que de ne pas l'avoir enlevé. */}
                      {estPerso(m.id) && onSupprimer && (
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
                      {!estPerso(m.id) && onMasquer && (
                        <button
                          onClick={() => onMasquer(m.id, true)}
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

          {/* CRÉER LE SIEN, LÀ OÙ L'ON CHERCHAIT.

              Le catalogue ne peut pas tout prévoir, et le moment où l'on
              s'en aperçoit est exactement celui-ci : on vient de parcourir
              la liste sans y trouver son idée. */}
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
                  onChange={(e) => setFamille(e.target.value as MotifFamille)}
                  aria-label="Famille du motif"
                  style={{
                    ...underlineInput,
                    flex: "1 1 140px",
                    minWidth: 0,
                    fontFamily: F.mono,
                    fontSize: 10,
                  }}
                >
                  {FAMILLES.map((f) => (
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

          {/* Ce qu'on a écarté reste rappelable : masquer n'est pas jeter, et
              un vocabulaire qu'on ne peut pas rouvrir se referme pour de bon
              à la première hésitation. */}
          {onMasquer && masqués.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 10 }}>
              <div style={rubrique}>ÉCARTÉS ({masqués.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {masqués.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onMasquer(m.id, false)}
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
