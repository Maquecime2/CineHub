/* ============================================================
   A CARD'S IDENTITY — title, year, director, genres.
   These four fields almost always come from TMDB; when resolution failed
   at import time, this is where we catch them up.
   ============================================================ */
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { CommaInput, Label } from "../ui";
import { getTmdbKey } from "../../services/tmdbKey";
import { searchMovie, getDetails } from "../../tmdb";
import type { Film, Year } from "../../types";

const tinyButton = (ink: string) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontFamily: F.mono,
  fontSize: 10,
  color: ink,
});

type Draft = { title: string; year: Year; director: string; genres: string[] };

export function FilmIdentity({
  film,
  onUpdate,
  onOpenPerson,
}: {
  film: Film;
  onUpdate: (f: Film) => void;
  /** Absent: the directing credit stays plain text. */
  onOpenPerson?: (nom: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({
    title: film.title,
    year: film.year,
    director: film.director,
    genres: film.genres || [],
  }));
  /* The TMDB identifier follows the draft: if a new search succeeds, the
     card must leave with the right film, not the old one (often absent). */
  const [tmdbId, setTmdbId] = useState<Film["tmdbId"]>(film.tmdbId);
  const [poster, setPoster] = useState(film.poster);
  const [msg, setMsg] = useState("");

  const open = () => {
    setDraft({
      title: film.title,
      year: film.year,
      director: film.director,
      genres: film.genres || [],
    });
    setTmdbId(film.tmdbId);
    setPoster(film.poster);
    setMsg("");
    setEditing(true);
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((p) => ({ ...p, [k]: v }));

  /* Catching up the "unidentified films": we relaunch the search with the
     corrected title rather than the faulty one that was in the CSV. */
  const relookup = async () => {
    const apiKey = getTmdbKey();
    if (!apiKey) {
      setMsg("Aucune clé TMDB — à régler au pied du rail d'onglets.");
      return;
    }
    if (!draft.title.trim()) return;
    setMsg("recherche…");
    try {
      const hit = await searchMovie({ title: draft.title.trim(), year: draft.year, apiKey });
      if (!hit) {
        setMsg("Toujours introuvable sous ce titre.");
        return;
      }
      const info = await getDetails(hit.id, apiKey);
      setDraft((p) => ({
        ...p,
        director: info.director || p.director,
        genres: info.genres?.length ? info.genres : p.genres,
        year: p.year || info.year || "",
      }));
      setTmdbId(info.tmdbId);
      // a poster already chosen stays its own; we only fill a gap
      if (!poster && info.poster) setPoster(info.poster);
      setMsg(
        `trouvé : ${hit.title}${hit.release_date ? ` (${hit.release_date.slice(0, 4)})` : ""}`
      );
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    }
  };

  const save = () => {
    const title = draft.title.trim();
    if (!title) return;
    onUpdate({
      ...film,
      title,
      year: draft.year,
      director: draft.director.trim(),
      genres: draft.genres,
      tmdbId,
      poster,
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <>
        <div
          style={{
            fontFamily: F.title,
            fontWeight: 700,
            fontSize: 20,
            color: C.ink,
            marginTop: 4,
          }}
        >
          {film.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            fontFamily: F.mono,
            fontSize: 11,
            color: C.inkFaded,
            marginTop: 3,
          }}
        >
          <span>
            {film.year || "s.d."} —{" "}
            {/* Directing can be done by several hands: we split on the
                comma as `kinshipsOf` does, failing which "Coen, Coen"
                would open a phantom folder with two names. */}
            {film.director
              ? film.director.split(",").map((nom, i) => {
                  const clean = nom.trim();
                  if (!clean) return null;
                  return (
                    <span key={`${clean}-${i}`}>
                      {i > 0 && ", "}
                      {onOpenPerson ? (
                        <button
                          onClick={() => onOpenPerson(clean)}
                          title={`Ce que j'ai de ${clean}`}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            borderBottom: `1px dotted ${C.inkFaded}`,
                            transition: "color var(--motion-fast) ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = C.burgundy;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "";
                          }}
                        >
                          {clean}
                        </button>
                      ) : (
                        clean
                      )}
                    </span>
                  );
                })
              : "anonyme"}
          </span>
          <button onClick={open} style={{ ...tinyButton(C.inkFaded), marginLeft: "auto" }}>
            <Pencil size={11} /> corriger
          </button>
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        border: `1px solid ${C.line}`,
        background: C.card,
        padding: "10px 12px",
      }}
    >
      <Label>Titre</Label>
      <input
        style={underlineInput}
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
        autoFocus
      />
      <div style={{ marginTop: 10 }}>
        <Label>Année</Label>
        <input
          style={underlineInput}
          value={draft.year}
          onChange={(e) => set("year", e.target.value ? Number(e.target.value) || "" : "")}
          placeholder="1975"
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Label>Réalisateur·rice</Label>
        <input
          style={underlineInput}
          value={draft.director}
          onChange={(e) => set("director", e.target.value)}
          placeholder="Nom"
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Label>Genres (virgules)</Label>
        <CommaInput
          style={underlineInput}
          value={draft.genres}
          onChange={(v) => set("genres", v)}
          placeholder="Drame, Science-fiction"
        />
      </div>

      <button onClick={relookup} style={{ ...tinyButton(C.pine), marginTop: 12 }}>
        retrouver sur TMDB
      </button>
      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 4 }}>
          {msg}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 14,
          borderTop: `1px solid ${C.line}`,
          paddingTop: 10,
        }}
      >
        <button
          onClick={save}
          disabled={!draft.title.trim()}
          style={tinyButton(draft.title.trim() ? C.burgundy : C.line)}
        >
          <Check size={12} /> enregistrer
        </button>
        <button onClick={() => setEditing(false)} style={tinyButton(C.inkFaded)}>
          <X size={12} /> annuler
        </button>
      </div>
    </div>
  );
}
