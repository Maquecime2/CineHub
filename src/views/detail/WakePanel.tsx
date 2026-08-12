/* ============================================================
   IN THE WAKE — the panel, at the bottom of the card

   Two columns of the same width, and that is a stance: what one already
   has is worth as much as what one has not. A collection kept for years
   often answers "what next to this one?" better than the world
   catalogue, because it knows what one has loved.

   The LEFT column draws itself synchronously, with no network, no key.
   The RIGHT column arrives afterwards — and must never make the left one
   jump as it arrives, hence the reserved height.

   WITHOUT A KEY, THE RIGHT COLUMN STAYS MOUNTED. Making it vanish would
   give a one-column panel that looks complete, and one would never know
   that something is missing nor how to get it.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Bookmark, Compass, Waves } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { Cardstock, Guideline, NoKey, SectionTitle } from "../../components/ui";
import { PosterArt } from "../../components/film/PosterArt";
import { initialsOf, makeFilm } from "../../domain/film";
import { wakeAtHome, familyOf, byQuotas } from "../../domain/wake";
import type { Neighbour } from "../../domain/wake";
import {
  mergeAfar,
  reinforcementFromOutside,
  alreadyInTheBinder,
  byTmdbId,
} from "../../domain/wakeAfar";
import type { FarNeighbour } from "../../domain/wakeAfar";
import { harvestTheWake } from "../../services/wake";
import { useTmdbKey } from "../../services/tmdbKey";
import { directorOf } from "../../tmdb";
import type { Film } from "../../types";

/* The height reserved under each column title. The two columns fill up
   at different moments — one straight away, the other on the network's
   return — and without a floor the page would rearrange itself under the
   cursor at the very moment one is about to click. */
const MIN_HEIGHT = 220;

/* TEN PER COLUMN, AND NOT OF JUST ANY KIND.

   Five proposals held together by the PEOPLE who made the films, five by
   what they SPEAK OF. Without that split, proper nouns — which weigh
   more, and rightly so — took the whole list: one learned "same crew"
   ten times over and "same subject" never.

   What one family does not fill goes back to the others: a collection
   with neither patterns nor keywords must see ten proposals, not four.

   THE THIRD SHARE IS THE SMALLEST, AND THAT IS INTENDED. "Seen by the
   same people" is the only connection that teaches nothing about the
   film — it is the crowd speaking. Yet it was worth 2.2 when a subject
   tops out at 1.8, and lived in the same pile: TMDB's twenty
   recommendations took the five places every single time, and no
   keyword-based connection ever appeared. */
const QUOTAS = { people: 4, subjects: 4, crowd: 2 };

/* ------------------------------------------------------------
   ONE PROPOSAL — the poster, the title, and WHY
   ------------------------------------------------------------

   The reason is not an ornament: it is all the panel brings. A list of
   posters without reasons is one more shelf; with them it is an
   argument, and one may disagree — which supposes having
   understood. */
function Proposition({
  title,
  year,
  raison,
  affiche,
  onClick,
  aside,
  unfolded,
}: {
  title: string;
  year: number | string | null;
  raison: string;
  affiche: ReactNode;
  onClick?: () => void;
  /** A note to the right of the title: "à voir", for instance. */
  aside?: string;
  /** What unfolds under the proposal when one opens it. */
  unfolded?: ReactNode;
}) {
  const content = (
    <>
      {/* THE POSTER'S CELL IS POSITIONED, AND IT HAS A SIZE.

          `PosterArt` in `plain` mode lays itself out in `position:
          absolute; inset: 0` — it expects the container to impose its
          dimensions. Without `position: relative` here, the poster
          climbed up to the first positioned ancestor and spread across
          the whole page, a 185 px thumbnail stretched over a thousand: a
          huge blurred image in the middle of the card. */}
      <div
        style={{
          position: "relative",
          width: 44,
          height: 66, // le 2:3 d'une affiche
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {affiche}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: F.title,
            fontWeight: 700,
            fontSize: 14.5,
            color: C.ink,
            display: "flex",
            alignItems: "baseline",
            gap: 6,
          }}
        >
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          {aside && (
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.ochre, flexShrink: 0 }}>
              {aside}
            </span>
          )}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 1 }}>
          {year || "s.d."}
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 13.5,
            color: C.inkFaded,
            marginTop: 3,
            lineHeight: 1.35,
          }}
        >
          {raison}
        </div>
      </div>
    </>
  );

  const style: CSSProperties = {
    display: "flex",
    gap: 10,
    padding: "8px 4px",
    alignItems: "flex-start",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
  };

  /* The thin line is on the WRAPPER and not on the row: otherwise it
     would pass between the proposal and its unfolding, which would then
     read as two different entries. */
  return (
    <div style={{ borderBottom: `1px dashed ${C.line}` }}>
      {onClick ? (
        <button
          onClick={onClick}
          aria-expanded={unfolded ? true : undefined}
          style={{
            all: "unset",
            ...style,
            cursor: "pointer",
            transition: "background var(--motion-fast) ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = alpha(C.ochre, 0.09);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {content}
        </button>
      ) : (
        <div style={style}>{content}</div>
      )}
      {unfolded}
    </div>
  );
}

/* THE POSTER OF A CARD OF THE BINDER, VERY SMALL.

   `PosterArt` can do everything — the poster stored in IndexedDB, the
   fallback, the grain — but its substitute is cut for the shelf's cases:
   it writes the initials at forty pixels, which overflows a cell of
   forty-four. So we only call it when there really is a poster, and we
   write the initials ourselves, at our own scale, otherwise. */
function Vignette({ film }: { film: Film }) {
  if (film.poster) return <PosterArt film={film} initials={initialsOf(film.title)} plain />;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(160deg, ${hueOf(film.id)}, #1c1712)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: F.title,
        fontStyle: "italic",
        fontSize: 15,
        color: "#f3ead8cc",
      }}
    >
      {initialsOf(film.title)}
    </div>
  );
}

