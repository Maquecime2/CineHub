/* ============================================================
   CE QUE TMDB SAIT DE CE FILM — et qu'on ne voyait nulle part
   ============================================================

   La récolte rapportait depuis longtemps la durée, la langue, le pays,
   la note du public, le casting et trois métiers d'équipe. La fiche
   n'en montrait AUCUN : ces champs alimentaient l'almanach et la
   constellation, et n'avaient pas de place où être lus un par un.

   C'est plus qu'un manque d'affichage, c'est un angle mort de
   diagnostic. Quand l'almanach annonce trois pays pour deux cents
   films, il n'y avait aucun moyen de savoir si TMDB ne les donnait pas,
   si la récolte ne les demandait pas, ou si le cache servait de vieilles
   réponses tronquées (c'était la troisième). Une fiche qui affiche ses
   trous se répare ; une fiche muette se devine.

   D'où aussi le bouton : il redemande CE film à TMDB, sans passer par
   le cache d'import — donc sans rien à purger, et sans avoir à relancer
   les cinq cents autres pour vérifier une intuition sur un seul.

   On ne remplit que le vide, comme partout ailleurs dans la fusion :
   une donnée corrigée à la main n'est jamais écrasée par TMDB. */
import { useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { store } from "../../services/storage";
import { getDetails, searchMovie } from "../../tmdb";
import { nomLangue, nomPays } from "../../noms";
import type { Film } from "../../types";

/** Une ligne « intitulé → valeur », ou rien du tout si on ne sait pas. */
function Fait({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    /* `flexWrap` : l'intitulé réserve 74 px et la valeur ne sait pas
       descendre sous son contenu — dans une colonne étroite, la ligne
       débordait. Elle s'empile désormais. */
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        padding: "2px 0",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          color: C.inkFaded,
          letterSpacing: 0.5,
          minWidth: 74,
        }}
      >
        {nom}
      </span>
      <span
        style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink, flex: "1 1 120px", minWidth: 0 }}
      >
        {children}
      </span>
    </div>
  );
}

/* Ce qu'on dit d'un champ absent. Un tiret, et non le silence : le
   silence se confond avec « ce champ n'existe pas », alors qu'ici il
   veut dire « TMDB ne nous l'a pas donné », ce qui appelle le bouton. */
const VIDE = <span style={{ color: C.line }}>—</span>;

const MÉTIERS: [key: string, nom: string][] = [
  ["image", "IMAGE"],
  ["musique", "MUSIQUE"],
  ["scénario", "SCÉNARIO"],
];

/* UNE LISTE DE NOMS QUI MÈNE QUELQUE PART.

   Ces noms étaient du texte joint par des virgules : on lisait « Henri
   Decaë » sans pouvoir demander ce qu'on avait d'autre de lui, alors que
   la collection le savait depuis le début. Chacun ouvre désormais son
   dossier au Générique.

   Un pointillé d'encre, et non un bleu de lien : la direction artistique
   est un carnet, et un carnet ne souligne pas en bleu ce qu'on peut
   suivre — il l'écrit à la plume. */
function Noms({
  noms,
  sépare = ", ",
  onOpenPerson,
}: {
  noms: string[];
  sépare?: string;
  onOpenPerson?: (nom: string) => void;
}) {
  if (!noms.length) return VIDE;
  return (
    <>
      {noms.map((nom, i) => (
        <span key={`${nom}-${i}`}>
          {i > 0 && sépare}
          {onOpenPerson ? (
            <button
              onClick={() => onOpenPerson(nom)}
              title={`Ce que j'ai de ${nom}`}
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
              {nom}
            </button>
          ) : (
            nom
          )}
        </span>
      ))}
    </>
  );
}

export function TmdbFacts({
  film,
  onUpdate,
  onOpenPerson,
}: {
  film: Film;
  onUpdate: (f: Film) => void;
  /** Absent : les noms restent du texte. La fiche ne sait pas naviguer. */
  onOpenPerson?: (nom: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const rafraîchir = async () => {
    const apiKey = store.get("tmdb-key", "");
    if (!apiKey) {
      setMsg("Aucune clé TMDB — renseignez-la dans l'onglet Import.");
      return;
    }
    setBusy(true);
    setMsg("interrogation…");
    try {
      /* L'identifiant quand on l'a : il évite une recherche, et surtout
         les faux positifs de `searchMovie`, qui prend le premier
         résultat sans comparer les titres. */
      let id = film.tmdbId;
      if (!id) {
        const hit = await searchMovie({ title: film.title, year: film.year, apiKey });
        if (!hit) {
          setMsg("TMDB ne connaît pas ce titre.");
          return;
        }
        id = hit.id;
      }
      const info = await getDetails(id, apiKey);

      const changes: Partial<Film> = {};
      if (info.runtime != null && film.runtime == null) changes.runtime = info.runtime;
      if (info.language && !film.language) changes.language = info.language;
      if (info.countries?.length && !(film.countries || []).length)
        changes.countries = info.countries;
      if (info.tmdbRating != null && film.tmdbRating == null) changes.tmdbRating = info.tmdbRating;
      if (info.cast?.length && !(film.cast || []).length) changes.cast = info.cast;
      if (info.crew && Object.keys(info.crew).length && !Object.keys(film.crew || {}).length)
        changes.crew = info.crew;
      if (info.genres?.length && !(film.genres || []).length) changes.genres = info.genres;
      if (info.director && !film.director) changes.director = info.director;
      if (!film.tmdbId) changes.tmdbId = id;

      const n = Object.keys(changes).length;
      if (n) onUpdate({ ...film, ...changes });
      /* Distinguer « rien n'a changé » de « TMDB n'a rien » : le premier
         veut dire que la fiche était déjà à jour, le second qu'il n'y a
         rien à espérer d'un second clic. */
      setMsg(
        n ? `${n} champ(s) complété(s).` : "TMDB ne donne rien de plus que ce qui est déjà là."
      );
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  const pays = (film.countries || []).map(nomPays).join(", ");
  const crew = film.crew || {};
  const cast = film.cast || [];

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        RELEVÉ TMDB
        <button
          onClick={rafraîchir}
          disabled={busy}
          title="redemander cette fiche à TMDB"
          style={{
            all: "unset",
            ...tap,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.45 : 1,
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: F.mono,
            fontSize: 10,
            color: C.pine,
          }}
        >
          <RefreshCw size={11} /> rafraîchir
        </button>
      </div>

      <Fait nom="DURÉE">{film.runtime != null ? `${film.runtime} min` : VIDE}</Fait>
      <Fait nom="PAYS">{pays || VIDE}</Fait>
      <Fait nom="LANGUE">{film.language ? nomLangue(film.language) : VIDE}</Fait>
      <Fait nom="NOTE TMDB">
        {film.tmdbRating != null ? `${film.tmdbRating.toFixed(1)} / 10` : VIDE}
      </Fait>
      {MÉTIERS.map(([key, nom]) => (
        <Fait key={key} nom={nom}>
          <Noms noms={crew[key] || []} onOpenPerson={onOpenPerson} />
        </Fait>
      ))}
      <Fait nom="CASTING">
        <Noms noms={cast} sépare=" · " onOpenPerson={onOpenPerson} />
      </Fait>
      <Fait nom="ID TMDB">{film.tmdbId ?? VIDE}</Fait>

      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
