/* ============================================================
   VUE — LE GÉNÉRIQUE

   Les mêmes films, lus par les gens qui les ont faits. Rien n'est rangé
   ici : un dossier de personne se recompose depuis la collection à
   chaque lecture (`domain/people`), exactement comme un fil.

   Deux états dans une seule vue, comme la vidéothèque sert deux murs :
   le RÉPERTOIRE, où l'on cherche quelqu'un, et le DOSSIER, où l'on
   regarde ce qu'on a de lui.
   ============================================================ */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Users, Search, Download, Loader2 } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { underlineInput } from "../theme/styles";
import { StampCorner, PushPin } from "../components/atmosphere";
import { Carton, TitreSection, Consigne, Label, InkStars } from "../components/ui";
import { PosterArt } from "../components/film/PosterArt";
import { recenser, chercherPersonnes, rôlesSurLeFilm, RÔLES, type Personne } from "../domain/people";
import { initialsOf, makeFilm } from "../domain/film";
import { filmKey } from "../domain/importing";
import { motifById } from "../domain/motifs";
import { tiltOf } from "../domain/seeded";
import { store } from "../services/storage";
import { searchPerson, personFilmography } from "../tmdb";
import type { Film, KinshipRole } from "../types";

interface GeneriqueViewProps {
  films: Film[];
  /** La personne ouverte, par sa clé normalisée. `null` : le répertoire. */
  personne: string | null;
  onOpenPersonne: (clé: string | null) => void;
  onOpen: (filmId: string) => void;
  onAddToWatchlist: (f: Film) => void;
}

/* LE SEUIL, ET CE QU'IL VISE VRAIMENT.

   Une collection de mille films porte huit mille noms, dont la plupart
   n'ont traversé qu'une fiche : les afficher tous ne fait pas une liste
   plus complète, ça fait une liste qu'on ne parcourt pas. Le répertoire
   ne montre donc d'emblée que ceux qu'on croise deux fois — les mêmes
   que les parentés de la constellation retiennent.

   Mais ce bruit vient d'UNE source : les huit rôles que chaque fiche
   emporte. Les cinéastes, chefs opérateurs, compositeurs et scénaristes
   se comptent par dizaines, pas par milliers, et un seuil global les
   effaçait à tort — cliquer « musique » sur une collection où un seul
   compositeur est nommé rendait le vide, ce qui se lit comme un défaut
   et non comme une règle. Le seuil ne s'applique donc qu'à celles et
   ceux dont l'interprétation est le seul titre. */
const SEUIL = 2;

const estHabitué = (p: Personne): boolean =>
  p.films.length >= SEUIL || p.rôles.some((r) => r !== "interprétation");

const ROLE_COURT: Record<KinshipRole, string> = {
  réalisation: "réalisation",
  interprétation: "interprétation",
  image: "image",
  musique: "musique",
  scénario: "scénario",
  thème: "thème",
};

export function GeneriqueView({
  films,
  personne,
  onOpenPersonne,
  onOpen,
  onAddToWatchlist,
}: GeneriqueViewProps) {
  /* Le recensement balaie toute la collection : on ne le refait qu'à
     l'écriture d'une fiche, pas à chaque frappe dans la recherche. */
  const gens = useMemo(() => recenser(films), [films]);
  const ouvert = personne ? gens.find((p) => p.clé === personne) : null;

  if (ouvert)
    return (
      <Dossier
        p={ouvert}
        films={films}
        onRetour={() => onOpenPersonne(null)}
        onOpen={onOpen}
        onAddToWatchlist={onAddToWatchlist}
      />
    );

  return <Répertoire gens={gens} onOuvrir={onOpenPersonne} inconnue={!!personne} />;
}

/* ============================================================
   LE RÉPERTOIRE
   ============================================================ */

