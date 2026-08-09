/* ============================================================
   CHERCHER PARTOUT — le tiroir

   Une seule question posée à tout le classeur, et les réponses rangées
   par nature. On y arrive par la loupe du pied de rail ou par Ctrl+K —
   les deux, parce que le raccourci ne se devine pas et que le bouton ne
   se retient pas.

   Les flèches parcourent, Entrée ouvre, Échap referme : c'est ce qu'on
   attend d'un champ de recherche, et rien de tout cela ne coûte quelque
   chose à qui l'ignore et clique.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search, Film as FilmIcon, User, Tag, Spline, NotebookPen } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { chercherPartout, parGenres, type Genre, type Trouvaille } from "../../domain/partout";
import type { Fil } from "../../domain/fils";
import type { Film, Note } from "../../types";
import { useViewport } from "../../hooks/useViewport";

/* Ce que chaque nature s'appelle une fois trouvée, et de quoi elle a
   l'air. L'icône n'est pas décorative : c'est ce qui permet de lire
   d'un coup d'œil qu'on regarde cinq natures et non une liste plate. */
const NATURES: Record<Genre, { titre: string; icon: typeof Search; teinte: string }> = {
  film: { titre: "Films", icon: FilmIcon, teinte: C.burgundy },
  personne: { titre: "Au générique", icon: User, teinte: C.plum },
  motif: { titre: "Motifs", icon: Tag, teinte: C.cobalt },
  fil: { titre: "Fils", icon: Spline, teinte: C.vermillion },
  page: { titre: "Carnet", icon: NotebookPen, teinte: C.pine },
};

export interface OuvrirTrouvaille {
  film: (id: string) => void;
  personne: (clé: string) => void;
  page: () => void;
  /** Le mur, sa recherche posée sur le libellé du motif. */
  motif: (label: string) => void;
  fil: () => void;
}

