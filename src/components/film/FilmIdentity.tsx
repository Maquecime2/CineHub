/* ============================================================
   IDENTITÉ D'UNE FICHE — titre, année, réalisateur·rice, genres.
   Ces quatre champs viennent presque toujours de TMDB ; quand la
   résolution a échoué à l'import, c'est ici qu'on les rattrape.
   ============================================================ */
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { CommaInput, Label } from "../ui";
import { store } from "../../services/storage";
import { searchMovie, getDetails } from "../../tmdb";
import type { Film, Year } from "../../types";

const tinyButton = (ink: string) => ({
  all: "unset" as const,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontFamily: F.mono,
  fontSize: 10,
  color: ink,
});

type Draft = { title: string; year: Year; director: string; genres: string[] };

export function FilmIdentity({ film, onUpdate }: { film: Film; onUpdate: (f: Film) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({
    title: film.title,
    year: film.year,
    director: film.director,
    genres: film.genres || [],
  }));
  /* L'identifiant TMDB suit le brouillon : si une nouvelle recherche aboutit,
     la fiche doit repartir avec le bon film, pas l'ancien (souvent absent). */
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

  /* Le rattrapage des « films non identifiés » : on relance la recherche avec
     le titre corrigé plutôt que celui, fautif, qui figurait dans le CSV. */
  const relookup = async () => {
    const apiKey = store.get("tmdb-key", "");
    if (!apiKey) {
      setMsg("Aucune clé TMDB — renseignez-la dans l'onglet Import.");
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
      // une affiche déjà choisie reste la sienne ; on ne comble qu'un vide
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
            {film.year || "s.d."} — {film.director || "anonyme"}
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
