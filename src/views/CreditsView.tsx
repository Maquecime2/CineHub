/* ============================================================
   VIEW — THE CREDITS

   The same films, read through the people who made them. Nothing is
   stored here: somebody's folder is recomposed from the collection at
   every reading (`domain/people`), exactly like a thread.

   Two states in a single view, as the film library serves two walls: the
   DIRECTORY, where one looks for somebody, and the FOLDER, where one
   looks at what one has of them.
   ============================================================ */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Users, Search, Download, Loader2 } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { underlineInput, tap } from "../theme/styles";
import { StampCorner, PushPin } from "../components/atmosphere";
import { Cardstock, SectionTitle, Guideline, Label, InkStars } from "../components/ui";
import { PosterArt } from "../components/film/PosterArt";
import { census, searchPeople, rolesOnFilm, PERSON_ROLES, type Person } from "../domain/people";
import { initialsOf, makeFilm } from "../domain/film";
import { filmKey } from "../domain/importing";
import { motifById } from "../domain/motifs";
import { tiltOf } from "../domain/seeded";
import { useTmdbKey } from "../services/tmdbKey";
import { searchPerson, personFilmography } from "../tmdb";
import type { Film, KinshipRole } from "../types";

interface CreditsViewProps {
  films: Film[];
  /** The open person, by their normalised key. `null`: the directory. */
  who: string | null;
  onOpenPerson: (key: string | null) => void;
  onOpen: (filmId: string) => void;
  onAddToWatchlist: (f: Film) => void;
}

/* THE THRESHOLD, AND WHAT IT REALLY AIMS AT.

   A collection of a thousand films carries eight thousand names, most of
   which have crossed only one card: displaying them all does not make a
   more complete list, it makes a list nobody walks through. So the
   directory only shows straight away those one meets twice — the same
   ones the constellation's kinships keep.

   But that noise comes from ONE source: the eight roles each card
   carries. Film-makers, cinematographers, composers and screenwriters
   are counted in dozens, not in thousands, and a global threshold erased
   them wrongly — clicking "musique" on a collection where a single
   composer is named returned emptiness, which reads as a defect and not
   as a rule. So the threshold only applies to those whose acting is
   their only title. */
const THRESHOLD = 2;

const isRegular = (p: Person): boolean =>
  p.films.length >= THRESHOLD || p.roles.some((r) => r !== "interprétation");

const SHORT_ROLE: Record<KinshipRole, string> = {
  réalisation: "réalisation",
  interprétation: "interprétation",
  image: "image",
  musique: "musique",
  scénario: "scénario",
  thème: "thème",
};

export function CreditsView({
  films,
  who,
  onOpenPerson,
  onOpen,
  onAddToWatchlist,
}: CreditsViewProps) {
  /* The census sweeps the whole collection: we only redo it when a card
     is written, not at every keystroke in the search. */
  const people = useMemo(() => census(films), [films]);
  const open = who ? people.find((p) => p.key === who) : null;

  if (open)
    return (
      <Dossier
        p={open}
        films={films}
        onRetour={() => onOpenPerson(null)}
        onOpen={onOpen}
        onAddToWatchlist={onAddToWatchlist}
      />
    );

  return <Directory people={people} onOuvrir={onOpenPerson} unknown={!!who} />;
}

/* ============================================================
   THE DIRECTORY
   ============================================================ */

