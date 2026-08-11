/* ============================================================
   LE TIROIR DE LA SOIRÉE

   On dit le temps dont on dispose et l'humeur, le classeur tranche. Il
   ne propose qu'UN film à la fois : une liste de dix ramènerait le
   problème qu'on est venu résoudre, qui est justement de ne pas savoir
   choisir dans une liste. « Une autre » descend d'un cran.

   On ne marque pas le film vu depuis ici. On est AVANT le film, pas
   après : « JE L'AI VU » existe déjà sur la fiche, et c'est là qu'il a
   du sens.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Dice5, ArrowRight, Loader2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { PosterArt } from "../../components/film/PosterArt";
import { Label, SansCle } from "../../components/ui";
import { initialsOf } from "../../domain/film";
import { MOTIFS, suggestMotifs } from "../../domain/motifs";
import { classerLaSoirée, languesDeLaListe, CRÉNEAUX, type Envie } from "../../domain/soir";
import { nomLangue } from "../../noms";
import { useTmdbKey } from "../../services/tmdbKey";
import { fetchKeywords, pooled } from "../../tmdb";
import type { Film } from "../../types";

/* L'humeur se dit dans la famille « le ton » et nulle part ailleurs :
   « il pleut à la fin » raconte un film, « mélancolie » dit dans quel
   état on est ce soir. Ce sont deux vocabulaires, et le second est
   exactement celui qu'on cherchait. */
const HUMEURS = MOTIFS.filter((m) => m.famille === "ton" && !m.spoiler);

/* Au-delà, deviner l'humeur coûterait plus d'attente que la question ne
   vaut. On demande les mots-clés des mieux placés seulement — le
   classement sans humeur est déjà un classement. */
const PLAFOND_DEVINETTE = 40;