/* ------------------------------------------------------------
   LEARNING MORE WITHOUT LEAVING THE BINDER
   ------------------------------------------------------------

   The proposals from outside led nowhere: a title, a poster, a reason,
   and nothing to be done with them. One could neither keep them, nor
   even know what they were about — one had to go and look elsewhere,
   which is to say leave.

   The unfolding answers on the spot. The synopsis comes ALREADY with the
   candidate (`toCandidate` keeps 240 characters of it); only the
   director is missing, and it is asked for on opening — one call, for
   the film one is looking at, and not forty in advance for those one
   will never open. */
function Unfold({
  v,
  director,
  alreadySetAside,
  onMettreDeCôté,
}: {
  v: FarNeighbour;
  director: string;
  alreadySetAside: boolean;
  onMettreDeCôté: () => void;
}) {
  return (
    <div style={{ padding: "2px 4px 12px 58px" }}>
      {director && (
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginBottom: 4 }}>
          {director.toUpperCase()}
        </div>
      )}
      {v.overview ? (
        <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>
          {v.overview}
        </div>
      ) : (
        <div style={{ fontFamily: F.hand, fontSize: 13.5, color: C.inkFaded }}>
          TMDB n&apos;en donne aucun résumé.
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 8,
        }}
      >
        <button
          onClick={onMettreDeCôté}
          disabled={alreadySetAside}
          style={{
            all: "unset",
            cursor: alreadySetAside ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            fontFamily: F.mono,
            fontSize: 10,
            borderRadius: "var(--tag-radius)",
            border: `1px solid ${alreadySetAside ? C.line : C.pine}`,
            color: alreadySetAside ? C.inkFaded : C.card,
            background: alreadySetAside ? "transparent" : C.pine,
          }}
        >
          <Bookmark size={11} /> {alreadySetAside ? "mis de côté" : "mettre de côté"}
        </button>
        <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
          {v.voteAverage ? `${v.voteAverage.toFixed(1)} / 10 · ${v.voteCount} votes` : "pas noté"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   WHY THE COLUMN ONLY SPEAKS OF CREWS
   ------------------------------------------------------------

   The wake connects by people AND by subjects. But subjects only exist
   if the cards carry them: patterns and themes are laid by hand, and
   TMDB's keywords have only lately been harvested. On a collection
   imported before that, the "subjects" half is empty — and the list
   speaks of crews only.

   WITH A KEY, THE PROBLEM NO LONGER ARISES: the reinforcement coming
   from TMDB fills the gap by itself (see `reinforcementFromOutside`). So
   this word only appears OFFLINE, where it stays true — and where the
   only remedy really is to lay patterns by hand. */
function SubjectsMissing() {
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 13.5,
        color: C.inkFaded,
        borderLeft: `2px solid ${alpha(C.ochre, 0.5)}`,
        paddingLeft: 8,
        margin: "2px 0 6px",
        lineHeight: 1.35,
      }}
    >
      Sans clé TMDB, les rapprochements par sujet demandent des motifs ou des mots-clés posés à la
      main — cette fiche n&apos;en a aucun.
    </div>
  );
}

/* What is said of an empty column. Never nothing: a mute column reads
   "it is broken", and one will not know it is simply that the binder is
   still small. */