function Répertoire({
  gens,
  onOuvrir,
  inconnue,
}: {
  gens: Personne[];
  onOuvrir: (clé: string) => void;
  inconnue: boolean;
}) {
  const [q, setQ] = useState("");
  const [rôles, setRôles] = useState<KinshipRole[]>([]);
  const [tous, setTous] = useState(false);

  const liste = useMemo(() => {
    let out = gens;
    if (rôles.length) out = out.filter((p) => rôles.some((r) => p.rôles.includes(r)));
    /* Le seuil ne s'applique PAS à une recherche : on tape un nom parce
       qu'on cherche quelqu'un en particulier, et ne pas le trouver parce
       qu'il n'a qu'un film serait le contraire de chercher. */
    if (q.trim()) return chercherPersonnes(out, q);
    return tous ? out : out.filter(estHabitué);
  }, [gens, q, rôles, tous]);

  const cachés = gens.length - gens.filter(estHabitué).length;

  return (
    <div style={{ padding: "34px 44px 70px", position: "relative" }}>
      <StampCorner text="GÉNÉRIQUE" />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 42,
          color: C.ink,
        }}
      >
        Le générique
      </div>
      <Consigne>
        Les noms que votre collection porte déjà — celles et ceux qui ont réalisé, joué, éclairé,
        composé, écrit. {gens.length} en tout.
      </Consigne>

      {inconnue && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.burgundy, marginBottom: 10 }}>
          Cette personne n'apparaît plus dans aucune fiche.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
        <Search size={15} color={C.inkFaded} />
        <input
          data-tour="generique-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="un nom…"
          style={{ ...underlineInput, fontFamily: F.body, fontSize: 16, width: 260 }}
        />
      </div>

      {/* Les tamis par rôle, cumulables et qui s'éteignent au reclic —
          les mêmes gestes que les tamis du mur. */}
      <div
        data-tour="generique-roles"
        style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}
      >
        {RÔLES.map((r) => {
          const on = rôles.includes(r);
          return (
            <button
              key={r}
              onClick={() => setRôles((s) => (on ? s.filter((x) => x !== r) : [...s, r]))}
              style={étiquette(on)}
            >
              {ROLE_COURT[r]}
            </button>
          );
        })}
        {!q.trim() && cachés > 0 && (
          <button onClick={() => setTous((t) => !t)} style={étiquette(tous, C.slate)}>
            {tous ? "les habitués seulement" : `+ ${cachés} de passage`}
          </button>
        )}
      </div>

      {liste.length === 0 ? (
        /* « Personne de ce nom » sous un tamis serait un mensonge : on
           n'a nommé personne. Chaque façon de vider la liste a sa
           phrase, et celle du seuil dit où sont passés les autres. */
        <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded }}>
          {gens.length === 0
            ? "Aucun nom pour l'instant. Complétez vos fiches par TMDB, depuis l'onglet Import, et le générique se remplira tout seul."
            : q.trim()
              ? "Personne de ce nom."
              : cachés > 0
                ? "Personne à ce titre parmi les habitués — ouvrez « de passage » pour voir le reste."
                : "Personne à ce titre."}
        </div>
      ) : (
        <div
          data-tour="generique-list"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {liste.map((p) => (
            <Fiche key={p.clé} p={p} onClick={() => onOuvrir(p.clé)} />
          ))}
        </div>
      )}
    </div>
  );
}

const étiquette = (on: boolean, teinte: string = C.burgundy) => ({
  all: "unset" as const,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 9.5,
  letterSpacing: 0.6,
  padding: "3px 9px",
  borderRadius: 12,
  border: `1px solid ${teinte}`,
  background: on ? teinte : "transparent",
  color: on ? C.card : teinte,
  transition: "background var(--motion-fast) ease, color var(--motion-fast) ease",
});