export function SearchDrawer({
  films,
  notes,
  fils,
  onClose,
  ouvrir,
}: {
  films: Film[];
  notes: Note[];
  fils: Fil[];
  onClose: () => void;
  ouvrir: OuvrirTrouvaille;
}) {
  const [q, setQ] = useState("");
  const { phone } = useViewport();
  const [curseur, setCurseur] = useState(0);
  const champ = useRef<HTMLInputElement>(null);

  const trouvailles = useMemo(
    () => chercherPartout(q, { films, notes, fils }),
    [q, films, notes, fils]
  );
  const groupes = useMemo(() => parGenres(trouvailles), [trouvailles]);
  /* La liste APLATIE, dans l'ordre où elle est dessinée : c'est elle que
     les flèches parcourent. Reconstruire l'ordre à la volée dans le
     gestionnaire de touches le ferait diverger de l'affichage au premier
     changement de mise en page. */
  const plate = useMemo(() => groupes.flatMap((g) => g.items), [groupes]);

  useEffect(() => {
    setCurseur(0);
  }, [q]);

  // le champ prend la main tout de suite : on ouvre ce tiroir pour taper
  useEffect(() => {
    champ.current?.focus();
  }, []);

  const ouvrirCelui = (t: Trouvaille) => {
    if (t.genre === "film" && t.filmId) ouvrir.film(t.filmId);
    else if (t.genre === "personne" && t.personne) ouvrir.personne(t.personne);
    else if (t.genre === "page") ouvrir.page();
    else if (t.genre === "motif") ouvrir.motif(t.titre);
    else if (t.genre === "fil") ouvrir.fil();
    onClose();
  };

  const auClavier = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (plate.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCurseur((c) => Math.min(c + 1, plate.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCurseur((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = plate[curseur];
      if (t) ouvrirCelui(t);
    }
  };

  /* MONTÉ SUR LE CORPS DE LA PAGE. Les vues vivent dans la colonne
     `[data-enters]`, dont la transformation d'entrée devient le repère
     des `position: fixed` qu'elle contient. Le tiroir de la soirée et la
     demande de confirmation ont déjà payé cette leçon. */
  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }}
      />
      <div
        role="dialog"
        aria-label="Chercher partout"
        onKeyDown={auClavier}
        style={{
          position: "fixed",
          /* HUIT POUR CENT DE HAUTEUR, C'EST UNE MARGE DE BUREAU.

             Sur un telephone, ces huit pour cent sont du vide au-dessus
             du champ, et les soixante-dix-huit restants s'arretent bien
             avant le bas de l'ecran : la liste des trouvailles tenait
             sur trois lignes. La feuille part donc sous l'encoche et
             descend aussi loin qu'elle peut. */
          top: `max(8vh, var(--safe-top))`,
          left: "50%",
          transform: "translateX(-50%)",
          width: phone ? "calc(100vw - 16px)" : "min(620px, 92vw)",
          maxHeight: phone ? "calc(100dvh - max(8vh, var(--safe-top)) - 16px)" : "78vh",
          zIndex: 60,
          background: C.paper,
          border: `1px solid ${C.line}`,
          boxShadow: "0 10px 34px rgba(0,0,0,0.34)",
          display: "flex",
          flexDirection: "column",
          animation: "sheetIn var(--motion-slow) var(--motion-ease) backwards",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: `1px solid ${C.line}`,
            flexShrink: 0,
          }}
        >
          <Search size={17} color={C.inkFaded} />
          <input
            ref={champ}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="un titre, un nom, un motif, un mot que vous avez écrit…"
            aria-label="Chercher dans tout le classeur"
            style={{
              all: "unset",
              ...tap,
              flex: 1,
              fontFamily: F.body,
              fontSize: 17,
              color: C.ink,
            }}
          />
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>ÉCHAP</span>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 0 12px" }}>
          {q.trim().length < 2 ? (
            <Mot>
              Deux lettres suffisent. La question est posée aux films, aux gens des génériques, aux
              motifs, aux fils et aux pages du carnet — d'un coup.
            </Mot>
          ) : plate.length === 0 ? (
            <Mot>Rien de ce nom dans le classeur.</Mot>
          ) : (
            groupes.map((g) => {
              const nature = NATURES[g.genre];
              const Icon = nature.icon;
              return (
                <div key={g.genre} style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 18px 3px",
                      fontFamily: F.mono,
                      fontSize: 9,
                      letterSpacing: 1,
                      color: nature.teinte,
                    }}
                  >
                    <Icon size={11} /> {nature.titre.toUpperCase()}
                  </div>
                  {g.items.map((t) => {
                    const rang = plate.indexOf(t);
                    const visé = rang === curseur;
                    return (
                      <button
                        key={t.clé}
                        onClick={() => ouvrirCelui(t)}
                        onMouseEnter={() => setCurseur(rang)}
                        aria-current={visé ? "true" : undefined}
                        style={{
                          all: "unset",
                          ...tap,
                          cursor: "pointer",
                          display: "block",
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "5px 18px",
                          background: visé ? alpha(nature.teinte, 0.12) : "transparent",
                          borderLeft: `3px solid ${visé ? nature.teinte : "transparent"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span
                            style={{
                              fontFamily: F.title,
                              fontWeight: 700,
                              fontSize: 14.5,
                              color: C.ink,
                            }}
                          >
                            {t.titre}
                          </span>
                          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                            {t.sous}
                          </span>
                        </div>
                        {/* CE QU'ON AVAIT ÉCRIT. Sans l'extrait, une
                            recherche sur ses propres mots ne rend qu'une
                            liste de titres — et l'on doit rouvrir chaque
                            fiche pour savoir laquelle parlait de quoi. */}
                        {t.extrait && (
                          <div
                            style={{
                              fontFamily: F.hand,
                              fontSize: 15,
                              color: C.inkFaded,
                              marginTop: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.extrait}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

function Mot({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 17,
        color: C.inkFaded,
        padding: "14px 20px",
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}
