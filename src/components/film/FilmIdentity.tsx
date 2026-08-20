/* ============================================================
   A CARD'S IDENTITY — title, year, director, genres.
   These four fields almost always come from TMDB; when resolution failed
   at import time, this is where we catch them up.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { CommaInput, Label } from "../ui";
import { getTmdbKey } from "../../services/tmdbKey";
import { searchMovie, getDetails } from "../../tmdb";
import { forgetTmdbFacts } from "../../domain/film";
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
  onOpenPerson?: (name: string) => void;
}) {
  const { t } = useTranslation();
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
  /* Ce que TMDB vient de dire du NOUVEAU film. On le garde ici plutôt
     que de le poser tout de suite : tant qu'on n'a pas validé, la fiche
     n'a pas changé d'identité. */
  const [fresh, setFresh] = useState<Partial<Film> | null>(null);
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
    setFresh(null);
    setMsg("");
    setEditing(true);
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((p) => ({ ...p, [k]: v }));

  /* Catching up the "unidentified films": we relaunch the search with the
     corrected title rather than the faulty one that was in the CSV. */
  const relookup = async () => {
    const apiKey = getTmdbKey();
    if (!apiKey) {
      setMsg(t("tmdbKey.missing"));
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
      setFresh({
        cast: info.cast,
        crew: info.crew,
        runtime: info.runtime,
        language: info.language,
        countries: info.countries,
        tmdbRating: info.tmdbRating,
        synopsis: info.synopsis,
        keywords: info.keywords,
        frames: info.frames,
      });
      // a poster already chosen stays its own; we only fill a gap
      if (!poster && info.poster) setPoster(info.poster);
      setMsg(
        t("identity.found", {
          title: hit.title,
          year: hit.release_date ? ` (${hit.release_date.slice(0, 4)})` : "",
        })
      );
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    }
  };

  const save = () => {
    const title = draft.title.trim();
    if (!title) return;
    /* L'identifiant a changé : ce n'est plus le même film, donc ce que
       TMDB avait rempli parle d'un autre. On l'oublie, sinon le
       remplissage — qui ne comble que des trous — ne le réécrira jamais
       et la fiche gardera les plans et le résumé du mauvais film. Ce
       qu'on a écrit soi-même n'y touche pas. */
    const changedId = tmdbId !== film.tmdbId && !!film.tmdbId;
    /* `forgetTmdbFacts` d'abord, la moisson par-dessus : ce que la
       nouvelle requête n'a pas ramené (une durée inconnue, aucun plan)
       ne doit pas rester celui de l'ancien film. Et sans requête — un
       identifiant changé autrement — on se contente d'oublier, ce qui
       rouvre les trous que `TmdbFacts` sait combler. */
    const stale = changedId ? { ...forgetTmdbFacts(), ...(fresh ?? {}) } : {};
    onUpdate({
      ...film,
      ...stale,
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
              ? film.director.split(",").map((name, i) => {
                  const clean = name.trim();
                  if (!clean) return null;
                  return (
                    <span key={`${clean}-${i}`}>
                      {i > 0 && ", "}
                      {onOpenPerson ? (
                        <button
                          onClick={() => onOpenPerson(clean)}
                          title={t("credits.whatIHaveOf", { name: clean })}
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
      <Label>{t("film.titleField")}</Label>
      <input
        style={underlineInput}
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
        autoFocus
      />
      <div style={{ marginTop: 10 }}>
        <Label>{t("film.year")}</Label>
        <input
          style={underlineInput}
          value={draft.year}
          onChange={(e) => set("year", e.target.value ? Number(e.target.value) || "" : "")}
          placeholder="1975"
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Label>{t("film.director")}</Label>
        <input
          style={underlineInput}
          value={draft.director}
          onChange={(e) => set("director", e.target.value)}
          placeholder={t("film.nameField")}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <Label>{t("film.genresField")}</Label>
        <CommaInput
          style={underlineInput}
          value={draft.genres}
          onChange={(v) => set("genres", v)}
          placeholder={t("film.genresPlaceholder")}
        />
      </div>

      <button onClick={relookup} style={{ ...tinyButton(C.pine), marginTop: 12 }}>
        {t("identity.findOnTmdb")}
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