function Directory({
  people,
  onOuvrir,
  unknown,
}: {
  people: Person[];
  onOuvrir: (key: string) => void;
  unknown: boolean;
}) {
  const [q, setQ] = useState("");
  const [roles, setRoles] = useState<KinshipRole[]>([]);
  const [all, setTous] = useState(false);

  const list = useMemo(() => {
    let out = people;
    if (roles.length) out = out.filter((p) => roles.some((r) => p.roles.includes(r)));
    /* The threshold does NOT apply to a search: one types a name
       because one is looking for somebody in particular, and not finding
       them because they have only one film would be the opposite of
       searching. */
    if (q.trim()) return searchPeople(out, q);
    return all ? out : out.filter(isRegular);
  }, [people, q, roles, all]);

  const hiddenCount = people.length - people.filter(isRegular).length;

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
      <Guideline>
        Les noms que votre collection porte déjà — celles et ceux qui ont réalisé, joué, éclairé,
        composé, écrit. {people.length} en tout.
      </Guideline>

      {unknown && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.burgundy, marginBottom: 10 }}>
          Cette personne n'apparaît plus dans aucune fiche.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
        <Search size={15} color={C.inkFaded} />
        <input
          data-tour="credits-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="un nom…"
          style={{ ...underlineInput, fontFamily: F.body, fontSize: 16, width: 260 }}
        />
      </div>

      {/* The sieves by role, which add up and go out when clicked again
          — the same gestures as the wall's sieves. */}
      <div
        data-tour="credits-roles"
        style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}
      >
        {PERSON_ROLES.map((r) => {
          const on = roles.includes(r);
          return (
            <button
              key={r}
              onClick={() => setRoles((s) => (on ? s.filter((x) => x !== r) : [...s, r]))}
              style={chipLook(on)}
            >
              {SHORT_ROLE[r]}
            </button>
          );
        })}
        {!q.trim() && hiddenCount > 0 && (
          <button onClick={() => setTous((t) => !t)} style={chipLook(all, C.slate)}>
            {all ? "les habitués seulement" : `+ ${hiddenCount} de passage`}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        /* "Nobody of that name" under a sieve would be a lie: nobody
           has been named. Each way of emptying the list has its own
           sentence, and the threshold's says where the others went. */
        <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded }}>
          {people.length === 0
            ? "Aucun nom pour l'instant. Complétez vos fiches par TMDB, depuis l'onglet Import, et le générique se remplira tout seul."
            : q.trim()
              ? "Personne de ce nom."
              : hiddenCount > 0
                ? "Personne à ce titre parmi les habitués — ouvrez « de passage » pour voir le reste."
                : "Personne à ce titre."}
        </div>
      ) : (
        <div
          data-tour="credits-list"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {list.map((p) => (
            <Card key={p.key} p={p} onClick={() => onOuvrir(p.key)} />
          ))}
        </div>
      )}
    </div>
  );
}

const chipLook = (on: boolean, tint: string = C.burgundy) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 9.5,
  letterSpacing: 0.6,
  padding: "3px 9px",
  borderRadius: 12,
  border: `1px solid ${tint}`,
  background: on ? tint : "transparent",
  color: on ? C.card : tint,
  transition: "background var(--motion-fast) ease, color var(--motion-fast) ease",
});

