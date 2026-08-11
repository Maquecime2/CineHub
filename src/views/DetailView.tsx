/* ============================================================
   VUE — DOSSIER FILM
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Link2,
  Paperclip,
  Moon,
  Archive,
  ArchiveRestore,
  X,
} from "lucide-react";
import { C, F } from "../theme/tokens";
import { underlineInput, tap } from "../theme/styles";
import { uid, withWatches, initialsOf } from "../domain/film";
import { searchFilms } from "../domain/search";
import { putImage } from "../db";
import { imageSize, shrinkImage } from "../services/images";
import { Carton, Confirmation, Consigne, Label, InkStars, TitreSection } from "../components/ui";
import type { DemandeConfirmation } from "../components/ui";
import { TagEditor } from "../components/ui/TagEditor";
import { MotifPicker } from "../components/film/MotifPicker";
import { MOTIFS, suggestMotifs } from "../domain/motifs";
import type { Motif, MotifFamille } from "../domain/motifs";
import { fetchKeywords } from "../tmdb";
import { useTmdbKey } from "../services/tmdbKey";
import { StampCorner, Tape } from "../components/atmosphere";
import { PosterArt } from "../components/film/PosterArt";
import { PosterPicker } from "../components/film/PosterPicker";
import { FilmIdentity } from "../components/film/FilmIdentity";
import { TmdbFacts } from "../components/film/TmdbFacts";
import { Ailleurs } from "../components/film/Ailleurs";
import { RangerDansUneListe } from "../components/film/RangerDansUneListe";
import { EcarterDuPartage } from "../components/film/EcarterDuPartage";
import { TmdbLink } from "../components/film/TmdbLink";
import { WatchLog } from "../components/film/WatchLog";
import { ThreadBoard } from "../components/film/ThreadBoard";
import { LINK_TYPES } from "../components/film/linkTypes";
import { FORCES, RELATIONS_SAISISSABLES, forceDe } from "../domain/relations";
import { SillagePanel } from "./detail/SillagePanel";
import { StillsStrip } from "../components/stills/StillsStrip";
import { StillLightbox } from "../components/stills/StillLightbox";
import { RichField } from "../components/stills/RichField";
import type { Film, Force, LinkPatch, LinkType, Relation, Still } from "../types";

/** Les deux champs de texte de la fiche, où une capture peut s'insérer. */
type TextField = "review" | "notes";

/* ============================================================
   LES TROIS INTERCALAIRES DU DOSSIER
   ============================================================

   La fiche alignait onze blocs de même poids dans quatre colonnes
   souples. « Souples » veut dire qu'elles se replient quand la place
   manque — et l'ordre dans lequel elles se replient dépend de la
   largeur de la fenêtre, c'est-à-dire de rien : le journal des séances
   pouvait se retrouver au-dessus ou au-dessous de la critique selon
   qu'on avait ouvert le navigateur en grand.

   Trois intercalaires, et une question par intercalaire :

     LE FILM   — ce que l'œuvre EST. Catalogue, relevé TMDB, identité.
     MES MOTS  — ce que VOUS en avez fait. Séances, critique, notes,
                 pellicule, mots-clés, motifs, rangement.
     LES LIENS — ce qu'elle touche autour d'elle. Le fil rouge que vous
                 avez tendu, et le sillage que la machine propose.

   L'ONGLET EST CONTRÔLÉ DEPUIS `App`, et ce n'est pas de la
   sur-ingénierie : la visite guidée doit pouvoir OUVRIR l'onglet d'une
   étape avant d'en chercher la cible, exactement comme elle ouvre déjà
   la vue. Un onglet purement local rendrait quatre des sept étapes du
   tour « detail » impossibles à jouer. Voir `onglet` dans `TourStep`. */
export type OngletFiche = "film" | "mots" | "liens";

const ONGLETS: { clé: OngletFiche; label: string }[] = [
  { clé: "film", label: "LE FILM" },
  { clé: "mots", label: "MES MOTS" },
  { clé: "liens", label: "LES LIENS" },
];

