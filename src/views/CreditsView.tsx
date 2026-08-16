/* ============================================================
   VIEW — THE CREDITS

   The same films, read through the people who made them. Nothing is
   stored here: somebody's folder is recomposed from the collection at
   every reading (`domain/people`), exactly like a thread.

   Two states in a single view, as the film library serves two walls: the
   DIRECTORY, where one looks for somebody, and the FOLDER, where one
   looks at what one has of them.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Users,
  Search,
  Download,
  Loader2,
} from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { underlineInput, tap } from "../theme/styles";
import { StampCorner, PushPin } from "../components/atmosphere";
import { Cardstock, SectionTitle, Guideline, Label, InkStars, Honours } from "../components/ui";
import { PosterArt } from "../components/film/PosterArt";
import {
  census,
  searchPeople,
  rolesOnFilm,
  standouts,
  companions,
  averageRating,
  isRegular,
  sortPeople,
  SORT_KEYS,
  PERSON_ROLES,
  type Person,
  type SortKey,
} from "../domain/people";
import { initialsOf, makeFilm } from "../domain/film";
import { filmKey } from "../domain/importing";
import { motifById } from "../domain/motifs";
import { tiltOf } from "../domain/seeded";
import { useTranslation } from "react-i18next";
import { useTmdbKey } from "../services/tmdbKey";
import { searchPerson, personFilmography, personPortrait } from "../tmdb";
import type { Film, KinshipRole } from "../types";

interface CreditsViewProps {
  films: Film[];
  /** The open person, by their normalised key. `null`: the directory. */
  who: string | null;
  onOpenPerson: (key: string | null) => void;
  onOpen: (filmId: string) => void;
  onAddToWatchlist: (f: Film) => void;
}

/* COMBIEN DE NOMS LA PAGE POSE AVANT QU'ON EN DEMANDE PLUS.

   Soixante : de quoi remplir l'écran et le suivant sur un grand moniteur,
   assez peu pour que la grille se dessine sans qu'on l'attende. Le
   nombre est ici et pas dans le composant parce qu'il se règle en le
   lisant — c'est un arbitrage entre deux gênes, pas une constante de
   calcul. */
const PAGE = 60;

/* The threshold that keeps the directory walkable — and the reason for
   it — now live in `domain/people`, beside the census that produces the
   names: the head of the directory (`standouts`) obeys the same rule,
   and two thresholds would have parted company at the first change.

   The roles read from the catalogue, under `roles.<id>` — the ids stay
   the French words because that is what a card carries on disk. */

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
        /* LES VOISINS, DANS L'ORDRE DU RÉPERTOIRE. On entrait dans une
           fiche et on n'en sortait que par « retour » : passer d'un
           réalisateur au suivant demandait de revenir à la liste, de la
           reparcourir, et de recliquer. `census` rend déjà les gens
           triés, le mieux fourni d'abord — c'est le même ordre que la
           grille, donc « suivant » mène où l'œil l'attend. */
        people={people}
        films={films}
        onRetour={() => onOpenPerson(null)}
        onOpen={onOpen}
        onOpenPerson={onOpenPerson}
        onAddToWatchlist={onAddToWatchlist}
      />
    );

  return <Directory people={people} onOuvrir={onOpenPerson} unknown={!!who} />;
}

/* ============================================================
   A FACE

   TMDB has a photograph of most of the names a card carries, and the
   credits showed none of them: a page of people that shows no people.

   THREE RULES, AND THEY ARE THE WHOLE COMPONENT.

   1. Never on the way. The initials are drawn AT ONCE, the photograph
      slips in when it arrives, and a failure changes nothing on screen.
      Nobody waits for a face to read a name.
   2. Never on the full directory. A well-stocked collection carries
      thousands of names; one call each would be thousands of calls. So
      faces are only asked for where the names are few and chosen — the
      head of the directory, and the folder's heading.
   3. No key, no frame. Not a grey square, not a silhouette: the tab
      simply has no photographs, exactly as "what is missing" has no
      button. That is the binder's rule — what depends on the outside is
      invisible without it, never greyed out.
   ============================================================ */