/** The card of a name in the directory — an index card, pinned up. */
function Card({ p, onClick }: { p: Person; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      /* The name is written in the card, but in three pieces: without
         this label, the card announces itself as "button" and nothing
         more. */
      aria-label={`${p.name} — ${p.films.length} film${p.films.length > 1 ? "s" : ""}`}
      style={{
        all: "unset",
        ...tap,
        cursor: "pointer",
        display: "block",
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 2,
        padding: "16px 14px 12px",
        // the disorder is sown, never drawn at random: a wall that wriggles is not a wall
        transform: `rotate(${tiltOf(p.key)}deg)`,
        boxShadow: "1px 2px 6px rgba(0,0,0,0.12)",
        transition: "transform var(--motion-fast) var(--motion-ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "rotate(0deg) translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${tiltOf(p.key)}deg)`;
      }}
    >
      <PushPin color={C.plum} style={{ position: "absolute", top: -7, left: 12 }} />
      <div style={{ fontFamily: F.title, fontWeight: 700, fontSize: 17, color: C.ink }}>
        {p.name}
      </div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          letterSpacing: 0.8,
          color: C.inkFaded,
          margin: "4px 0 8px",
        }}
      >
        {p.roles
          .map((r) => SHORT_ROLE[r])
          .join(" · ")
          .toUpperCase()}
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
        {p.rating != null && (
          <>
            <span>·</span>
            <InkStars value={p.rating} size={11} />
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
  p: Person;
  films: Film[];
  onRetour: () => void;
  onOpen: (id: string) => void;
  onAddToWatchlist: (f: Film) => void;
}) {
  const perId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);
  const theirs = p.films.map((id) => perId.get(id)).filter(Boolean) as Film[];
  const seenFilms = theirs.filter((f) => f.status === "watched");
  const wishlist = theirs.filter((f) => f.status === "watchlist");

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 1000, position: "relative" }}>
      <button onClick={onRetour} style={back}>
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
          {p.name}
        </div>
        {p.period && (
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded, letterSpacing: 1 }}>
            {p.period[0] === p.period[1] ? p.period[0] : `${p.period[0]} – ${p.period[1]}`}
          </div>
        )}
      </div>
      <Guideline>
        {p.roles.map((r) => SHORT_ROLE[r]).join(", ")} — {p.films.length} film
        {p.films.length > 1 ? "s" : ""} chez vous
        {p.toWatch > 0 ? `, dont ${p.toWatch} en attente` : ""}.
      </Guideline>

      <Cardstock tour="credits-page" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
          <Figure name="VOTRE NOTE">
            {p.rating != null ? (
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {p.rating.toFixed(1)}
                <InkStars value={p.rating} size={13} />
              </span>
            ) : (
              "—"
            )}
          </Figure>
          <Figure name="ÉCART AU PUBLIC">{readableGap(p.gap)}</Figure>
          <Figure name="SÉANCES">{p.screenings || "—"}</Figure>
        </div>
      </Cardstock>

      {/* Patterns unknown to the catalogue are ignored when displaying
          and not erased from the card — the rule is the same everywhere.
          So we set them aside BEFORE deciding whether the block has any
          reason to be: otherwise a folder holding only forgotten
          patterns showed a heading followed by nothing. */}
      {(() => {
        const known = p.motifs.map(motifById).filter(Boolean);
        if (!known.length) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <Label>Ce qui revient</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {known.map((m) => (
                <span key={m!.id} style={chipLook(false, C.plum)}>
                  {m!.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <Shelf title="Vus" films={seenFilms} key={p.key} onOpen={onOpen} />
      <Shelf title="En attente" films={wishlist} key={p.key} onOpen={onOpen} />

      <WhatIsMissing p={p} films={films} onAddToWatchlist={onAddToWatchlist} />
    </div>
  );
}

const back = {
  all: "unset" as const,
  ...tap,
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

function Figure({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div>
      <Label>{name}</Label>
      <div style={{ fontFamily: F.title, fontSize: 26, fontWeight: 700, color: C.ink }}>
        {children}
      </div>
    </div>
  );
}

/* "Vous êtes plus sévère de 0,8" reads by itself; "−0,8" asks one to
   remember which way round the subtraction was done. */
function readableGap(gap: number | null) {
  if (gap == null) return "—";
  const v = Math.abs(gap).toFixed(1);
  if (Math.abs(gap) < 0.15) return <span style={{ fontSize: 19 }}>d'accord</span>;
  return (
    <span style={{ fontSize: 19, color: gap > 0 ? C.moss : C.vermillion }}>
      {gap > 0 ? "plus tendre" : "plus sévère"} de {v}
    </span>
  );
}

function Shelf({
  title,
  films,
  key,
  onOpen,
}: {
  title: string;
  films: Film[];
  key: string;
  onOpen: (id: string) => void;
}) {
  if (films.length === 0) return null;
  return (
    <div style={{ marginTop: 26 }}>
      <SectionTitle>
        {title} ({films.length})
      </SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        {films.map((f) => {
          const roles = rolesOnFilm(f, key);
          return (
            <button key={f.id} onClick={() => onOpen(f.id)} style={thumb}>
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
              {/* The title under which this person is here is only
                  written if there is a doubt: repeating "réalisation"
                  under every poster of a film-maker teaches nothing. */}
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.inkFaded, marginTop: 3 }}>
                {f.year || ""}
                {roles.length > 1 ? ` · ${roles.map((r) => SHORT_ROLE[r]).join(", ")}` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const thumb = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  width: 110,
  display: "block",
  textAlign: "left" as const,
};

/* ============================================================
   WHAT I AM MISSING — the only thing that leaves the browser here
   ============================================================ */

interface Missing {
  tmdbId: number;
  title: string;
  year: number | null;
  poster: string;
  voteAverage: number;
}

/* A proposal's poster, in the 2:3 format as everywhere else. A broken
   image falls back on the initials rather than leave the frame empty:
   TMDB knows films whose poster it does not have, and a hole in a row
   reads as a loading failure. */
function Poster({ title, src }: { title: string; src: string }) {
  const [broken, setBroken] = useState(false);
  const frame = {
    width: "100%",
    aspectRatio: "2 / 3",
    borderRadius: 1,
    display: "block",
  } as const;

  if (!src || broken)
    return (
      <div
        style={{
          ...frame,
          background: alpha(C.inkFaded, 0.14),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: F.title,
          fontSize: 22,
          color: alpha(C.ink, 0.35),
        }}
      >
        {initialsOf(title)}
      </div>
    );

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      style={{ ...frame, objectFit: "cover" }}
    />
  );
}

function WhatIsMissing({
  p,
  films,
  onAddToWatchlist,
}: {
  p: Person;
  films: Film[];
  onAddToWatchlist: (f: Film) => void;
}) {
  const apiKey = useTmdbKey();
  const [state, setState] = useState<"repos" | "en-cours" | "fait">("repos");
  const [msg, setMsg] = useState("");
  const [manquants, setManquants] = useState<Missing[]>([]);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  /* Without a key the button does not exist: offering an action that
     cannot succeed is worse than offering nothing. The key is laid from
     the Import tab, and that is where the tour explains it. */
  if (!apiKey) return null;

  const search = async () => {
    setState("en-cours");
    setMsg("");
    try {
      const hit = await searchPerson(p.name, apiKey);
      if (!hit) {
        setState("fait");
        setMsg("TMDB ne connaît personne de ce nom.");
        return;
      }
      /* We ask about the best furnished title: it is the one for which
         "what is missing" means something. An actor seen twice as a
         director is not judged on their thirty acting roles. */
      const role = p.roles[0]!;
      const everything = await personFilmography(hit.id, apiKey, { role: role });

      /* What we already have, by TMDB identifier first — the safest —
         then by the import's title+year key, which already neutralises
         accents and articles. */
      const perTmdb = new Set(
        films
          .map((f) => f.tmdbId)
          .filter(Boolean)
          .map(String)
      );
      const byTitle = new Set(films.map((f) => filmKey(f)));

      const rest = (everything as Missing[])
        .filter((c) => c.title && !perTmdb.has(String(c.tmdbId)))
        .filter((c) => !byTitle.has(filmKey({ title: c.title, year: c.year || "" })))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      setManquants(rest);
      setState("fait");
      setMsg(
        rest.length
          ? `${rest.length} film(s) que vous n'avez pas — à ce titre-là.`
          : "Rien ne manque : vous avez tout ce que TMDB lui connaît."
      );
    } catch (e) {
      setState("repos");
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    }
  };

  const add = (c: Missing) => {
    onAddToWatchlist(
      makeFilm({
        title: c.title,
        year: c.year || "",
        poster: c.poster,
        director: p.roles[0] === "réalisation" ? p.name : "",
        status: "watchlist",
        tmdbId: c.tmdbId,
        source: "tmdb",
      })
    );
    setAddedIds((s) => new Set(s).add(c.tmdbId));
  };

  return (
    <div data-tour="credits-tmdb" style={{ marginTop: 34 }}>
      <SectionTitle
        action={
          <button onClick={search} disabled={state === "en-cours"} style={chipLook(false, C.pine)}>
            {state === "en-cours" ? <Loader2 size={11} /> : <Download size={11} />} demander à TMDB
          </button>
        }
      >
        Ce qu'il me manque
      </SectionTitle>
      <Guideline>
        Sa filmographie complète, moins ce que vous avez déjà. Rien n'est ajouté sans vous.
      </Guideline>

      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginBottom: 10 }}>
          {msg}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {manquants.map((c) => {
          const inside = addedIds.has(c.tmdbId);
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
              {/* THE POSTER, BECAUSE ONE CHOOSES WITH THE EYES.

                  It already came in the answer — `toCandidate` brings it
                  back — and we did not display it: a list of titles to
                  tick is not a shelf one walks along. The discoveries
                  desk shows its own, this one had no reason to do
                  without.

                  The address is a TMDB URL, not an IndexedDB key: so we
                  do not go through `PosterArt`, which knows how to bring
                  out a stored image and would have nothing to bring out
                  here. Fallback to the initials when TMDB has no
                  poster. */}
              <Poster title={c.title} src={c.poster} />
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
              <div
                style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, margin: "3px 0 7px" }}
              >
                {c.year || "année inconnue"}
                {c.voteAverage ? ` · ${c.voteAverage.toFixed(1)}/10` : ""}
              </div>
              <button
                onClick={() => add(c)}
                disabled={inside}
                style={{ ...chipLook(inside, C.ochre), cursor: inside ? "default" : "pointer" }}
              >
                {inside ? "dans À voir" : "+ à voir"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