function BarreOnglets({
  valeur,
  onChange,
}: {
  valeur: OngletFiche;
  onChange: (o: OngletFiche) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Les parties du dossier"
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 24,
        borderBottom: `1px solid ${C.line}`,
        paddingBottom: 9,
      }}
    >
      {ONGLETS.map((o) => {
        const actif = o.clé === valeur;
        return (
          <button
            key={o.clé}
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.clé)}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 14px",
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: "var(--tag-tracking)",
              color: actif ? C.card : C.inkFaded,
              background: actif ? C.burgundy : "transparent",
              border: `1px solid ${actif ? C.burgundy : C.line}`,
              borderRadius: "var(--tag-radius)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface DetailViewProps {
  film: Film;
  onBack: () => void;
  /** Ce que le bouton de retour annonce. Défaut : « RETOUR AU MUR ». */
  retourVers?: string;
  onUpdate: (f: Film) => void;
  onDelete: (id: string) => void;
  films?: Film[];
  /** Relie deux fiches du mur : le lien est posé des deux côtés, la
   *  relation renversée à l'autre bout. */
  onLinkFilm: (aId: string, bId: string, note: string, relation?: Relation, force?: Force) => void;
  onRemoveLink: (filmId: string, workId: string) => void;
  /** Retouche un fil : le modele decide de ce qu il accepte. */
  onEditLink: (filmId: string, workId: string, patch: LinkPatch) => void;
  onOpen: (id: string) => void;
  /** Ouvre le dossier de quelqu'un du générique, par son nom écrit. */
  onOpenPerson?: (nom: string) => void;
  /** Range une proposition du sillage dans la liste « à voir ». */
  onAddToWatchlist?: (f: Film) => void;
  /** Faire d'un motif une question posée à toute la collection. */
  onFaireUnFil?: (motifId: string) => void;
  /** Le vocabulaire à vous : vos motifs, et ceux du catalogue écartés. */
  vocabulaire?: { perso: Motif[]; masqués: string[] };
  /** Rend l'identifiant du motif écrit, pour le poser aussitôt sur la fiche. */
  onCréerMotif?: (label: string, famille: MotifFamille, spoiler: boolean) => string | null;
  onSupprimerMotif?: (motifId: string) => void;
  onMasquerMotif?: (motifId: string, masqué: boolean) => void;
  /** Un compte est ouvert : la fiche peut alors lire ce qu'on en dit ailleurs. */
  connecte?: boolean;
  /**
   * L'intercalaire ouvert, tenu par `App`.
   *
   * Absent, la fiche s'en tient un à elle — c'est le cas d'un test ou
   * d'un montage isolé. Présent, il gagne : c'est ce qui permet à la
   * visite guidée d'ouvrir l'onglet de sa cible.
   */
  onglet?: OngletFiche;
  onOnglet?: (o: OngletFiche) => void;
}

export function DetailView({
  film,
  onBack,
  retourVers,
  onUpdate,
  onDelete,
  films = [],
  onLinkFilm,
  onRemoveLink,
  onFaireUnFil,
  onEditLink,
  onOpen,
  onOpenPerson,
  onAddToWatchlist,
  vocabulaire = { perso: [], masqués: [] },
  onCréerMotif,
  onSupprimerMotif,
  onMasquerMotif,
  connecte = false,
  onglet: ongletContrôlé,
  onOnglet,
}: DetailViewProps) {
  const apiKey = useTmdbKey();
  /* Le repli local suit le contrôlé plutôt que de lutter contre lui :
     l'un ou l'autre répond, jamais les deux à la fois. */
  const [ongletLocal, setOngletLocal] = useState<OngletFiche>("film");
  const onglet = ongletContrôlé ?? ongletLocal;
  const changerOnglet = (o: OngletFiche) => {
    setOngletLocal(o);
    onOnglet?.(o);
  };
  /* Une seule demande à la fois, portée par la vue : les trois gestes qui
     la lèvent — supprimer la fiche, la mettre de côté, supprimer un motif —
     n'ont rien à partager sinon le fait qu'on puisse s'être trompé. */
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("book");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkCreator, setLinkCreator] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [linkRelation, setLinkRelation] = useState<Relation | "">("");
  const [linkForce, setLinkForce] = useState<Force>(2);
  const [picked, setPicked] = useState<Film | null>(null); // fiche existante retenue
  // le vocabulaire déjà employé dans la collection, pour ne pas le fragmenter
  const allTags = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.themes || []))).sort(),
    [films]
  );

  const stills = film.stills || [];
  const [lightbox, setLightbox] = useState<number | null>(null); // index de la capture ouverte
  const [focusField, setFocusField] = useState<TextField>("review"); // champ où « insérer » écrit
  const [busy, setBusy] = useState(0);
  const inserters = useRef<Partial<Record<TextField, (token: string) => string>>>({}); // insertion à la position du curseur
  const insertToken = (n: number) => {
    const next = inserters.current[focusField]?.(`[img:${n}]`);
    if (next != null) onUpdate({ ...film, [focusField]: next });
  };

  /* Ranger des images dans la pellicule. `insert` sert au collage : coller
     une capture pendant qu'on écrit doit aussi poser le jeton au curseur,
     sinon il faudrait redescendre la chercher dans la bande. */
  const addStills = async (files: FileList | File[] | null, { insert = false } = {}) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    const added: Still[] = [];
    for (const file of list) {
      try {
        /* Le fichier d'origine est stocké TEL QUEL : aucun redimensionnement,
           aucun ré-encodage. Un PNG reste un PNG, pixel pour pixel. C'est la
           visionneuse et la sauvegarde qui s'en servent.
           À côté, une vignette légère sert la bande et le texte : afficher
           une image 4K dans une case de 110 px serait ruineux pour rien. */
        const key = `still-${film.id}-${uid()}`;
        const thumbKey = `${key}-thumb`;
        await putImage(key, file);
        await putImage(thumbKey, await shrinkImage(file, 480));
        const dim = await imageSize(file);
        added.push({
          id: uid(),
          key,
          thumbKey,
          caption: "",
          ...dim,
          bytes: file.size,
          type: file.type,
        });
      } catch (e) {
        console.error(e);
      }
      setBusy((b) => b - 1);
    }
    setBusy(0);
    if (!added.length) return;

    // une seule écriture : captures et texte partent ensemble, sinon la
    // seconde mise à jour repartirait d'une fiche sans les captures
    const patch = { ...film, stills: [...stills, ...added] };
    if (insert) {
      const tokens = added.map((_, i) => `[img:${stills.length + i + 1}]`).join("");
      const next = inserters.current[focusField]?.(tokens);
      if (next != null) patch[focusField] = next;
    }
    onUpdate(patch);
  };

  /* Le collage est écouté sur toute la fiche : selon les navigateurs, un
     Ctrl+V hors champ de saisie ne remonte pas jusqu'à un conteneur. */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items || [])]
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null);
      if (!files.length) return; // un collage de texte reste un collage de texte
      e.preventDefault();
      // le champ de critique est un div éditable, pas un textarea
      const el = document.activeElement as HTMLElement | null;
      const inField = el?.isContentEditable || ["TEXTAREA", "INPUT"].includes(el?.tagName ?? "");
      addStills(files, { insert: inField });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [film, stills.length, focusField]);

  /* Quand on cherche un film, on propose ceux de la collection — vidéothèque
     et watchlist confondues. Rien n'oblige à en choisir un : le champ reste
     libre pour les films qu'on ne possède pas encore. */
  const already = new Set((film.linkedWorks || []).map((w) => w.filmId).filter(Boolean));
  const suggestions = useMemo(() => {
    if (linkType !== "film") return [];
    const q = linkTitle.trim();
    if (!q) return [];
    return searchFilms(
      films.filter((f) => f.id !== film.id && !already.has(f.id)),
      q,
      6
    );
  }, [films, film.id, linkTitle, linkType, film.linkedWorks]);

  /* CE QUE TMDB PROPOSE — demandé à l'ouverture de la fiche, et seulement
     si l'on a une clé et un identifiant. Un seul appel, jamais en masse :
     ce sont des propositions à relire, pas une récolte. */
  const [proposés, setProposés] = useState<Motif[]>([]);
  useEffect(() => {
    let vivant = true;
    setProposés([]);
    if (!film.tmdbId || !apiKey) return;
    fetchKeywords(film.tmdbId, apiKey)
      .then((mots: { id?: number; name?: string }[]) => {
        if (!vivant) return;
        setProposés(suggestMotifs(mots));
        /* ON LES RANGE AU PASSAGE. Ils étaient demandés puis jetés :
           seules les propositions de motifs en sortaient, et le sillage
           n'avait ensuite rien de thématique à quoi se raccrocher. Les
           garder ici fait qu'ouvrir une fiche l'améliore — et celles
           qu'on n'ouvre jamais attendent « compléter les fiches ».

           On n'écrit que si la fiche n'en portait pas : une écriture à
           chaque ouverture sauverait la collection entière pour rien. */
        if (film.keywords == null)
          onUpdate({
            ...film,
            keywords: mots.map((m) => m.name || "").filter(Boolean),
          });
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
    /* La clé est une dépendance : la poser dans le tiroir doit rattraper
       une fiche déjà ouverte, sans quoi il faudrait la refermer pour que
       les propositions arrivent. */
  }, [film.id, film.tmdbId, apiKey]);

  const addLink = () => {
    // une fiche retenue devient un vrai lien réciproque, pas une étiquette
    if (picked) {
      onLinkFilm(film.id, picked.id, linkNote, linkRelation || undefined, linkForce);
      setPicked(null);
      setLinkTitle("");
      setLinkCreator("");
      setLinkNote("");
      setLinkRelation("");
      setLinkForce(2);
      return;
    }
    if (!linkTitle.trim()) return;
    const work = {
      id: uid(),
      type: linkType,
      title: linkTitle.trim(),
      creator: linkCreator.trim(),
      note: linkNote.trim(),
    };
    onUpdate({ ...film, linkedWorks: [...(film.linkedWorks || []), work] });
    setLinkTitle("");
    setLinkCreator("");
    setLinkNote("");
  };
  /* Ceux du catalogue qu'on a écartés : le sélecteur les propose au
     retour, sinon les rappeler demanderait d'aller fouiller le code. */
  const masqués = useMemo(
    () => MOTIFS.filter((m) => vocabulaire.masqués.includes(m.id)),
    [vocabulaire.masqués]
  );

  const removeLink = (id: string) => onRemoveLink(film.id, id);
  const editLink = (id: string, patch: LinkPatch) => onEditLink(film.id, id, patch);

  return (
    /* PAS DE PLAFOND SUR LA PAGE, UN PLAFOND SUR LA LECTURE.

       Un plafond de page laissait un vide franc à droite sur un grand écran,
       et c'était le mauvais endroit où le poser : ce qui devient illisible en
       s'élargissant, ce n'est pas la fiche, c'est la LIGNE DE TEXTE. On
       plafonne donc la colonne de critique (voir plus bas) et on laisse tout
       le reste — l'affiche, le rail, le fil rouge — occuper la table. */
    <div style={{ padding: "34px 44px 70px", position: "relative" }}>
      <StampCorner text="DOSSIER" />
      <button
        onClick={onBack}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: C.inkFaded,
          fontFamily: F.mono,
          fontSize: 11.5,
          marginBottom: 22,
        }}
      >
        {/* Le bouton dit où il ramène. Une fiche ouverte depuis un
            dossier de personne n'y renvoie pas au mur, et l'annoncer
            ainsi serait un mensonge de plus. */}
        <ArrowLeft size={14} /> {retourVers || "RETOUR AU MUR"}
      </button>

      {/* ---- LA COUVERTURE, QUI NE CHANGE PAS D'ONGLET ----

          L'affiche et le titre restent au-dessus des intercalaires :
          c'est ce qui fait qu'on ne perd pas de vue le film dont on
          parle en changeant de page, et c'est la seule chose des onze
          blocs d'avant qui n'appartienne à aucun des trois. */}
      <div
        style={{
          display: "flex",
          gap: 26,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div style={{ flex: "0 0 176px", minWidth: 0 }}>
          <div
            style={{
              background: C.card,
              padding: "10px 10px 13px",
              boxShadow: "3px 6px 14px rgba(30,20,10,0.28)",
              position: "relative",
            }}
          >
            <Tape
              color={C.burgundy}
              rotate={-5}
              style={{ top: -10, left: "50%", marginLeft: -35 }}
            />
            <PosterArt film={film} height={214} clipSeed={11} initials={initialsOf(film.title)} />
          </div>
          <PosterPicker film={film} onUpdate={onUpdate} />
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          {/* En lecture seule, et c'est délibéré : le titre s'ÉDITE dans
              la fiche catalogue, qui est le seul endroit qui le corrige.
              Deux champs pour une même valeur donnent tôt ou tard deux
              valeurs. */}
          <div
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1.08,
              color: C.ink,
            }}
          >
            {film.title || "Sans titre"}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11.5, color: C.inkFaded, marginTop: 7 }}>
            {[film.year || null, film.director || null].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>

      <BarreOnglets valeur={onglet} onChange={changerOnglet} />

      {/* ============================================================
          ONGLET « LE FILM » — ce que l'œuvre EST
          ============================================================ */}
      {onglet === "film" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, maxWidth: 620 }}>
            <Carton tour="detail-catalog">
              <Label>Fiche catalogue</Label>
              {/* Titre, année, réalisateur·rice et genres : en lecture ici, et
                rattrapables d'un clic — c'est la seule façon de corriger une
                fiche que l'import a mal identifiée. */}
              <FilmIdentity film={film} onUpdate={onUpdate} onOpenPerson={onOpenPerson} />
              {film.status === "watchlist" ? (
                <button
                  /* Il posait `watchedAt` tout seul. Depuis qu'un journal
                   existe, cela ferait un film vu à telle date et vu zéro
                   fois — deux affirmations contradictoires dès le premier
                   clic. `withWatches` écrit les deux d'un coup. */
                  onClick={() =>
                    onUpdate(
                      withWatches({ ...film, status: "watched" }, [
                        ...(film.watches || []),
                        {
                          date: new Date().toISOString().slice(0, 10),
                          rating: film.rating || null,
                        },
                      ])
                    )
                  }
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    marginTop: 12,
                    display: "block",
                    textAlign: "center",
                    padding: "8px 0",
                    background: C.pine,
                    color: C.card,
                    fontFamily: F.mono,
                    fontSize: 10.5,
                    letterSpacing: 1,
                    boxSizing: "border-box",
                    width: "100%",
                  }}
                >
                  JE L'AI VU
                </button>
              ) : (
                <>
                  <div style={{ marginTop: 10 }}>
                    <InkStars
                      value={film.rating || 0}
                      onChange={(v) => onUpdate({ ...film, rating: v })}
                      size={18}
                    />
                  </div>
                  <button
                    onClick={() => onUpdate({ ...film, status: "watchlist" })}
                    style={{
                      all: "unset",
                      ...tap,
                      cursor: "pointer",
                      marginTop: 8,
                      color: C.inkFaded,
                      fontFamily: F.mono,
                      fontSize: 10,
                    }}
                  >
                    remettre « à voir »
                  </button>
                </>
              )}
              {/* LE JOURNAL EST PARTI DANS « MES MOTS », et c'est le
                découpage lui-même qui le demande : une séance datée est
                ce que VOUS avez fait du film, pas ce qu'il est. Il est
                aussi ce qui vaut le plus de place, et il en avait deux
                cent quarante pixels dans la colonne d'affiche. */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {(film.genres || []).map((g) => (
                  <span
                    key={g}
                    style={{
                      fontFamily: F.mono,
                      fontSize: 9.5,
                      border: `1px solid ${C.burgundy}`,
                      color: C.burgundy,
                      borderRadius: 12,
                      padding: "2px 8px",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
              {/* Tout ce que la récolte rapporte et qu'on ne lisait nulle
                part : durée, pays, langue, équipe, casting. C'est là
                qu'on voit ce qui manque, et qu'on le redemande. */}
              <TmdbFacts film={film} onUpdate={onUpdate} onOpenPerson={onOpenPerson} />
              {/* Ce que d'autres vidéothèques publiques disent du même
                film. Se tait entièrement sans serveur, sans compte, ou
                quand personne n'a rien dit — une fiche qui vit seule ne
                réclame pas un compte. */}
              <Ailleurs film={film} connecte={connecte} />
              <RangerDansUneListe film={film} connecte={connecte} />
              {/* Le troisième bloc qui ne parle que du dehors, à côté
                  des deux autres : ce que les autres voient de cette
                  fiche, et le droit de la leur retirer. */}
              <EcarterDuPartage film={film} connecte={connecte} />
            </Carton>
          </div>

          {/* L'IDENTITÉ, ET NON LE RANGEMENT — d'où un carton à part, et
              d'où sa présence ICI. Elle répare ce que la fiche EST quand
              l'import l'a confondue avec un homonyme : c'est du même
              onglet que le catalogue qu'elle corrige, et non du même que
              vos mots. On ne s'en sert qu'une fois par fiche, et jamais
              sur la plupart. */}
          <div style={{ flex: "1 1 260px", maxWidth: 380, minWidth: 0 }}>
            <Carton tour="detail-identite">
              <TmdbLink film={film} onUpdate={onUpdate} />
            </Carton>
          </div>
        </div>
      )}

      {/* ============================================================
          ONGLET « MES MOTS » — ce que VOUS en avez fait
          ============================================================ */}
      {onglet === "mots" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* 760 px : au-delà, l'œil perd la ligne suivante en revenant à la
            marge. C'est la seule colonne qui ait une raison d'être bornée. */}
          <div style={{ flex: "1 1 420px", maxWidth: 760, minWidth: 0, position: "relative" }}>
            {/* LE JOURNAL DES SÉANCES, EN TÊTE DE VOS MOTS. Il est la
              donnée la plus riche de la fiche et la seule que l'almanach
              lise ; il n'avait qu'un quart de colonne. */}
            {film.status !== "watchlist" && (
              <Carton tour="detail-watchlog" style={{ marginBottom: 18 }}>
                <WatchLog film={film} onUpdate={onUpdate} />
              </Carton>
            )}
            <Paperclip
              size={26}
              color={C.inkFaded}
              style={{
                position: "absolute",
                top: -14,
                left: -22,
                transform: "rotate(-25deg)",
                opacity: 0.7,
              }}
            />
            {/* Le champ actif reçoit les captures qu'on insère. Le liseré n'est
              plus une auréole posée AUTOUR du bloc mais le filet du carton
              lui-même, qui change d'encre : c'est le même objet, désigné. */}
            <Carton
              tour="detail-review"
              onFocusCapture={() => setFocusField("review")}
              style={{
                borderColor: focusField === "review" && stills.length > 0 ? C.burgundy : C.line,
              }}
            >
              <RichField
                label="Critique personnelle"
                minHeight={120}
                value={film.review || ""}
                onChange={(review) => onUpdate({ ...film, review })}
                stills={stills}
                onOpenStill={setLightbox}
                onInsertToken={(fn) => {
                  inserters.current.review = fn;
                }}
                placeholder="Écrivez ici, à main levée…"
              />
            </Carton>
            <Carton
              onFocusCapture={() => setFocusField("notes")}
              style={{
                marginTop: 18,
                borderColor: focusField === "notes" && stills.length > 0 ? C.burgundy : C.line,
              }}
            >
              <RichField
                label="Notes libres"
                minHeight={70}
                value={film.notes || ""}
                onChange={(notes) => onUpdate({ ...film, notes })}
                stills={stills}
                onOpenStill={setLightbox}
                onInsertToken={(fn) => {
                  inserters.current.notes = fn;
                }}
                placeholder="Scènes, citations, fragments…"
              />
            </Carton>

            {/* LA PELLICULE, SOUS LE TEXTE QU'ELLE ILLUSTRE.

              Elle était tout en bas de la page. Or « insérer » pose la
              vignette à l'endroit du curseur, dans le champ où l'on écrit :
              la planche et le texte se répondent à chaque geste, et les
              tenir à deux écrans l'un de l'autre obligeait à faire l'aller-
              retour pour chaque image. */}
            <div style={{ marginTop: 18 }}>
              <StillsStrip
                film={film}
                onUpdate={onUpdate}
                onOpen={setLightbox}
                onInsert={insertToken}
                highlight={lightbox}
                onAddFiles={addStills}
                busy={busy}
              />
            </div>
          </div>

          {/* LE RAIL D'ANNOTATION — ce qu'on FAIT du film, et non ce qu'il est.

            Ces quatre blocs vivaient dans la colonne de gauche, avec sept
            autres, dans deux cent vingt pixels. Une puce un peu longue y
            débordait, et le tout se lisait comme un entonnoir. Ils sont ici
            parce qu'ils forment une famille : vos mots, vos motifs, le rayon
            où le film se range, et la sortie définitive. La fiche catalogue,
            à gauche, ne décrit plus que le film lui-même. */}
          <div
            style={{
              flex: "1 1 260px",
              maxWidth: 340,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <Carton>
              <Label>Mots-clés</Label>
              <TagEditor
                tags={film.themes || []}
                allTags={allTags}
                onChange={(themes) => onUpdate({ ...film, themes })}
              />
            </Carton>
            {/* Les motifs, sous les mots-clés et non à leur place : les uns
              sont vos mots, les autres le vocabulaire commun sur lequel
              une question peut porter. */}
            <Carton tour="detail-tags">
              <Label>Motifs</Label>
              <MotifPicker
                motifs={film.motifs || []}
                suggestions={proposés}
                onChange={(motifs) => onUpdate({ ...film, motifs })}
                onFaireUnFil={onFaireUnFil}
                masqués={masqués}
                onMasquer={onMasquerMotif}
                /* Créer et poser sont un seul geste : on n'écrit pas un
                 motif dans l'abstrait, mais parce qu'on regarde CE film
                 et qu'aucun mot ne le disait. */
                onCréer={
                  onCréerMotif
                    ? (label, famille, spoiler) => {
                        const id = onCréerMotif(label, famille, spoiler);
                        if (id && !(film.motifs || []).includes(id))
                          onUpdate({ ...film, motifs: [...(film.motifs || []), id] });
                      }
                    : undefined
                }
                onSupprimer={
                  onSupprimerMotif
                    ? (motif) => {
                        const combien = films.filter((f) =>
                          (f.motifs || []).includes(motif.id)
                        ).length;
                        setDemande({
                          titre: `Supprimer « ${motif.label} » ?`,
                          corps: combien
                            ? `Ce motif est posé sur ${combien} fiche${combien > 1 ? "s" : ""} — il en sera retiré.`
                            : "Ce motif n'est posé sur aucune fiche.",
                          action: "supprimer le motif",
                          grave: true,
                          onConfirm: () => onSupprimerMotif(motif.id),
                        });
                      }
                    : undefined
                }
              />
            </Carton>
            {/* Les deux rangements de l'étagère, atteignables sans y aller :
              ils changent le rayon, pas la fiche. */}
            <Carton style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Label>Ce qu'on en fait</Label>
              {/* Pas de chevet pour un film qu'on n'a pas vu : le rayon
                  est celui qu'on revoit, et l'étagère de la watchlist ne
                  l'ouvre pas. Le bouton n'y aurait rien changé de
                  visible. */}
              {film.status !== "watchlist" && (
                <button
                  onClick={() =>
                    onUpdate({
                      ...film,
                      chevet: !film.chevet,
                      archived: film.chevet ? film.archived : false,
                    })
                  }
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: F.mono,
                    fontSize: 10,
                    color: film.chevet ? C.burgundy : C.inkFaded,
                  }}
                >
                  <Moon size={12} />{" "}
                  {film.chevet ? "retirer des films de chevet" : "film de chevet"}
                </button>
              )}
              <button
                /* Remettre en rayon ne demande rien : c'est le geste qui
                 défait l'autre, et faire confirmer un retour en arrière
                 apprend surtout à cliquer sans lire. */
                onClick={() => {
                  const remise = { ...film, archived: !film.archived, chevet: false };
                  if (film.archived) return onUpdate({ ...film, archived: false });
                  setDemande({
                    titre: "Mettre cette fiche de côté ?",
                    corps:
                      "Elle quitte le mur et la constellation, sans être détruite — on la remet en rayon quand on veut.",
                    action: "mettre de côté",
                    onConfirm: () => onUpdate(remise),
                  });
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: film.archived ? C.slate : C.inkFaded,
                }}
              >
                {film.archived ? (
                  <>
                    <ArchiveRestore size={12} /> remettre en rayon
                  </>
                ) : (
                  <>
                    <Archive size={12} /> mettre de côté
                  </>
                )}
              </button>
              {/* La sortie définitive se tient à l'écart des deux rangements :
                mettre de côté et supprimer se ressemblent assez pour qu'on
                les confonde, et l'un des deux ne se rattrape pas. */}
              <button
                onClick={() =>
                  setDemande({
                    titre: `Supprimer « ${film.title} » ?`,
                    corps:
                      "La fiche, ses notes, ses captures et ses fils partent avec elle. Rien ne se rattrape — « mettre de côté » range sans détruire.",
                    action: "supprimer",
                    grave: true,
                    onConfirm: () => onDelete(film.id),
                  })
                }
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: C.inkFaded,
                  fontFamily: F.mono,
                  fontSize: 10,
                  borderTop: `1px solid ${C.line}`,
                  paddingTop: 10,
                  marginTop: 2,
                }}
              >
                <Trash2 size={12} /> supprimer définitivement
              </button>
            </Carton>
          </div>
        </div>
      )}

      {/* ============================================================
          ONGLET « LES LIENS » — ce que le film touche autour de lui
          ============================================================ */}
      {onglet === "liens" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* LE FIL ROUGE, MONTÉ EN COLONNE.

            Il vivait tout en bas, sur toute la largeur, et n'y tenait qu'un
            bandeau : les cartons épinglés s'alignaient sur une rangée pendant
            que la moitié droite de l'écran restait vide. Le panneau
            d'enquête est ce qui aime le plus la place — il la prend ici, et
            les fiches s'y empilent en colonne comme sur un vrai mur.

            En dessous de la largeur qu'il lui faut, il repasse sous les
            autres colonnes : c'est là qu'il était, l'ordre de lecture ne
            change pas. */}
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <Carton tour="detail-thread">
              <TitreSection icon={<Link2 size={15} color={C.burgundy} />}>
                Le fil rouge
              </TitreSection>
              <Consigne>
                les œuvres qui répondent à ce film — livres, peintures, autres films
              </Consigne>

              <ThreadBoard
                film={film}
                onRemove={removeLink}
                onEdit={editLink}
                films={films}
                onOpen={onOpen}
              />

              <div
                style={{
                  marginTop: 30,
                  border: `1px dashed ${C.line}`,
                  padding: 16,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <Label>Type</Label>
                  <select
                    value={linkType}
                    onChange={(e) => {
                      setLinkType(e.target.value as LinkType);
                      setPicked(null);
                    }}
                    style={{
                      ...underlineInput,
                      fontFamily: F.mono,
                      fontSize: 12,
                      width: 120,
                    }}
                  >
                    {LINK_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                  <Label>
                    {linkType === "film" ? "Chercher dans la collection" : "Titre de l'œuvre"}
                  </Label>
                  {picked ? (
                    // fiche retenue : on montre qu'il s'agit d'un vrai renvoi, pas d'un texte
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: `1px solid ${C.burgundy}`,
                        padding: "5px 10px",
                        marginTop: 2,
                      }}
                    >
                      <Link2 size={13} color={C.burgundy} />
                      <span style={{ fontFamily: F.body, fontSize: 14, color: C.ink }}>
                        {picked.title}
                        {picked.year ? ` (${picked.year})` : ""}
                      </span>
                      <button
                        onClick={() => setPicked(null)}
                        style={{
                          all: "unset",
                          ...tap,
                          cursor: "pointer",
                          color: C.inkFaded,
                          marginLeft: "auto",
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <input
                      style={underlineInput}
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder={
                        linkType === "film" ? "un titre déjà au mur, ou un titre libre" : "Titre"
                      }
                    />
                  )}
                  {suggestions.length > 0 && !picked && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        background: C.card,
                        border: `1px solid ${C.line}`,
                        boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
                        maxHeight: 210,
                        overflowY: "auto",
                      }}
                    >
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setPicked(s);
                            setLinkCreator(s.director || "");
                          }}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            display: "block",
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "7px 11px",
                            borderBottom: `1px solid ${C.line}`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.paperDark;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink }}>
                            {s.title}
                          </span>
                          <span
                            style={{
                              fontFamily: F.mono,
                              fontSize: 9.5,
                              color: C.inkFaded,
                              marginLeft: 6,
                            }}
                          >
                            {s.year || "s.d."}
                            {s.director ? ` · ${s.director}` : ""}
                            {s.status === "watchlist" ? " · à voir" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {linkType === "film" &&
                    !picked &&
                    linkTitle.trim() &&
                    suggestions.length === 0 && (
                      <div
                        style={{
                          fontFamily: F.hand,
                          fontSize: 15,
                          color: C.inkFaded,
                          marginTop: 3,
                        }}
                      >
                        pas au mur — sera relié comme simple mention
                      </div>
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Label>Auteur·rice / artiste</Label>
                  <input
                    style={underlineInput}
                    value={linkCreator}
                    onChange={(e) => setLinkCreator(e.target.value)}
                    placeholder="Nom"
                    disabled={!!picked}
                  />
                </div>
                {/* La nature du fil n'a de sens qu'entre deux fiches : une
              mention libre n'est reliée qu'à elle-même. Le champ n'apparaît
              donc qu'une fois la fiche retenue. */}
                {picked && (
                  <>
                    <div style={{ minWidth: 160 }}>
                      <Label>Nature du lien</Label>
                      <select
                        value={linkRelation}
                        onChange={(e) => setLinkRelation(e.target.value as Relation | "")}
                        style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                      >
                        <option value="">— sans plus de précision —</option>
                        {RELATIONS_SAISISSABLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <Label>Force</Label>
                      <select
                        value={linkForce}
                        onChange={(e) => setLinkForce(forceDe(Number(e.target.value)))}
                        style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                      >
                        {FORCES.map((f) => (
                          <option key={f.valeur} value={f.valeur}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div style={{ flex: 1.4, minWidth: 180 }}>
                  <Label>Pourquoi ce lien ?</Label>
                  <input
                    style={underlineInput}
                    value={linkNote}
                    onChange={(e) => setLinkNote(e.target.value)}
                    placeholder="La résonance entre les deux"
                  />
                </div>
                <button
                  onClick={addLink}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    background: C.burgundy,
                    color: C.card,
                    padding: "8px 16px",
                    fontFamily: F.mono,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={13} /> relier
                </button>
              </div>
            </Carton>
            {/* LE SILLAGE, SOUS LE FIL ROUGE ET DANS LE MÊME ONGLET.

              Il était tout en bas de la page entière, après les motifs.
              Le découpage lui donne sa vraie place : le fil rouge est ce
              que VOUS avez relié, le sillage ce que la machine propose de
              relier — deux réponses à la même question, qui gagnent à se
              lire l'une sous l'autre. C'est aussi la sortie naturelle de
              la fiche : on referme rarement un dossier sans se demander
              « et ensuite ? ». */}
            <SillagePanel
              film={film}
              films={films}
              onOpen={onOpen}
              onAddToWatchlist={onAddToWatchlist}
            />
          </div>
        </div>
      )}
      <Confirmation demande={demande} onClose={() => setDemande(null)} />
      {lightbox != null && (
        <StillLightbox
          stills={stills}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </div>
  );
}