function Portrait({ name, size = 46 }: { name: string; size?: number }) {
  const apiKey = useTmdbKey();
  /* The face is kept WITH the name it belongs to, rather than wiped on
     every change: a lone `src` had to be reset inside the effect, and
     for one render Ozu wore Varda's face. */
  const [got, setGot] = useState<{ name: string; src: string } | null>(null);
  const [broken, setBroken] = useState("");

  useEffect(() => {
    if (!apiKey) return;
    let alive = true;
    /* A silent failure: the initials are already there, and an error
       message about a decoration would be noise. */
    personPortrait(name, apiKey)
      .then((src: string) => {
        if (alive) setGot({ name, src });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name, apiKey]);

  if (!apiKey) return null;

  const src = got?.name === name && broken !== name ? got.src : "";

  const frame = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "50%",
    border: `1px solid ${C.line}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: alpha(C.inkFaded, 0.14),
  } as const;

  if (!src)
    return (
      <div style={frame} aria-hidden>
        <span style={{ fontFamily: F.title, fontSize: size * 0.38, color: alpha(C.ink, 0.35) }}>
          {initialsOf(name)}
        </span>
      </div>
    );

  return (
    <div style={frame}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(name)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
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
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [roles, setRoles] = useState<KinshipRole[]>([]);
  const [all, setTous] = useState(false);
  const [sort, setSort] = useState<SortKey>("films");
  /* CE QU'ON MONTRE AVANT QU'ON EN DEMANDE PLUS.

     UNE COLLECTION BIEN FOURNIE PORTE DES MILLIERS DE NOMS, et cette
     page en dessinait autant de cartes : une carte est un bouton, une
     punaise, une inclinaison semée et deux survols qui réécrivent une
     transformation. À trois mille, l'onglet met une seconde à répondre
     et le champ de recherche saute une lettre sur deux.

     La page arrive donc RÉDUITE, et on en demande plus. Ce n'est pas
     une pagination — il n'y a ni page suivante ni numéros — c'est un
     seuil qu'on repousse, et il repart à sa valeur dès qu'on change de
     tri, de rôle ou de recherche : ce qu'on vient de demander est
     toujours en tête. */
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    let out = people;
    if (roles.length) out = out.filter((p) => roles.some((r) => p.roles.includes(r)));
    /* The threshold does NOT apply to a search: one types a name
       because one is looking for somebody in particular, and not finding
       them because they have only one film would be the opposite of
       searching. */
    if (q.trim()) out = searchPeople(out, q);
    else if (!all) out = out.filter(isRegular);
    return sortPeople(out, sort);
  }, [people, q, roles, all, sort]);

  /* Le seuil repart en tête à chaque changement de cadrage. Le faire
     dans le rendu plutôt que dans un effet évite un rendu intermédiaire
     où l'on montrerait mille noms avant de retomber à soixante. */
  const cadre = `${q}|${roles.join()}|${all}|${sort}`;
  const [lastCadre, setLastCadre] = useState(cadre);
  if (cadre !== lastCadre) {
    setLastCadre(cadre);
    setShown(PAGE);
  }

  const visible = useMemo(() => list.slice(0, shown), [list, shown]);
  const hiddenCount = people.length - people.filter(isRegular).length;

  return (
    <div style={{ padding: "34px 44px 70px", position: "relative" }}>
      <StampCorner text={t("credits.stamp")} />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 42,
          color: C.ink,
        }}
      >
        {t("views.credits")}
      </div>
      <Guideline>{t("credits.intro", { count: people.length })}</Guideline>

      {unknown && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.burgundy, marginBottom: 10 }}>
          {t("credits.gone")}
        </div>
      )}

      <WhoCounts people={people} onOuvrir={onOuvrir} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
        <Search size={15} color={C.inkFaded} />
        <input
          data-tour="credits-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("credits.namePlaceholder")}
          style={{ ...underlineInput, fontFamily: F.body, fontSize: 16, width: 260 }}
        />

        {/* LE TRI, EN PASTILLES ET NON EN LISTE DÉROULANTE. Quatre
            choix : une liste fermée cacherait les trois qu'on ne
            regarde pas, et c'est précisément en LES VOYANT qu'on
            découvre qu'on peut trier par note. */}
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.inkFaded,
          }}
        >
          {t("credits.sortBy")}
        </span>
        <div data-tour="credits-sort" style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {SORT_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              aria-pressed={sort === k}
              style={chipLook(sort === k, C.plum)}
            >
              {t(`credits.sort.${k}`)}
            </button>
          ))}
        </div>
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
              {t(`roles.${r}`)}
            </button>
          );
        })}
        {!q.trim() && hiddenCount > 0 && (
          <button onClick={() => setTous((t) => !t)} style={chipLook(all, C.slate)}>
            {all ? t("credits.regularsOnly") : t("credits.passingThrough", { count: hiddenCount })}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        /* "Nobody of that name" under a sieve would be a lie: nobody
           has been named. Each way of emptying the list has its own
           sentence, and the threshold's says where the others went. */
        <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded }}>
          {people.length === 0
            ? t("credits.noNames")
            : q.trim()
              ? t("credits.nobodyByThatName")
              : hiddenCount > 0
                ? t("credits.nobodyAmongRegulars")
                : t("credits.nobodyInThatRole")}
        </div>
      ) : null}

      {/* CE QUI REMPLIT LE RÉPERTOIRE, DIT LÀ OÙ IL EST VIDE.

          « Aucun nom » était vrai et sans issue. Ce répertoire ne se
          remplit pas tout seul : une fiche importée d'ailleurs ne porte
          souvent QUE le réalisateur, et l'interprétation, l'image, la
          musique arrivent en complétant par TMDB. Un générique à un seul
          nom n'est donc pas un défaut de la page — c'est ce que les
          fiches contiennent, et personne ne pouvait le deviner depuis
          cet écran.

          Le seuil est nommé au passage : deux noms cachés derrière une
          règle qu'on ne voit pas, c'est une page qu'on croit cassée. */}
      {list.length <= 1 && !q.trim() && roles.length === 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            border: `1px dashed ${alpha(C.plum, 0.5)}`,
            background: alpha(C.plum, 0.05),
            fontFamily: F.hand,
            fontSize: 17,
            color: C.ink,
            maxWidth: 560,
          }}
        >
          <div>{t("credits.howItFills")}</div>
          {hiddenCount > 0 && !all && (
            <button
              onClick={() => setTous(true)}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginTop: 6,
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: C.plum,
                borderBottom: `1px dotted ${alpha(C.plum, 0.6)}`,
              }}
            >
              {t("credits.showHidden", { count: hiddenCount })}
            </button>
          )}
        </div>
      )}

      {/* CE QU'ON MONTRE, SUR CE QU'IL Y A. Le chiffre est là pour que
          « en voir plus » ne ressemble pas à une page suivante : on dit
          où l'on en est d'une seule liste. */}
      {list.length > visible.length && (
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 9.5,
            letterSpacing: 0.8,
            color: C.inkFaded,
            marginBottom: 8,
          }}
        >
          {t("credits.showing", { shown: visible.length, total: list.length })}
        </div>
      )}

      {list.length > 0 && (
        <div
          data-tour="credits-list"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {visible.map((p) => (
            <Card key={p.key} p={p} onClick={() => onOuvrir(p.key)} />
          ))}
        </div>
      )}

      {list.length > visible.length && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            display: "block",
            margin: "16px auto 0",
            padding: "6px 16px",
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.plum,
            border: `1px solid ${alpha(C.plum, 0.5)}`,
          }}
        >
          {t("credits.more", { count: Math.min(PAGE, list.length - visible.length) })}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   SAUTER À QUELQU'UN, SANS RESSORTIR
   ============================================================

   LA RECHERCHE N'EXISTAIT QUE SUR LE RÉPERTOIRE. On ouvrait une fiche
   avec un autre nom déjà en tête — c'est même le cas ordinaire, on lit
   « avec Un Tel » et on veut voir Un Tel — et il fallait revenir à la
   liste, retrouver le champ, retaper.

   ELLE RÉPOND EN LISTE ET NON EN PAGE. Un champ qui n'ouvre qu'en
   validant demande de connaître l'orthographe exacte ; ces cinq lignes
   sous le champ montrent ce qu'on va ouvrir avant qu'on l'ouvre, ce qui
   est aussi la seule façon de rattraper un accent qu'on ne sait pas
   mettre. `searchPeople` est le même tamis que le répertoire — deux
   recherches qui ne trouvent pas la même chose seraient deux produits.

   ELLE SE REFERME SUR CHOIX ET SUR ÉCHAPPEMENT, et elle est repliée par
   défaut : cette page parle d'une personne, pas d'un moteur.
   ============================================================ */
function Jump({ people, onOuvrir }: { people: Person[]; onOuvrir: (key: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const hits = q.trim() ? searchPeople(people, q).slice(0, 5) : [];

  return (
    <div style={{ position: "relative", maxWidth: 420, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={14} color={C.inkFaded} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
            /* Entrée ouvre le premier de la liste : c'est ce qu'on
               regarde en tapant, donc c'est ce qu'on attend. */
            if (e.key === "Enter" && hits[0]) {
              onOuvrir(hits[0].key);
              setQ("");
            }
          }}
          placeholder={t("credits.jumpPlaceholder")}
          aria-label={t("credits.jumpPlaceholder")}
          style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16 }}
        />
      </div>

      {q.trim() && (
        <div style={{ marginTop: 4 }}>
          {hits.length === 0 ? (
            <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
              {t("credits.nobodyByThatName")}
            </div>
          ) : (
            hits.map((h) => (
              <button
                key={h.key}
                onClick={() => {
                  onOuvrir(h.key);
                  setQ("");
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  display: "block",
                  width: "100%",
                  padding: "3px 2px",
                  fontFamily: F.body,
                  fontSize: 14,
                  color: C.ink,
                  borderBottom: `1px dotted ${alpha(C.line, 0.8)}`,
                }}
              >
                {h.name}{" "}
                <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                  {h.films.length}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   WHO COUNTS — the head of the directory

   The grid below answers "have you got any X", which one only asks
   having already got the name in mind. Arriving with no name in mind,
   the tab said nothing at all: a wall of a thousand strangers sorted by
   how well furnished they are. These three rows say who is in there.

   Each row goes out on its own when the collection does not carry it
   (`standouts` returns it empty rather than short), and the whole head
   goes with them — a heading followed by nothing is worse than no
   heading. */
function WhoCounts({ people, onOuvrir }: { people: Person[]; onOuvrir: (key: string) => void }) {
  const { t } = useTranslation();
  const { loyal, loved, newcomers } = useMemo(() => standouts(people), [people]);
  const rows = [
    { key: "loyalties", people: loyal },
    { key: "loved", people: loved },
    { key: "newcomers", people: newcomers },
  ].filter((r) => r.people.length > 0);

  if (rows.length === 0) return null;

  return (
    <div data-tour="credits-standouts" style={{ marginTop: 16 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ marginBottom: 14 }}>
          <Label>{t(`credits.${r.key}`)}</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {r.people.map((p) => (
              <Badge key={p.key} p={p} onClick={() => onOuvrir(p.key)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A name of the head: the face, the name, and what one has of them. */
function Badge({ p, onClick }: { p: Person; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      aria-label={`${p.name} — ${t("credits.filmCount", { count: p.films.length })}`}
      style={{
        all: "unset",
        ...tap,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 2,
        padding: "6px 12px 6px 7px",
        boxShadow: "1px 1px 4px rgba(0,0,0,0.10)",
        transition: "transform var(--motion-fast) var(--motion-ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
      }}
    >
      <Portrait name={p.name} size={34} />
      <span>
        <span
          style={{
            display: "block",
            fontFamily: F.title,
            fontWeight: 700,
            fontSize: 14.5,
            color: C.ink,
          }}
        >
          {p.name}
        </span>
        <span style={{ display: "block", fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
          {t("credits.filmCount", { count: p.films.length })}
          {p.rating != null ? ` · ${p.rating.toFixed(1)}` : ""}
        </span>
      </span>
    </button>
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
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      /* The name is written in the card, but in three pieces: without
         this label, the card announces itself as "button" and nothing
         more. */
      aria-label={`${p.name} — ${t("credits.filmCount", { count: p.films.length })}`}
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
          .map((r) => t(`roles.${r}`))
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
        <span>{t("credits.filmCount", { count: p.films.length })}</span>
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
  people,
  films,
  onRetour,
  onOpen,
  onOpenPerson,
  onAddToWatchlist,
}: {
  p: Person;
  /** Tout le répertoire, dans son ordre : c'est lui qui fait les voisins. */
  people: Person[];
  films: Film[];
  onRetour: () => void;
  onOpen: (id: string) => void;
  onOpenPerson: (key: string) => void;
  onAddToWatchlist: (f: Film) => void;
}) {
  const { t } = useTranslation();
  const perId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);
  const theirs = p.films.map((id) => perId.get(id)).filter(Boolean) as Film[];
  const seenFilms = theirs.filter((f) => f.status === "watched");
  const wishlist = theirs.filter((f) => f.status === "watchlist");
  const apiKey = useTmdbKey();
  const mine = useMemo(() => averageRating(films), [films]);
  const met = useMemo(() => companions(films, p.key), [films, p.key]);

  /* OÙ L'ON EST DANS LE RÉPERTOIRE. Les bords ne bouclent pas : arriver
     au dernier et retomber sur le premier donne l'impression de tourner
     en rond sans qu'on sache qu'on a fait le tour. Un bouton absent le
     dit mieux. */
  const at = people.findIndex((x) => x.key === p.key);
  const before = at > 0 ? people[at - 1] : null;
  const after = at >= 0 && at < people.length - 1 ? people[at + 1] : null;

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 1000, position: "relative" }}>
      {/* LA BARRE DE NAVIGATION, ET C'EST TOUT CE QUI MANQUAIT À CETTE
          PAGE. Le retour, les deux voisins nommés — un bouton qui dit
          « suivant » sans dire QUI ne donne aucune raison de le presser
          —, et la recherche, qui n'existait que sur le répertoire : on
          entrait ici avec un nom en tête et il fallait ressortir pour le
          taper. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <button onClick={onRetour} style={back}>
          <ArrowLeft size={13} /> {t("credits.backToCredits")}
        </button>

        <span style={{ flex: 1 }} />

        {before && (
          <button
            onClick={() => onOpenPerson(before.key)}
            title={before.name}
            style={{ ...back, marginBottom: 0 }}
          >
            <ChevronLeft size={13} /> {before.name}
          </button>
        )}
        {after && (
          <button
            onClick={() => onOpenPerson(after.key)}
            title={after.name}
            style={{ ...back, marginBottom: 0 }}
          >
            {after.name} <ChevronRight size={13} />
          </button>
        )}
      </div>

      <Jump people={people} onOuvrir={onOpenPerson} />

      {/* The face takes the icon's place when there is one to show: two
          round marks side by side say the same thing twice. Without a
          TMDB key `Portrait` renders nothing, and the heading would
          have lost its mark — so the icon stays the fallback. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {apiKey ? <Portrait name={p.name} size={52} /> : <Users size={22} color={C.plum} />}
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
        {t("credits.personIntro", {
          roles: p.roles.map((r) => t(`roles.${r}`)).join(", "),
          count: p.films.length,
        })}
        {p.toWatch > 0 ? t("credits.ofWhichWaiting", { count: p.toWatch }) : ""}.
      </Guideline>

      <Cardstock tour="credits-page" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
          <Figure name={t("credits.yourRating")}>
            {p.rating != null ? (
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {p.rating.toFixed(1)}
                <InkStars value={p.rating} size={13} />
              </span>
            ) : (
              "—"
            )}
          </Figure>
          {/* THE GAP THAT WAS MISSING. The one beside it measures against
              the crowd; this one measures against ONESELF, which is the
              comparison one actually makes. Four out of five means two
              different things depending on whether one usually gives
              four or usually gives two. Same words, same colours as its
              neighbour: two gaps read in two ways would be two riddles.
              BROUGHT ONTO TEN, like its neighbour: side by side, "0.4"
              and "0.8" for the same distance would be unreadable. */}
          <Figure name={t("credits.gapToYou")}>
            {readableGap(
              p.rating != null && mine != null ? (p.rating - mine) * 2 : null,
              t,
              "ToYou"
            )}
          </Figure>
          <Figure name={t("credits.gapToPublic")}>{readableGap(p.gap, t)}</Figure>
          <Figure name={t("almanac.viewings")}>{p.screenings || "—"}</Figure>
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
            <Label>{t("credits.whatRecurs")}</Label>
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

      {/* THE WAY OUT OF THE FOLDER.

          One arrives here from a card, from the search or from the
          almanac, and one left by a film or by the back button: a page
          about people from which no person could be reached. A
          film-maker's regular cinematographer, an actor's usual
          director — the collection knew them and never said so.

          The ranking is drawn by `Honours`, which already draws the
          almanac's loyalties: the same question, and two nearly
          identical rankings would have parted company at the third
          change. */}
      {met.length > 0 && (
        <div style={{ marginTop: 24 }} data-tour="credits-companions">
          <Label>{t("credits.companions")}</Label>
          <div style={{ maxWidth: 420 }}>
            <Honours
              items={met.map((c) => ({ name: c.name, n: c.n }))}
              total={p.films.length}
              ink={C.plum}
              empty={t("credits.noCompanion")}
              onPick={(name) => onOpenPerson(met.find((c) => c.name === name)!.key)}
              pickTitle={(name) => t("credits.whatIHaveOf", { name })}
            />
          </div>
        </div>
      )}

      {/* `key` is React's, and React eats it: named so, the prop never
          reached the component, `rolesOnFilm` was asked about `undefined`
          and no poster ever carried the capacity it was here under. */}
      <Shelf title={t("credits.seen")} films={seenFilms} personKey={p.key} onOpen={onOpen} />
      <Shelf title={t("credits.waiting")} films={wishlist} personKey={p.key} onOpen={onOpen} />

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
   remember which way round the subtraction was done.

   `against` picks which of the two comparisons is being read — the crowd
   or one's own average. The three sentences differ in each case ("you
   agree with the public" and "as you rate everything else" are not the
   same remark), the reading does not: same threshold, same colours,
   same shape. */
function readableGap(
  gap: number | null,
  t: (k: string, v?: Record<string, string>) => string,
  against: "" | "ToYou" = ""
) {
  if (gap == null) return "—";
  const v = Math.abs(gap).toFixed(1);
  if (Math.abs(gap) < 0.15)
    return <span style={{ fontSize: 19 }}>{t(`credits.inAgreement${against}`)}</span>;
  return (
    <span style={{ fontSize: 19, color: gap > 0 ? C.moss : C.vermillion }}>
      {t(gap > 0 ? `credits.gentlerBy${against}` : `credits.harsherBy${against}`, { points: v })}
    </span>
  );
}

function Shelf({
  title,
  films,
  personKey,
  onOpen,
}: {
  title: string;
  films: Film[];
  personKey: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (films.length === 0) return null;
  return (
    <div style={{ marginTop: 26 }}>
      <SectionTitle>
        {title} ({films.length})
      </SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        {films.map((f) => {
          const roles = rolesOnFilm(f, personKey);
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
                {roles.length > 1 ? ` · ${roles.map((r) => t(`roles.${r}`)).join(", ")}` : ""}
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
  const { t } = useTranslation();
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
        setMsg(t("credits.tmdbNobody"));
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
          ? t("credits.missingCount", { count: rest.length })
          : t("credits.nothingMissing")
      );
    } catch (e) {
      setState("repos");
      setMsg(t("credits.tmdbDown", { error: (e as Error).message }));
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
            {state === "en-cours" ? <Loader2 size={11} /> : <Download size={11} />}{" "}
            {t("credits.askTmdb")}
          </button>
        }
      >
        {t("credits.whatIsMissing")}
      </SectionTitle>
      <Guideline>{t("credits.missingNote")}</Guideline>

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
                {c.year || t("credits.yearUnknown")}
                {c.voteAverage ? ` · ${c.voteAverage.toFixed(1)}/10` : ""}
              </div>
              <button
                onClick={() => add(c)}
                disabled={inside}
                style={{ ...chipLook(inside, C.ochre), cursor: inside ? "default" : "pointer" }}
              >
                {inside ? t("credits.inWatchlist") : t("credits.addToWatchlist")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
