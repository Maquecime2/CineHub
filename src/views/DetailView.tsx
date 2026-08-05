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
import { underlineInput } from "../theme/styles";
import { uid, withWatches } from "../domain/film";
import { putImage } from "../db";
import { imageSize, shrinkImage } from "../services/images";
import { Label, InkStars } from "../components/ui";
import { TagEditor } from "../components/ui/TagEditor";
import { StampCorner, Tape } from "../components/atmosphere";
import { PosterArt } from "../components/film/PosterArt";
import { PosterPicker } from "../components/film/PosterPicker";
import { FilmIdentity } from "../components/film/FilmIdentity";
import { WatchLog } from "../components/film/WatchLog";
import { ThreadBoard } from "../components/film/ThreadBoard";
import { LINK_TYPES } from "../components/film/linkTypes";
import { StillsStrip } from "../components/stills/StillsStrip";
import { StillLightbox } from "../components/stills/StillLightbox";
import { RichField } from "../components/stills/RichField";
import type { Film, LinkPatch, LinkType, Still } from "../types";

/** Les deux champs de texte de la fiche, où une capture peut s'insérer. */
type TextField = "review" | "notes";

interface DetailViewProps {
  film: Film;
  onBack: () => void;
  onUpdate: (f: Film) => void;
  onDelete: (id: string) => void;
  films?: Film[];
  /** Relie deux fiches du mur : le lien est posé des deux côtés. */
  onLinkFilm: (aId: string, bId: string, note: string) => void;
  onRemoveLink: (filmId: string, workId: string) => void;
  /** Retouche un fil : le modele decide de ce qu il accepte. */
  onEditLink: (filmId: string, workId: string, patch: LinkPatch) => void;
  onOpen: (id: string) => void;
}

export function DetailView({
  film,
  onBack,
  onUpdate,
  onDelete,
  films = [],
  onLinkFilm,
  onRemoveLink,
  onEditLink,
  onOpen,
}: DetailViewProps) {
  const [linkType, setLinkType] = useState<LinkType>("book");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkCreator, setLinkCreator] = useState("");
  const [linkNote, setLinkNote] = useState("");
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
    const q = linkTitle.trim().toLowerCase();
    if (!q) return [];
    return films
      .filter((f) => f.id !== film.id && !already.has(f.id))
      .filter(
        (f) => f.title.toLowerCase().includes(q) || (f.director || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [films, film.id, linkTitle, linkType, film.linkedWorks]);

  const addLink = () => {
    // une fiche retenue devient un vrai lien réciproque, pas une étiquette
    if (picked) {
      onLinkFilm(film.id, picked.id, linkNote);
      setPicked(null);
      setLinkTitle("");
      setLinkCreator("");
      setLinkNote("");
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
  const removeLink = (id: string) => onRemoveLink(film.id, id);
  const editLink = (id: string, patch: LinkPatch) => onEditLink(film.id, id, patch);

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 900, position: "relative" }}>
      <StampCorner text="DOSSIER" />
      <button
        onClick={onBack}
        style={{
          all: "unset",
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
        <ArrowLeft size={14} /> RETOUR AU MUR
      </button>

      <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <div
            style={{
              background: C.card,
              padding: "12px 12px 16px",
              boxShadow: "3px 6px 14px rgba(30,20,10,0.28)",
              position: "relative",
            }}
          >
            <Tape
              color={C.burgundy}
              rotate={-5}
              style={{ top: -10, left: "50%", marginLeft: -35 }}
            />
            <PosterArt
              film={film}
              height={290}
              clipSeed={11}
              initials={film.title.slice(0, 2).toUpperCase()}
            />
          </div>
          <PosterPicker film={film} onUpdate={onUpdate} />
          <div
            style={{
              marginTop: 16,
              border: `1px solid ${C.line}`,
              padding: "12px 14px",
              background: C.paperDark,
            }}
          >
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                color: C.inkFaded,
                letterSpacing: 1,
              }}
            >
              FICHE CATALOGUE
            </div>
            {/* Titre, année, réalisateur·rice et genres : en lecture ici, et
                rattrapables d'un clic — c'est la seule façon de corriger une
                fiche que l'import a mal identifiée. */}
            <FilmIdentity film={film} onUpdate={onUpdate} />
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
                      { date: new Date().toISOString().slice(0, 10), rating: film.rating || null },
                    ])
                  )
                }
                style={{
                  all: "unset",
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
            {/* « vu le … » ne disait rien d'un film revu quatre fois : le
                journal le remplace, et porte la même date en tête. */}
            {film.status !== "watchlist" && <WatchLog film={film} onUpdate={onUpdate} />}
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
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
              <Label>Mots-clés</Label>
              <TagEditor
                tags={film.themes || []}
                allTags={allTags}
                onChange={(themes) => onUpdate({ ...film, themes })}
              />
            </div>
            {/* Les deux rangements de l'étagère, atteignables sans y aller :
                ils changent le rayon, pas la fiche. */}
            <div
              style={{
                marginTop: 14,
                borderTop: `1px solid ${C.line}`,
                paddingTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
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
                onClick={() =>
                  onUpdate({
                    ...film,
                    archived: !film.archived,
                    chevet: film.archived ? film.chevet : false,
                  })
                }
                style={{
                  all: "unset",
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
            </div>
            <button
              onClick={() => onDelete(film.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: C.inkFaded,
                fontFamily: F.mono,
                fontSize: 10,
                marginTop: 16,
              }}
            >
              <Trash2 size={12} /> supprimer définitivement
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 300, position: "relative" }}>
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
          {/* le champ actif reçoit les captures qu'on insère */}
          <div
            onFocusCapture={() => setFocusField("review")}
            style={{
              outline:
                focusField === "review" && stills.length > 0 ? `1px dashed ${C.line}` : "none",
              outlineOffset: 8,
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
          </div>
          <div
            onFocusCapture={() => setFocusField("notes")}
            style={{
              marginTop: 22,
              outline:
                focusField === "notes" && stills.length > 0 ? `1px dashed ${C.line}` : "none",
              outlineOffset: 8,
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
          </div>
        </div>
      </div>

      <StillsStrip
        film={film}
        onUpdate={onUpdate}
        onOpen={setLightbox}
        onInsert={insertToken}
        highlight={lightbox}
        onAddFiles={addStills}
        busy={busy}
      />
      {lightbox != null && (
        <StillLightbox
          stills={stills}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}

      <div style={{ marginTop: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link2 size={15} color={C.burgundy} />
          <div
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 24,
              color: C.ink,
            }}
          >
            Le fil rouge
          </div>
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 18,
            color: C.inkFaded,
            marginTop: -2,
            marginBottom: 8,
          }}
        >
          les œuvres qui répondent à ce film — livres, peintures, autres films
        </div>

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
                  style={{ all: "unset", cursor: "pointer", color: C.inkFaded, marginLeft: "auto" }}
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
            {linkType === "film" && !picked && linkTitle.trim() && suggestions.length === 0 && (
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
      </div>
    </div>
  );
}