/** La carte d'un nom dans le répertoire — une fiche bristol, punaisée. */
function Fiche({ p, onClick }: { p: Personne; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      /* Le nom est écrit dans la carte, mais en trois morceaux : sans
         cet intitulé, la carte s'annonce « bouton » et rien de plus. */
      aria-label={`${p.nom} — ${p.films.length} film${p.films.length > 1 ? "s" : ""}`}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 2,
        padding: "16px 14px 12px",
        // le désordre est semé, jamais tiré au sort : un mur qui gigote n'est pas un mur
        transform: `rotate(${tiltOf(p.clé)}deg)`,
        boxShadow: "1px 2px 6px rgba(0,0,0,0.12)",
        transition: "transform var(--motion-fast) var(--motion-ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "rotate(0deg) translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${tiltOf(p.clé)}deg)`;
      }}
    >
      <PushPin color={C.plum} style={{ position: "absolute", top: -7, left: 12 }} />
      <div style={{ fontFamily: F.title, fontWeight: 700, fontSize: 17, color: C.ink }}>{p.nom}</div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          letterSpacing: 0.8,
          color: C.inkFaded,
          margin: "4px 0 8px",
        }}
      >
        {p.rôles.map((r) => ROLE_COURT[r]).join(" · ").toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: F.body,
          fontSize: 13,
          color: C.inkFaded,
        }}
      >
        <span>
          {p.films.length} film{p.films.length > 1 ? "s" : ""}
        </span>
        {p.note != null && (
          <>
            <span>·</span>
            <InkStars value={p.note} size={11} />
          </>
        )}
      </div>
    </button>
  );
}

/* ============================================================
   LE DOSSIER
   ============================================================ */

function Dossier({
  p,
  films,
  onRetour,
  onOpen,
  onAddToWatchlist,
}: {
  p: Personne;
  films: Film[];
  onRetour: () => void;
  onOpen: (id: string) => void;
  onAddToWatchlist: (f: Film) => void;
}) {
  const parId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);
  const siens = p.films.map((id) => parId.get(id)).filter(Boolean) as Film[];
  const vus = siens.filter((f) => f.status === "watched");
  const àVoir = siens.filter((f) => f.status === "watchlist");

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 1000, position: "relative" }}>
      <button onClick={onRetour} style={retour}>
        <ArrowLeft size={13} /> le générique
      </button>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <Users size={22} color={C.plum} />
        <div
          style={{
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 40,
            color: C.ink,
          }}
        >
          {p.nom}
        </div>
        {p.période && (
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded, letterSpacing: 1 }}>
            {p.période[0] === p.période[1] ? p.période[0] : `${p.période[0]} – ${p.période[1]}`}
          </div>
        )}
      </div>
      <Consigne>
        {p.rôles.map((r) => ROLE_COURT[r]).join(", ")} — {p.films.length} film
        {p.films.length > 1 ? "s" : ""} chez vous
        {p.àVoir > 0 ? `, dont ${p.àVoir} en attente` : ""}.
      </Consigne>

      <Carton tour="generique-dossier" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
          <Chiffre nom="VOTRE NOTE">
            {p.note != null ? (
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {p.note.toFixed(1)}
                <InkStars value={p.note} size={13} />
              </span>
            ) : (
              "—"
            )}
          </Chiffre>
          <Chiffre nom="ÉCART AU PUBLIC">{écartLisible(p.écart)}</Chiffre>
          <Chiffre nom="SÉANCES">{p.séances || "—"}</Chiffre>
        </div>
      </Carton>

      {/* Les motifs inconnus du catalogue sont ignorés à l'affichage et
          non effacés de la fiche — la règle est la même partout. On les
          écarte donc AVANT de décider si le bloc a lieu d'être : sinon
          un dossier n'ayant que des motifs oubliés montrait un intitulé
          suivi de rien. */}
      {(() => {
        const connus = p.motifs.map(motifById).filter(Boolean);
        if (!connus.length) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <Label>Ce qui revient</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {connus.map((m) => (
                <span key={m!.id} style={étiquette(false, C.plum)}>
                  {m!.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <Rayon titre="Vus" films={vus} clé={p.clé} onOpen={onOpen} />
      <Rayon titre="En attente" films={àVoir} clé={p.clé} onOpen={onOpen} />

      <CeQuiManque p={p} films={films} onAddToWatchlist={onAddToWatchlist} />
    </div>
  );
}

const retour = {
  all: "unset" as const,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  color: C.inkFaded,
  marginBottom: 16,
};

function Chiffre({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <div>
      <Label>{nom}</Label>
      <div style={{ fontFamily: F.title, fontSize: 26, fontWeight: 700, color: C.ink }}>
        {children}
      </div>
    </div>
  );
}

/* « Vous êtes plus sévère de 0,8 » se lit ; « −0,8 » demande de se
   rappeler dans quel sens la soustraction a été faite. */
function écartLisible(écart: number | null) {
  if (écart == null) return "—";
  const v = Math.abs(écart).toFixed(1);
  if (Math.abs(écart) < 0.15) return <span style={{ fontSize: 19 }}>d'accord</span>;
  return (
    <span style={{ fontSize: 19, color: écart > 0 ? C.moss : C.vermillion }}>
      {écart > 0 ? "plus tendre" : "plus sévère"} de {v}
    </span>
  );
}

function Rayon({
  titre,
  films,
  clé,
  onOpen,
}: {
  titre: string;
  films: Film[];
  clé: string;
  onOpen: (id: string) => void;
}) {
  if (films.length === 0) return null;
  return (
    <div style={{ marginTop: 26 }}>
      <TitreSection>
        {titre} ({films.length})
      </TitreSection>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        {films.map((f) => {
          const rôles = rôlesSurLeFilm(f, clé);
          return (
            <button key={f.id} onClick={() => onOpen(f.id)} style={vignette}>
              <PosterArt film={f} height={150} initials={initialsOf(f.title)} />
              <div
                style={{
                  fontFamily: F.title,
                  fontWeight: 700,
                  fontSize: 13,
                  color: C.ink,
                  marginTop: 7,
                  lineHeight: 1.2,
                }}
              >
                {f.title}
              </div>
              {/* Le titre auquel cette personne est là ne s'écrit que
                  s'il y a un doute : rappeler « réalisation » sous chaque
                  affiche d'un cinéaste n'apprend rien. */}
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.inkFaded, marginTop: 3 }}>
                {f.year || ""}
                {rôles.length > 1 ? ` · ${rôles.map((r) => ROLE_COURT[r]).join(", ")}` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const vignette = {
  all: "unset" as const,
  cursor: "pointer",
  width: 110,
  display: "block",
  textAlign: "left" as const,
};

/* ============================================================
   CE QU'IL ME MANQUE — la seule chose qui sorte du navigateur ici
   ============================================================ */

interface Manquant {
  tmdbId: number;
  title: string;
  year: number | null;
  poster: string;
  voteAverage: number;
}

/* Une affiche de proposition, au format 2:3 comme partout ailleurs. Une
   image cassée se replie sur les initiales plutôt que de laisser le
   cadre vide : TMDB connaît des films dont il n'a pas l'affiche, et un
   trou dans une rangée se lit comme un défaut de chargement. */
function Affiche({ titre, src }: { titre: string; src: string }) {
  const [cassée, setCassée] = useState(false);
  const cadre = {
    width: "100%",
    aspectRatio: "2 / 3",
    borderRadius: 1,
    display: "block",
  } as const;

  if (!src || cassée)
    return (
      <div
        style={{
          ...cadre,
          background: alpha(C.inkFaded, 0.14),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: F.title,
          fontSize: 22,
          color: alpha(C.ink, 0.35),
        }}
      >
        {initialsOf(titre)}
      </div>
    );

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setCassée(true)}
      style={{ ...cadre, objectFit: "cover" }}
    />
  );
}

function CeQuiManque({
  p,
  films,
  onAddToWatchlist,
}: {
  p: Personne;
  films: Film[];
  onAddToWatchlist: (f: Film) => void;
}) {
  const apiKey = store.get("tmdb-key", "");
  const [état, setÉtat] = useState<"repos" | "en-cours" | "fait">("repos");
  const [msg, setMsg] = useState("");
  const [manquants, setManquants] = useState<Manquant[]>([]);
  const [ajoutés, setAjoutés] = useState<Set<number>>(new Set());

  /* Sans clé, le bouton n'existe pas : proposer une action qui ne peut
     pas aboutir est pire que ne rien proposer. La clé se pose depuis
     l'onglet Import, et c'est là que la visite l'explique. */
  if (!apiKey) return null;

  const chercher = async () => {
    setÉtat("en-cours");
    setMsg("");
    try {
      const hit = await searchPerson(p.nom, apiKey);
      if (!hit) {
        setÉtat("fait");
        setMsg("TMDB ne connaît personne de ce nom.");
        return;
      }
      /* On demande au titre le mieux fourni : c'est celui pour lequel
         « ce qui manque » veut dire quelque chose. Un acteur vu deux
         fois comme réalisateur ne se juge pas sur ses trente rôles. */
      const rôle = p.rôles[0]!;
      const tout = await personFilmography(hit.id, apiKey, { role: rôle });

      /* Ce qu'on a déjà, par identifiant TMDB d'abord — le plus sûr — puis
         par la clé titre+année de l'import, qui neutralise déjà accents
         et articles. */
      const parTmdb = new Set(films.map((f) => f.tmdbId).filter(Boolean).map(String));
      const parTitre = new Set(films.map((f) => filmKey(f)));

      const reste = (tout as Manquant[])
        .filter((c) => c.title && !parTmdb.has(String(c.tmdbId)))
        .filter((c) => !parTitre.has(filmKey({ title: c.title, year: c.year || "" })))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      setManquants(reste);
      setÉtat("fait");
      setMsg(
        reste.length
          ? `${reste.length} film(s) que vous n'avez pas — à ce titre-là.`
          : "Rien ne manque : vous avez tout ce que TMDB lui connaît."
      );
    } catch (e) {
      setÉtat("repos");
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    }
  };

  const ajouter = (c: Manquant) => {
    onAddToWatchlist(
      makeFilm({
        title: c.title,
        year: c.year || "",
        poster: c.poster,
        director: p.rôles[0] === "réalisation" ? p.nom : "",
        status: "watchlist",
        tmdbId: c.tmdbId,
        source: "tmdb",
      })
    );
    setAjoutés((s) => new Set(s).add(c.tmdbId));
  };

  return (
    <div data-tour="generique-tmdb" style={{ marginTop: 34 }}>
      <TitreSection
        action={
          <button onClick={chercher} disabled={état === "en-cours"} style={étiquette(false, C.pine)}>
            {état === "en-cours" ? <Loader2 size={11} /> : <Download size={11} />} demander à TMDB
          </button>
        }
      >
        Ce qu'il me manque
      </TitreSection>
      <Consigne>
        Sa filmographie complète, moins ce que vous avez déjà. Rien n'est ajouté sans vous.
      </Consigne>

      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginBottom: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {manquants.map((c) => {
          const dedans = ajoutés.has(c.tmdbId);
          return (
            <div
              key={c.tmdbId}
              style={{
                width: 132,
                border: `1px solid ${C.line}`,
                background: alpha(C.card, 0.6),
                borderRadius: 2,
                padding: 8,
              }}
            >
              {/* L'AFFICHE, PARCE QU'ON CHOISIT AVEC LES YEUX.

                  Elle arrivait déjà dans la réponse — `toCandidate` la
                  rapporte — et on ne l'affichait pas : une liste de
                  titres à cocher n'est pas un rayon qu'on parcourt. Le
                  bureau des découvertes montre les siennes, celle-ci
                  n'avait pas de raison de s'en priver.

                  L'adresse est une URL TMDB, pas une clé IndexedDB : on
                  ne passe donc pas par `PosterArt`, qui sait sortir une
                  image rangée et n'aurait ici rien à sortir. Repli aux
                  initiales quand TMDB n'a pas d'affiche. */}
              <Affiche titre={c.title} src={c.poster} />
              <div
                style={{
                  fontFamily: F.title,
                  fontWeight: 700,
                  fontSize: 13,
                  color: C.ink,
                  marginTop: 7,
                  lineHeight: 1.2,
                }}
              >
                {c.title}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, margin: "3px 0 7px" }}>
                {c.year || "année inconnue"}
                {c.voteAverage ? ` · ${c.voteAverage.toFixed(1)}/10` : ""}
              </div>
              <button
                onClick={() => ajouter(c)}
                disabled={dedans}
                style={{ ...étiquette(dedans, C.ochre), cursor: dedans ? "default" : "pointer" }}
              >
                {dedans ? "dans À voir" : "+ à voir"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
