import { useEffect, useRef, useState } from "react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { Label } from "../ui";
import { useTmdbKey } from "../../services/tmdbKey";
import { IDB_PREFIX, isIdbPoster, idbKeyOf, putImage, deleteImage } from "../../db";
import { listPosters } from "../../tmdb";
import type { Film } from "../../types";

/** A poster proposed by TMDB. */
interface PosterChoice {
  full: string;
  thumb: string;
  lang: string;
}

export function PosterPicker({ film, onUpdate }: { film: Film; onUpdate: (f: Film) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<PosterChoice[] | null>(null); // affiches proposées par TMDB
  const [galleryMsg, setGalleryMsg] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  const apiKey = useTmdbKey();

  /* The default path: TMDB usually knows several posters per film
     (countries, reissues, textless versions). Better to offer them than to
     impose the first that comes. */
  const loadGallery = async () => {
    if (!apiKey) {
      setGalleryMsg("Aucune clé TMDB — à régler au pied du rail d'onglets.");
      return;
    }
    setGalleryMsg("recherche…");
    setGallery(null);
    try {
      const { tmdbId, posters } = await listPosters({
        tmdbId: film.tmdbId,
        title: film.title,
        year: film.year,
        apiKey,
      });
      if (tmdbId && !film.tmdbId) onUpdate({ ...film, tmdbId });
      setGallery(posters);
      setGalleryMsg(posters.length ? "" : "Aucune affiche trouvée pour ce film.");
    } catch (e) {
      setGalleryMsg(`TMDB indisponible (${(e as Error).message}).`);
    }
  };

  const choose = async (posterUrl: string) => {
    if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
    onUpdate({ ...film, poster: posterUrl });
    setOpen(false);
    setGallery(null);
  };

  // opening the panel offers the TMDB posters straight away
  useEffect(() => {
    if (open && gallery === null && !galleryMsg && apiKey) loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fromFile = async (file: File) => {
    setBusy(true);
    try {
      // the poster too is kept as it is: no re-encoding
      const key = `${film.id}-${Date.now()}`; // clé neuve : le cache d'image ne resservira pas l'ancienne
      await putImage(key, file);
      if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
      onUpdate({ ...film, poster: IDB_PREFIX + key });
    } catch (e) {
      console.error(e);
      alert("Cette image n'a pas pu être enregistrée.");
    }
    setBusy(false);
    setOpen(false);
  };

  const clear = async () => {
    if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
    onUpdate({ ...film, poster: "" });
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          display: "block",
          marginTop: 8,
          color: C.inkFaded,
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 0.5,
        }}
      >
        {film.poster ? "changer l'affiche" : "coller une affiche"}
      </button>
    );
  }
  return (
    <div
      style={{
        marginTop: 10,
        border: `1px solid ${C.line}`,
        background: C.paperDark,
        padding: "12px 14px",
      }}
    >
      {/* the official posters first: that is the common case */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Label>Affiches TMDB</Label>
        <button
          onClick={loadGallery}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            marginLeft: "auto",
            color: C.inkFaded,
            fontFamily: F.mono,
            fontSize: 9.5,
          }}
        >
          {gallery ? "relancer" : "chercher"}
        </button>
      </div>
      {galleryMsg && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            marginTop: 2,
          }}
        >
          {galleryMsg}
        </div>
      )}
      {gallery && gallery.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 7,
            marginTop: 8,
            maxHeight: 230,
            overflowY: "auto",
          }}
        >
          {gallery.map((p) => (
            <button
              key={p.full}
              onClick={() => choose(p.full)}
              title={`langue : ${p.lang}`}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                border: film.poster === p.full ? `2px solid ${C.burgundy}` : `1px solid ${C.line}`,
                lineHeight: 0,
              }}
            >
              <img
                src={p.thumb}
                alt=""
                style={{ width: "100%", display: "block", height: "auto" }}
              />
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: C.line, margin: "14px 0 10px" }} />
      <Label>Ou une adresse d'image</Label>
      <input
        style={underlineInput}
        value={url}
        placeholder="https://…jpg"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key !== "Enter" || !url.trim()) return;
          if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
          onUpdate({ ...film, poster: url.trim() });
          setUrl("");
          setOpen(false);
        }}
      />
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 4 }}>
        clic droit sur une affiche → « copier l'adresse de l'image », puis Entrée
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          onClick={() => ref.current?.click()}
          disabled={busy}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            padding: "6px 12px",
            border: `1px solid ${C.line}`,
            color: C.inkFaded,
            fontFamily: F.mono,
            fontSize: 10,
          }}
        >
          {busy ? "…" : "DEPUIS MON DISQUE"}
        </button>
        {film.poster && (
          <button
            onClick={clear}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              padding: "6px 12px",
              border: `1px solid ${C.burgundy}`,
              color: C.burgundy,
              fontFamily: F.mono,
              fontSize: 10,
            }}
          >
            RETIRER
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            padding: "6px 12px",
            color: C.inkFaded,
            fontFamily: F.mono,
            fontSize: 10,
          }}
        >
          fermer
        </button>
      </div>
    </div>
  );
}