function Nothing({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 14,
        color: C.inkFaded,
        padding: "14px 4px",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

export function WakePanel({
  film,
  films,
  onOpen,
  onAddToWatchlist,
}: {
  film: Film;
  films: Film[];
  /** Opens a card of the collection. */
  onOpen: (id: string) => void;
  /** Files a proposal from outside into the "à voir" list. */
  onAddToWatchlist?: (f: Film) => void;
}) {
  const apiKey = useTmdbKey();

  /* The in-house half: pure, synchronous, and recomputed only when the
     collection or the pivot move — not at every keystroke in a field of
     the card, which would replay the sort over five hundred cards. */
  /* What the collection says of itself, with no network. Broad: this is
     not the final list, only one of its two sources. */
  const house: Neighbour[] = useMemo(
    () => wakeAtHome(film, films, { people: 40, subjects: 40 }),
    [film, films]
  );

  /* The reinforcement coming from TMDB — your own cards, recognised in
     what the harvest brings back. It arrives after the network, hence
     the state. */
  const [renfort, setRenfort] = useState<Neighbour[]>([]);

  /* This film has NOTHING a subject connection could bear on. We look
     at the pivot and not at the collection: it is the pivot one is
     looking at, and it is its own lack that explains what one reads. */
  const noSubjects =
    !(film.motifs || []).length && !(film.themes || []).length && !(film.keywords || []).length;

  /* THE TWO SOURCES MERGED, THEN THE QUOTAS.

     One and the same card may come from both sides: through its own
     patterns, and because TMDB brought it back. We then keep the one
     that EXPLAINS best — the better score — and never both, otherwise
     the same poster would appear twice in the column. */
  const atHome: Neighbour[] = useMemo(() => {
    const perFilm = new Map<string, Neighbour>();
    for (const v of [...house, ...renfort]) {
      const existing = perFilm.get(v.film.id);
      if (!existing || v.score > existing.score) perFilm.set(v.film.id, v);
    }
    const all = [...perFilm.values()].sort(
      (a, b) => b.score - a.score || a.film.title.localeCompare(b.film.title, "fr")
    );
    return byQuotas(all, (v) => familyOf(v.links), QUOTAS);
  }, [house, renfort]);

  const [dehors, setDehors] = useState<FarNeighbour[] | null>(null);
  const [query, setQuery] = useState(false);
  /* The unfolded proposal — one at a time only: two open synopses would
     turn the column into an article. */
  const [open, setOuvert] = useState<number | null>(null);
  /* The directors already asked for, by TMDB identifier. `discover` and
     `recommendations` return films, not crews: the name is asked for
     separately, and only for the one being opened. */
  const [réals, setRéals] = useState<Record<number, string>>({});
  const [misDeCôté, setMisDeCôté] = useState<Set<number>>(() => new Set());

  /* WHAT ONE OWNS IS READ AT HARVEST TIME, AND IS NOT TRACKED.

     `films` is deliberately absent from the dependencies: it is the
     effect's closure that keeps the snapshot of it, taken at the moment
     the question was asked. Two reasons, which point the same way.

     The first is a flaw: setting a proposal aside adds a card, hence
     changes `films` — and the effect replayed itself, folding back the
     synopsis one had only just opened.

     The second is a choice: that film MUST stay in its place. Watching
     it vanish under the cursor at the instant one keeps it would give
     the impression of having lost it. It stays, marked "à voir" — the
     list answers a question asked on opening, it is not a dashboard that
     rewrites itself. */
  useEffect(() => {
    setDehors(null);
    setRenfort([]);
    setOuvert(null);
    setMisDeCôté(new Set());
    if (!apiKey) return;
    let alive = true;
    setQuery(true);
    harvestTheWake(film, apiKey)
      .then((récoltes) => {
        if (!alive) return;
        /* The SAME harvest serves both columns: what it brings back
           that you already own feeds the left, the rest the right. That
           is what gives connections by subject without having to ask for
           the keywords of five hundred cards. */
        setRenfort(reinforcementFromOutside(récoltes, byTmdbId(films), film.id));
        setDehors(mergeAfar(récoltes, { alreadyHere: alreadyInTheBinder(films), quotas: QUOTAS }));
      })
      /* A network failure returns an EMPTY list and not `null`: the
         column must say "nothing found" rather than spin for ever. */
      .catch(() => {
        if (alive) setDehors([]);
      })
      .finally(() => {
        if (alive) setQuery(false);
      });
    return () => {
      alive = false;
    };
    /* `film.id` and not `film`: touching up a rating or laying a
       pattern returns a new object, and redoing the harvest at every
       keystroke would empty the column before one's eyes. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.id, apiKey]);

  /* Unfolding asks for the director, once. A failure says nothing: the
     unfolding is already worth it for its synopsis and its button. */
  const unfold = (v: FarNeighbour) => {
    setOuvert((o) => (o === v.tmdbId ? null : v.tmdbId));
    if (réals[v.tmdbId] != null || !apiKey) return;
    directorOf(v.tmdbId, apiKey)
      .then((name: string) => setRéals((r) => ({ ...r, [v.tmdbId]: name })))
      .catch(() => {});
  };

  /* SETTING ASIDE BUILDS A REAL CARD, not a bookmark. We store in it
     what we already know — title, year, poster, identifier, and the
     director if it has been asked for — so that it leaves named instead
     of waiting for a "complete the cards" that would ask for the same
     thing again. It is the same gesture as the discoveries desk. */
  const setAside = (v: FarNeighbour) => {
    onAddToWatchlist?.(
      makeFilm({
        title: v.title,
        year: v.year || "",
        /* `toCandidate` ALREADY returns a complete URL. Prefixing it
           again gave "…/w342https://image.tmdb…": broken thumbnails all
           down the column, and — far worse — an invalid poster written
           into the collection at every setting aside. */
        poster: v.poster || "",
        director: réals[v.tmdbId] || "",
        status: "watchlist",
        tmdbId: v.tmdbId,
        source: "tmdb",
      })
    );
    setMisDeCôté((s) => new Set(s).add(v.tmdbId));
  };

  return (
    <Cardstock tour="detail-sillage" style={{ marginTop: 18 }}>
      <SectionTitle icon={<Waves size={15} color={C.cobalt} />}>Dans le sillage</SectionTitle>
      <Guideline>
        ce qui fits de « {film.title} » — per l&apos;équipe, les sujets, les people à l&apos;affiche
      </Guideline>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 22,
          marginTop: 14,
        }}
      >
        {/* ---- CHEZ VOUS ---- */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.burgundy,
              marginBottom: 4,
            }}
          >
            CHEZ VOUS
          </div>
          {!apiKey && noSubjects && <SubjectsMissing />}
          <div style={{ minHeight: MIN_HEIGHT }}>
            {atHome.length ? (
              atHome.map((v) => (
                <Proposition
                  key={v.key}
                  title={v.film.title}
                  year={v.film.year}
                  raison={v.reason}
                  aside={v.film.status === "watchlist" ? "à voir" : undefined}
                  onClick={() => onOpen(v.film.id)}
                  affiche={<Vignette film={v.film} />}
                />
              ))
            ) : (
              <Nothing>
                Rien dans le classeur ne tient encore de celui-ci. Les rapprochements se font sur
                l&apos;équipe, les motifs et les gens à l&apos;affiche : compléter les fiches par
                TMDB en fait apparaître beaucoup d&apos;un coup.
              </Nothing>
            )}
          </div>
        </div>

        {/* ---- AILLEURS ---- */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.cobalt,
              marginBottom: 4,
            }}
          >
            AILLEURS
          </div>
          <div style={{ minHeight: MIN_HEIGHT }}>
            {!apiKey ? (
              <NoKey what="chercher au-dehors ce qui tient de ce film" />
            ) : query ? (
              <Nothing>
                <Compass size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                on regarde du côté de l&apos;équipe…
              </Nothing>
            ) : dehors?.length ? (
              dehors.map((v) => (
                <Proposition
                  key={v.key}
                  title={v.title}
                  year={v.year}
                  raison={v.reason}
                  aside={misDeCôté.has(v.tmdbId) ? "à voir" : undefined}
                  onClick={() => unfold(v)}
                  unfolded={
                    open === v.tmdbId ? (
                      <Unfold
                        v={v}
                        director={réals[v.tmdbId] || ""}
                        alreadySetAside={misDeCôté.has(v.tmdbId)}
                        onMettreDeCôté={() => setAside(v)}
                      />
                    ) : undefined
                  }
                  affiche={
                    v.poster ? (
                      <img
                        src={v.poster}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: alpha(C.ink, 0.08),
                          border: `1px solid ${C.line}`,
                        }}
                      />
                    )
                  }
                />
              ))
            ) : (
              <Nothing>
                Rien de ce côté — soit ce film n&apos;a pas d&apos;équipe renseignée sur TMDB, soit
                tout ce qu&apos;on trouve est déjà chez vous.
              </Nothing>
            )}
          </div>
        </div>
      </div>
    </Cardstock>
  );
}