export function SoirDrawer({
  films,
  onClose,
  onOpen,
}: {
  /** TOUTE la collection : le profil de goût se bâtit sur les films vus. */
  films: Film[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [humeur, setHumeur] = useState<string[]>([]);
  const [langues, setLangues] = useState<string[]>([]);
  const [rang, setRang] = useState(0);
  const [devinés, setDevinés] = useState<Map<string, string[]>>(new Map());
  const [cherche, setCherche] = useState(false);

  const apiKey = useTmdbKey();
  const envie: Envie = { minutes, humeur, langues };

  const dispo = useMemo(() => languesDeLaListe(films), [films]);
  const propositions = useMemo(
    () => classerLaSoirée(films, envie, devinés),
    // `envie` est reconstruit à chaque rendu : on dépend de ses parties
    [films, minutes, humeur, langues, devinés]
  );

  /* Changer d'avis remet la pile à zéro : « une autre » veut dire « la
     suivante de CE classement-ci », et garder le rang après avoir changé
     de créneau ferait sauter des propositions jamais montrées. */
  useEffect(() => {
    setRang(0);
  }, [minutes, humeur, langues]);

  /* DEVINER L'HUMEUR DES FILMS QU'ON N'A PAS VUS.

     Un film non vu ne porte aucun motif — personne ne peut dire « il
     pleut à la fin » d'un film qu'il n'a pas vu. Les mots-clés TMDB y
     répondent, et `suggestMotifs` sait déjà les traduire en motifs :
     c'est ainsi que la fiche en propose.

     On ne le fait QUE si une humeur est demandée, et seulement sur les
     mieux placés du classement courant : sans cela, poser la question
     lancerait un appel par film de toute la liste. `pooled` borne la
     concurrence et avale les échecs — un mot-clé perdu ne doit pas
     annuler la soirée. */
  useEffect(() => {
    if (!apiKey || humeur.length === 0) return;
    const àDeviner = propositions
      .slice(0, PLAFOND_DEVINETTE)
      .map((p) => p.film)
      .filter((f) => f.tmdbId && !devinés.has(f.id));
    if (àDeviner.length === 0) return;

    let vivant = true;
    setCherche(true);
    pooled(
      àDeviner.map((f) => async () => {
        const mots = await fetchKeywords(f.tmdbId, apiKey);
        return [f.id, suggestMotifs(mots).map((m) => m.id)] as [string, string[]];
      }),
      { concurrency: 5 }
    )
      .then((paires: ([string, string[]] | null)[]) => {
        if (!vivant) return;
        setDevinés((avant) => {
          const suite = new Map(avant);
          /* Les films dont la devinette a échoué sont marqués VIDES et
             non laissés absents : sans cette trace, l'effet les
             redemanderait à chaque rendu, indéfiniment. */
          for (const f of àDeviner) suite.set(f.id, []);
          for (const p of paires) if (p) suite.set(p[0], p[1]);
          return suite;
        });
      })
      .finally(() => {
        if (vivant) setCherche(false);
      });

    return () => {
      vivant = false;
    };
  }, [apiKey, humeur, propositions, devinés]);

  // Échap ferme, comme partout ailleurs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choix = propositions[rang] || null;
  const bascule = (liste: string[], v: string) =>
    liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];

  /* MONTÉ SUR LE CORPS DE LA PAGE, PAS LÀ OÙ ON L'APPELLE.

     Les vues vivent dans la colonne `[data-enters]`, qui porte une
     transformation le temps de son animation d'entrée — et une
     transformation devient le repère des `position: fixed` qu'elle
     contient. Le tiroir s'ancrerait alors sur la colonne, donc sur le
     haut du document, et s'ouvrirait hors de l'écran quand on le
     demande depuis le bas d'un long mur. Le piège a déjà mordu une
     fois, sur la demande de confirmation. */
  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }}
      />
      <div
        role="dialog"
        aria-label="Lequel ce soir ?"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(430px, 92vw)",
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
              fontSize: 27,
              color: C.ink,
            }}
          >
            Lequel ce soir ?
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ ...nu, marginLeft: "auto" }}>
            <X size={16} color={C.inkFaded} />
          </button>
        </div>
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, margin: "2px 0 20px" }}>
          Dites le temps que vous avez, et dans quel état vous êtes.
        </div>

        {/* ---- le temps ---- */}
        <div data-tour="soir-temps" style={{ marginBottom: 18 }}>
          <Label>J'ai</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button onClick={() => setMinutes(null)} style={puce(minutes === null)}>
              peu importe
            </button>
            {CRÉNEAUX.map((c) => (
              <button
                key={c.minutes}
                onClick={() => setMinutes(c.minutes)}
                style={puce(minutes === c.minutes)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- l'humeur ---- */}
        <div data-tour="soir-humeur" style={{ marginBottom: 18 }}>
          <Label>Je suis d'humeur</Label>
          {!apiKey && (
            /* Sans clé, les motifs d'une fiche non vue n'existent pas et
               rien ne peut les deviner. On le dit plutôt que de laisser
               une molette qui ne répond à rien. */
            <SansCle quoi="deviner l'humeur d'un film que vous n'avez pas encore annoté" />
          )}
          {!apiKey && (
            <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, margin: "6px 0" }}>
              en attendant, l&apos;humeur se lit sur vos propres motifs.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HUMEURS.map((m) => (
              <button
                key={m.id}
                onClick={() => setHumeur((h) => bascule(h, m.id))}
                style={puce(humeur.includes(m.id), C.cobalt)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- la langue, s'il y a de quoi choisir ---- */}
        {dispo.length > 1 && (
          <div style={{ marginBottom: 22 }}>
            <Label>En</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dispo.slice(0, 8).map(({ code, n }) => (
                <button
                  key={code}
                  onClick={() => setLangues((l) => bascule(l, code))}
                  style={puce(langues.includes(code), C.moss)}
                >
                  {nomLangue(code)} · {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 18 }}>
          {cherche && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontFamily: F.mono,
                fontSize: 10,
                color: C.inkFaded,
                marginBottom: 10,
              }}
            >
              <Loader2 size={12} /> on lit ce que TMDB dit de ces films…
            </div>
          )}

          {!choix ? (
            <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded }}>
              {propositions.length === 0
                ? "Rien dans « à voir » ne répond — ou la liste est vide."
                : "Vous les avez tous passés en revue."}
            </div>
          ) : (
            <Carte
              choix={choix}
              rang={rang}
              total={propositions.length}
              onAutre={() => setRang((r) => r + 1)}
              onOuvrir={() => {
                onOpen(choix.film.id);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

function Carte({
  choix,
  rang,
  total,
  onAutre,
  onOuvrir,
}: {
  choix: ReturnType<typeof classerLaSoirée>[number];
  rang: number;
  total: number;
  onAutre: () => void;
  onOuvrir: () => void;
}) {
  const f = choix.film;
  return (
    <div data-tour="soir-carte">
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ width: 96, flexShrink: 0 }}>
          <PosterArt film={f} height={144} initials={initialsOf(f.title)} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.title, fontWeight: 700, fontSize: 19, color: C.ink }}>
            {f.title}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 3 }}>
            {[f.year || "s.d.", f.director].filter(Boolean).join(" · ")}
          </div>
          {/* LES RAISONS, EN CLAIR. Un score ne se discute pas ; une
              phrase, si — et c'est elle qui donne envie ou pas. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
            {choix.raisons.map((r, i) => (
              <span
                key={i}
                style={{
                  fontFamily: F.mono,
                  fontSize: 9,
                  letterSpacing: 0.4,
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: `1px solid ${alpha(C.ink, 0.18)}`,
                  color: C.inkFaded,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <button onClick={onOuvrir} style={{ ...puce(true), padding: "5px 12px" }}>
          <ArrowRight size={11} /> sa fiche
        </button>
        <button
          onClick={onAutre}
          disabled={rang + 1 >= total}
          style={{
            ...puce(false, C.slate),
            padding: "5px 12px",
            opacity: rang + 1 >= total ? 0.4 : 1,
            cursor: rang + 1 >= total ? "default" : "pointer",
          }}
        >
          <Dice5 size={11} /> une autre
        </button>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, marginLeft: "auto" }}>
          {rang + 1} / {total}
        </span>
      </div>
    </div>
  );
}

const nu = { all: "unset" as const, cursor: "pointer", display: "flex", alignItems: "center" };

const puce = (on: boolean, teinte: string = C.burgundy) => ({
  all: "unset" as const,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: F.mono,
  fontSize: 9.5,
  letterSpacing: 0.5,
  padding: "3px 9px",
  borderRadius: 12,
  border: `1px solid ${teinte}`,
  background: on ? teinte : "transparent",
  color: on ? C.card : teinte,
  transition: "background var(--motion-fast) ease, color var(--motion-fast) ease",
});
