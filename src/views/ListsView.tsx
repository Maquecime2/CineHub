/* ============================================================
   THE LISTS AND THE CHALLENGES
   ============================================================

   A LIST CONTAINS WORKS, NOT CARDS. A list of cards would be the list of
   somebody's own copies: it would mean nothing at somebody else's, and
   would empty itself the day its author erased a card. So we file films
   in it by their TMDB identifier — hence the gesture, which starts from
   the card and not from here.

   A CHALLENGE IS A LIST PLUS A PERIOD, and the progress is COMPUTED:
   nobody ticks "seen", the binder already knows. That is also why one
   must ask to take part — we do not measure the log of people who asked
   for nothing.

   THIS VIEW SHOWS NOTHING WITHOUT AN ACCOUNT, and says so in one
   sentence rather than offer dead buttons.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { ListChecks, Plus, Trash2, UserPlus, X } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { bare, chip, hollow, inked, tap, underlineInput } from "../theme/styles";
import { FilmPicker } from "../components/film/FilmPicker";
import { FilmQuickView } from "../components/film/FilmQuickView";
import { normalize } from "../domain/search";
import type { Film } from "../types";
import { CriterionComposer } from "./lists/CriterionComposer";
import { currentMonth } from "./lists/shared";
import { Guideline, Label, Meter, Trouble, ViewHeading, Waiting } from "../components/ui";
import { StampCorner, TapeResidue } from "../components/atmosphere";
import { Halftone } from "../components/atmosphere/hall";
import { daysLeft, mayExtend, needsSettling, stateOf } from "../domain/challenges";
import { worthOfChallenge } from "../domain/points";
import { tiltOf } from "../domain/seeded";
import { refreshPurse } from "../hooks/usePurse";
import { useShop } from "../hooks/useShop";
import { BuyChip } from "../components/play/Buy";
import { Confirmation, type ConfirmRequest } from "../components/ui/Confirmation";
import {
  createList,
  createChallenge,
  deleteList,
  deleteChallenge,
  inviteToList,
  inviteToChallenge,
  readList,
  readChallenge,
  leaveChallenge,
  joinChallenge,
  removeFromListMembers,
  removeFromList,
  addToList,
  editList,
  extendChallenge,
  secondWind,
  settleChallenge,
  serverConfigured,
  type Progress,
  type Challenge,
  type List,
  type ListWork,
} from "../services/server";
import { refreshLists, loadLists } from "../hooks/useMyLists";
import { challenges as challengeBoard } from "../hooks/useHall";
import { HallWindow } from "../components/layout/HallWindow";

/* CE QUE LE CRITÈRE DEMANDE, EN TOUTES LETTRES. Un défi qui dirait
   seulement « par critère » obligerait à l'ouvrir pour savoir ce qu'il
   demande, alors que c'est la seule chose qui le distingue des autres.
   Le `subject` vient du serveur et ne porte qu'une des trois clés. */
function sayCriterion(
  t: (k: string, o?: Record<string, unknown>) => string,
  subject: Challenge["subject"]
): string {
  if (subject?.decade != null) return t("listsView.criterionSays.decade", { n: subject.decade });
  if (subject?.country) return t("listsView.criterionSays.country", { code: subject.country });
  if (subject?.director) return t("listsView.criterionSays.director", { name: subject.director });
  return t("listsView.criterionSays.unknown");
}

export function ListsView({
  connected,
  films,
  onUpdateFilm,
  onOpen,
  onOpenPerson,
}: {
  connected: boolean;
  /* LE CLASSEUR, POUR CHERCHER DEDANS. Remplir une liste ne demandait
     que TMDB, donc ranger un film qu'on possède déjà obligeait à le
     retaper et à le retrouver parmi des homonymes — alors qu'il est là,
     avec son affiche et son réalisateur. C'est ce que les filiations
     font depuis toujours. */
  films: Film[];
  onUpdateFilm: (film: Film) => void;
  onOpen: (id: string) => void;
  onOpenPerson: (name: string) => void;
}) {
  const { t } = useTranslation();
  /* La vue rapide est tenue ICI et non dans le sélecteur : c'est une
     couche, et elle survit au repli de la liste qui l'a ouverte. */
  const [quick, setQuick] = useState<Film | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  /* « PAS ENCORE » N'EST PAS « AUCUN ». Cette vue partait de deux
     tableaux vides et affichait donc ses phrases de vide PENDANT que la
     requête était en vol : sur une connexion lente, on lisait « vous
     n'avez aucune liste » alors qu'on en a douze. */
  const [settled, setSettled] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  /* CE QUI A RATÉ EN OUVRANT LA PAGE. Distinct de `settled` : « on a
     fini de demander » et « on a obtenu quelque chose » sont deux
     phrases différentes, et les confondre annonçait « aucune liste » à
     quelqu'un dont la requête venait d'être refusée. */
  const [trouble, setTrouble] = useState<string | null>(null);

  /* THROUGH THE SHARED STORE, NOT AROUND IT. This view held its own
     copy of "my lists" and the badges on the wall held another: a list
     opened here did not appear under a poster until something else
     happened to refresh them, and one that was erased here went on being
     offered. Two sources of truth for one question is one too many —
     `refreshLists` reads the server and tells everybody. */
  /* `null` est la réponse d'un serveur qui se tait, pas une liste de
     listes : à l'écran, c'est la même chose qu'aucune. */
  const show = useCallback((l: List[] | null, d: Challenge[]) => {
    setLists(l ?? []);
    setChallenges(d);
    setSettled(true);
  }, []);

  const reread = useCallback(async () => {
    if (!connected) return;
    const [l, d] = await Promise.all([refreshLists(), challengeBoard.refresh()]);
    show(l, d);
  }, [connected, show]);

  /* Servi de mémoire à l'entrée, redemandé après un geste : voir
     `hooks/useHall`. */
  useEffect(() => {
    if (!connected) return;
    Promise.all([loadLists(), challengeBoard.load()])
      .then(([l, d]) => show(l, d))
      /* `settled` passait à vrai même en cas d'échec, donc l'écran
         annonçait « aucune liste » à quelqu'un dont la requête venait
         d'être refusée. On distingue les deux maintenant. */
      .catch((e: Error) => {
        setSettled(true);
        setTrouble(e.message);
      });
  }, [connected, show]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline tight>{t("listsView.noServer")}</Guideline>
      </Page>
    );
  }

  /* LA VITRINE, ET NON UNE PHRASE. Les quatre guichets répondaient
     chacun « il faut un compte — le bouton au pied du rail », ce qui
     donne un itinéraire sans rien dire de ce qu'il y a derrière. Voir
     `HallWindow` pour ce qu'elle montre, et surtout pour ce qu'elle se
     refuse à montrer. */
  if (!connected) {
    return (
      <Page>
        <HallWindow />
      </Page>
    );
  }

  const openOne = async () => {
    const name = title.trim();
    if (!name) return;
    const { id } = await createList({ title: name });
    setTitle("");
    await reread();
    setOpened(id);
  };

  return (
    <Page>
      <div data-tour="lists-new" style={{ maxWidth: 460, marginBottom: 28 }}>
        <Label>{t("listsView.newList")}</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && openOne()}
            placeholder={t("listsView.newListPlaceholder")}
            style={{ ...underlineInput, fontFamily: F.hand, fontSize: 17 }}
          />
          <button onClick={openOne} style={inked(C.ink)}>
            <Plus size={12} /> {t("listsView.open")}
          </button>
        </div>
        {/* The gesture of filling a list starts from the CARD: that is
            where one has the film in front of one's eyes, and its work
            identifier. */}
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
          {t("listsView.fillNote")}
        </div>
      </div>

      <div data-tour="lists-mine" style={{ marginBottom: 34 }}>
        <Label>{t("listsView.yours")}</Label>
        {!settled && <Waiting label={t("listsView.loading")} />}
        {trouble && <Trouble>{trouble}</Trouble>}
        {settled && !trouble && lists.length === 0 && (
          <Guideline tight>{t("listsView.none")}</Guideline>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {lists.map((l) => (
            <OneList
              key={l.id}
              list={l}
              opened={opened === l.id}
              onToggle={() => setOpened(opened === l.id ? null : l.id)}
              onChange={reread}
              films={films}
              onLook={setQuick}
            />
          ))}
        </div>
      </div>

      <div data-tour="lists-challenges">
        <Label>{t("listsView.challenges")}</Label>
        {!settled && <Waiting lines={2} label={t("listsView.loading")} />}
        {settled && challenges.length === 0 && (
          <Guideline tight>{t("listsView.noChallenges")}</Guideline>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {challenges.map((d) => (
            <OneChallenge key={d.id} challenge={d} onChange={reread} />
          ))}
        </div>
        {/* LES DEUX AUTRES NATURES NAISSENT DANS UNE LISTE — c'est la
            liste qui pose la question, et leur formulaire vit sous elle.
            Un défi par critère n'a pas de liste : sa porte est donc ici,
            à côté des défis et non dans l'une d'elles. */}
        <CriterionComposer onChange={reread} />
      </div>

      {/* LA MÊME COUCHE QU'AILLEURS. Décider qu'un film a sa place dans
          une liste sur un titre et une année seulement était le défaut
          que la vue rapide a été écrite pour retirer — aux filiations,
          au générique, à la reco. Il restait ici. */}
      {quick && (
        <FilmQuickView
          film={quick}
          inBinder={films.some((f) => f.id === quick.id)}
          onEnrich={onUpdateFilm}
          onOpenPerson={(name) => onOpenPerson(normalize(name))}
          onOpenFilm={
            films.some((f) => f.id === quick.id)
              ? () => {
                  setQuick(null);
                  onOpen(quick.id);
                }
              : undefined
          }
          onClose={() => setQuick(null)}
        />
      )}
    </Page>
  );
}

/* ------------------------------------------------------------
   ONE LIST, UNFOLDED
   ------------------------------------------------------------ */

function OneList({
  list,
  opened,
  onToggle,
  onChange,
  films,
  onLook,
}: {
  list: List;
  opened: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
  films: Film[];
  onLook: (film: Film) => void;
}) {
  const { t } = useTranslation();
  const [works, setWorks] = useState<ListWork[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [invite, setInvitee] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [challenge, setDraft] = useState({
    title: "",
    start: currentMonth().start,
    end: currentMonth().end,
    /* VIDE VEUT DIRE « TOUTE LA LISTE », et c'est le défaut. Une chaîne
       et non un nombre : le champ doit pouvoir être vidé, et `0` n'est
       pas « rien ». */
    target: "",
    /* La nature de ce qui comptera. « liste » est le défaut, et il le
       reste : une nature change CE QUI COMPTE, jamais ce que ça paie. */
    kind: "liste",
  });

  const reread = useCallback(async () => {
    const r = await readList(list.id);
    setWorks(r.works);
    setMembers(r.members);
  }, [list.id]);

  useEffect(() => {
    if (opened) reread().catch(() => {});
  }, [opened, reread]);

  const sendInvite = async () => {
    const name = invite.trim().toLowerCase();
    if (!name) return;
    setTrouble(null);
    try {
      await inviteToList(list.id, name);
      setInvitee("");
      await reread();
    } catch {
      /* The server answers the same thing for "does not exist" and "you
         two have blocked each other": we take up that silence. */
      setTrouble(t("listsView.nobodyToInvite", { pseudo: name }));
    }
  };

  const run = async () => {
    if (!challenge.title.trim()) return;
    await createChallenge({
      listId: list.id,
      title: challenge.title.trim(),
      starts_on: challenge.start,
      ends_on: challenge.end,
      target: challenge.target.trim() ? Number(challenge.target) : null,
      kind: challenge.kind,
    });
    setDraft({ ...challenge, title: "" });
    await onChange();
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <button
        onClick={onToggle}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
        }}
      >
        <span style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 20, color: C.ink }}>
          {list.title}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {list.works} film{list.works > 1 ? "s" : ""}
          {list.is_public ? ` · ${t("listsView.public")}` : ""}
          {list.mienne ? "" : ` · ${t("listsView.at", { pseudo: list.owner })}`}
        </span>
      </button>

      {opened && (
        <div style={{ padding: "0 12px 14px" }}>
          {works.length === 0 && <Guideline tight>{t("lists.searchNote")}</Guideline>}
          {works.map((o) => (
            <div
              key={o.tmdb_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
                borderBottom: `1px dashed ${alpha(C.line, 0.6)}`,
              }}
            >
              <span style={{ fontFamily: F.title, fontSize: 15, color: C.ink, flex: 1 }}>
                {o.title || `TMDB ${o.tmdb_id}`}
                {o.year ? (
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                    {" "}
                    {o.year}
                  </span>
                ) : null}
              </span>
              {/* Who put it there: in a list written by six hands, it
                  is the only thing one wants to know about a row. */}
              {o.by && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{o.by}</span>
              )}
              <button
                onClick={() => removeFromList(list.id, o.tmdb_id).then(reread)}
                title={t("listsView.removeWork")}
                style={{ ...bare, color: C.burgundy }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          <FillFromTmdb list={list} works={works} films={films} onLook={onLook} onFiled={reread} />

          {/* Co-building is a right to write, not ownership: only the
              owner invites, renames and publishes. */}
          {list.mienne && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 14 }}>
                <input
                  value={invite}
                  onChange={(e) => setInvitee(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  placeholder={t("listsView.inviteSomebody")}
                  autoCapitalize="none"
                  spellCheck={false}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                />
                <button onClick={sendInvite} style={inked(C.pine)}>
                  <UserPlus size={12} /> {t("listsView.invite")}
                </button>
              </div>
              {trouble && (
                <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 4 }}>
                  {trouble}
                </div>
              )}
              {members.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {members.map((m) => (
                    <span key={m} style={chip}>
                      {m}
                      <button
                        onClick={() => removeFromListMembers(list.id, m).then(reread)}
                        title={t("listsView.removeMember", { pseudo: m })}
                        style={{ ...bare, color: C.burgundy }}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                <label style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                  <input
                    type="checkbox"
                    checked={list.is_public}
                    onChange={(e) =>
                      editList(list.id, { is_public: e.target.checked }).then(onChange)
                    }
                  />{" "}
                  {t("listsView.publicNote")}
                </label>
                <span style={{ flex: 1 }} />
                <button
                  /* UNE LISTE EST PARTAGÉE : la supprimer ne retire pas
                     seulement la sienne, elle la retire à ceux qu'on y a
                     invités. Et il n'y a rien à annuler derrière. */
                  onClick={() =>
                    setRequest({
                      title: t("listsView.confirmListTitle"),
                      body: t("listsView.confirmListBody", { title: list.title }),
                      action: t("common.delete"),
                      severe: true,
                      onConfirm: () => void deleteList(list.id).then(onChange),
                    })
                  }
                  title={t("listsView.deleteList")}
                  style={{ ...bare, color: C.burgundy }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}

          {/* Starting a challenge requires the right to write in the
              list — otherwise anybody starts a challenge on a stranger's
              list, who would see it appear without having wanted it. */}
          {(list.mienne || list.isMember) && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${C.line}` }}>
              <Label>{t("listsView.startChallenge")}</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input
                  value={challenge.title}
                  onChange={(e) => setDraft({ ...challenge, title: e.target.value })}
                  placeholder={t("listsView.challengePlaceholder")}
                  style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, flex: "1 1 160px" }}
                />
                <input
                  type="date"
                  value={challenge.start}
                  onChange={(e) => setDraft({ ...challenge, start: e.target.value })}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
                />
                <input
                  type="date"
                  value={challenge.end}
                  onChange={(e) => setDraft({ ...challenge, end: e.target.value })}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
                />
                {/* UNE LISTE DE QUARANTE FILMS NE SE FINIT PAS EN UN
                    MOIS : le défi ne payait personne et se lisait comme
                    cassé. La cible en fait une intention tenable sans
                    toucher à la liste, qui appartient à quelqu'un et
                    sert peut-être à autre chose. */}
                {/* DEUX NATURES, ET LA SECONDE DEMANDE D'ÉCRIRE. « Vu »
                    ne suffit plus : il faut une séance dans la période ET
                    une critique. On ne peut pas se fier à la date de la
                    fiche — une critique n'en porte pas, et `updated_at`
                    bouge à la moindre retouche. */}
                {(["liste", "critique"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setDraft({ ...challenge, kind: k })}
                    style={challenge.kind === k ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
                  >
                    {t(`listsView.kind.${k}`)}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={challenge.target}
                  onChange={(e) => setDraft({ ...challenge, target: e.target.value })}
                  placeholder={t("listsView.targetPlaceholder")}
                  aria-label={t("listsView.targetLabel")}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 78 }}
                />
                <button onClick={run} style={inked(C.burgundy)}>
                  {t("listsView.launch")}
                </button>
              </div>
              {challenge.kind === "critique" && (
                <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
                  {t("listsView.kindNote")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </div>
  );
}

/* ============================================================
   FILLING A LIST FROM TMDB
   ============================================================

   The old note here said that filling a list from this view would have
   meant rebuilding a whole TMDB search in a place where there is nothing
   to look at, and that the gesture therefore belonged to the card. Half
   of that is still true — a card is the best place to file the film one
   is reading about — but the conclusion no longer holds, for a reason
   that has nothing to do with taste:

   A LIST CAN HOLD A FILM THE BINDER DOES NOT. That is the whole point of
   holding works rather than copies. "Come and see this in March" is
   said about films one has not got; from the card alone, those were
   precisely the ones that could never be proposed.

   And the search costs little: the server already relays TMDB, so
   somebody signed in needs no key of their own. */
function FillFromTmdb({
  list,
  works,
  films,
  onLook,
  onFiled,
}: {
  list: List;
  /** Ce que la liste tient déjà — pour ne pas proposer deux fois. */
  works: ListWork[];
  films: Film[];
  onLook: (film: Film) => void;
  onFiled: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [trouble, setTrouble] = useState<string | null>(null);

  /* One writes in a list one may write in. A stranger's public list is
     read here, not filled. */
  if (!list.mienne && !list.isMember) return null;

  /* CE QUE LA LISTE TIENT DÉJÀ, DIT SUR LES FICHES DU CLASSEUR. Le
     sélecteur marque ses lignes avec un jeu d'identifiants de FICHES ;
     une liste, elle, range des ŒUVRES par leur identité TMDB. La
     traduction se fait donc ici, et pas dans le sélecteur — qui n'a pas
     à connaître les listes. */
  const inList = new Set(
    films
      .filter((f) => f.tmdbId && works.some((w) => String(w.tmdb_id) === String(f.tmdbId)))
      .map((f) => f.id)
  );

  const fileIt = async (o: {
    tmdbId: number | string;
    title: string;
    year?: string | number | null;
  }) => {
    setTrouble(null);
    try {
      await addToList(list.id, {
        tmdbId: o.tmdbId,
        title: o.title,
        year: o.year == null || o.year === "" ? undefined : String(o.year),
      });
      await onFiled();
    } catch (e) {
      setTrouble((e as Error).message || t("lists.filingFailed"));
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <FilmPicker
        films={films}
        /* UNE FICHE DU CLASSEUR : elle part telle quelle, à condition
           d'avoir une identité TMDB. Une liste range des œuvres et non
           des copies, donc une fiche tapée à la main n'y entre pas — et
           on le DIT, là où le sélecteur l'aurait rangée en silence. */
        onPick={(film) => {
          if (!film.tmdbId) {
            setTrouble(t("lists.noneFileable", { count: 1 }));
            return;
          }
          void fileIt({ tmdbId: film.tmdbId, title: film.title, year: film.year });
        }}
        /* ET CELLE QUE LE CLASSEUR N'A PAS : on la range dans la LISTE,
           et surtout pas dans la collection. Les filiations l'adoptent
           parce qu'un parcours est fait de fiches ; une liste tient des
           œuvres, et écrire une fiche chez quelqu'un qui a seulement dit
           « viens voir ça en mars » serait remplir son classeur à sa
           place. `FilmPicker` a déjà demandé `getDetails`, donc l'année
           qui arrive ici est celle de TMDB et non celle de l'aperçu. */
        onAdopt={(film) =>
          void fileIt({ tmdbId: film.tmdbId!, title: film.title, year: film.year })
        }
        onLook={onLook}
        inRun={inList}
        label={t("lists.search")}
        tour="lists-search"
      />
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
        {t("lists.searchNote")}
      </div>
      <Trouble>{trouble}</Trouble>
    </div>
  );
}

/* ------------------------------------------------------------
   ONE CHALLENGE, AND WHERE EVERYBODY STANDS
   ------------------------------------------------------------ */

function OneChallenge({
  challenge,
  onChange,
}: {
  challenge: Challenge;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [progress, setAvancement] = useState<Progress[] | null>(null);
  const [ends, setEnds] = useState(challenge.ends_on);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  /* CE QU'IL FALLAIT POUR DÉFIER QUELQU'UN : rien de plus qu'un champ.
     Jusqu'ici il fallait donner à la personne le droit d'ÉCRIRE dans la
     liste, ou rendre la liste publique et attendre qu'un abonné passe. */
  const [invite, setInvitee] = useState("");
  /* LE BUT, ET NON LA TAILLE DE LA LISTE. Une cible absente veut dire
     « toute la liste », ce qui est le cas de tout défi écrit avant
     qu'elle existe : `works` reste alors le dénominateur, et rien ne
     change pour eux. Le serveur compte de la même façon — il ne demande
     jamais plus de films que la liste n'en tient. */
  /* SANS LISTE, LE BUT EST LA CIBLE — et rien d'autre. `works` vaut zéro
     pour un défi par critère (il n'y a pas de `list_item` à compter),
     donc le `Math.min` d'origine aurait rendu un dénominateur de zéro :
     une barre sans bout et un défi impossible. Le serveur compte de la
     même façon, et c'est pour cette raison exacte que le schéma rend la
     cible obligatoire dès qu'il n'y a pas de liste. */
  const goal =
    challenge.list_id == null
      ? (challenge.target ?? 0)
      : Math.min(challenge.target ?? challenge.works, challenge.works);
  const [trouble, setTrouble] = useState<string | null>(null);

  const reread = useCallback(async () => {
    const r = await readChallenge(challenge.id);
    setAvancement(r.progress);
  }, [challenge.id]);

  useEffect(() => {
    reread().catch(() => setAvancement([]));
  }, [reread]);

  /* SOLDER À L'OUVERTURE, ET SANS RIEN ATTENDRE. Le serveur n'a pas de
     tâche de fond : c'est le PREMIER qui regarde un défi fini qui en
     clôt les comptes pour tout le monde, et la clé du journal fait que
     les suivants ne paient personne deux fois. L'échec est avalé — un
     défi qui s'affiche vaut mieux qu'un défi qui refuse de s'afficher
     parce que le compteur boude. */
  useEffect(() => {
    if (!needsSettling({ ends_on: ends })) return;
    settleChallenge(challenge.id)
      .then((r) => {
        if (r.awarded > 0) void refreshPurse();
      })
      .catch(() => {});
  }, [challenge.id, ends]);

  const catalogue = useShop();
  const sold = catalogue.find((i) => i.power === "extend");
  const powerHeld = sold?.held ?? 0;
  const canExtend = mayExtend(
    { starts_on: challenge.starts_on, ends_on: ends, by: challenge.by },
    challenge.by ?? null
  );

  const state = stateOf({ starts_on: challenge.starts_on, ends_on: ends });
  const left = daysLeft({ ends_on: ends });
  const done = progress?.find((p) => p.pseudo === challenge.by)?.done ?? 0;

  /* L'AFFICHE DIT SON ÉTAT AVANT DE DIRE SON TITRE. Un défi qui finit
     demain et un défi qui finit dans trois semaines ne se signalent pas
     de la même façon sur un panneau, et c'est la seule information qu'on
     lit de loin. */
  const BANNER: Record<string, { key: string; ink: string }> = {
    upcoming: { key: "listsView.upcoming", ink: C.slate },
    running: { key: "listsView.running", ink: C.pine },
    "last-days": { key: "listsView.lastDays", ink: C.vermillion },
    finished: { key: "listsView.finished", ink: C.inkFaded },
  };
  const banner = BANNER[state]!;

  const summon = async () => {
    const name = invite.trim().toLowerCase();
    if (!name) return;
    setTrouble(null);
    try {
      await inviteToChallenge(challenge.id, name);
      setInvitee("");
      await reread();
    } catch {
      /* Le serveur répond la même chose pour « n'existe pas » et « vous
         vous êtes bloqués » : on reprend ce silence, comme les listes. */
      setTrouble(t("listsView.nobodyToInvite", { pseudo: name }));
    }
  };

  const push = async () => {
    try {
      const r = await extendChallenge(challenge.id);
      setEnds(r.ends_on);
      await onChange();
    } catch {
      /* Le serveur porte les cinq limites dans une seule instruction :
         s'il refuse, il a raison, et il a rendu le pouvoir. */
      await onChange();
    }
  };

  return (
    <div
      data-print-block
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        padding: "11px 13px",
        boxShadow: "2px 3px 9px rgba(30,20,10,0.16)",
        transform: `rotate(${Number(tiltOf(challenge.id)) / 8}deg)`,
        /* Le liseré rouge des derniers jours : une bordure et non une
           couleur de fond, pour que le texte reste sur du papier. */
        outline: state === "last-days" ? `2px dashed ${alpha(C.vermillion, 0.6)}` : undefined,
        outlineOffset: 2,
      }}
    >
      <Halftone size={5} />
      <TapeResidue style={{ top: -8, left: 18 }} rotate={-14} w={64} />
      {/* Le rabat « soldé », en travers, une fois les comptes clos. */}
      {state === "finished" && <StampCorner text={t("listsView.settled")} />}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: C.card,
            background: banner.ink,
            padding: "3px 7px",
          }}
        >
          {t(banner.key)}
        </span>
        <span style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 20, color: C.ink }}>
          {challenge.title}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {challenge.starts_on} → {ends} ·{" "}
          {challenge.list_id == null
            ? t("listsView.criterionTarget", { count: goal })
            : challenge.target == null
              ? t("listsView.works", { count: challenge.works })
              : t("listsView.outOfList", { target: goal, works: challenge.works })}{" "}
          ·{" "}
          {challenge.list_id == null
            ? t("listsView.fromCriterion", { what: sayCriterion(t, challenge.subject) })
            : t("listsView.fromList", { title: challenge.list })}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() =>
            (challenge.inside ? leaveChallenge(challenge.id) : joinChallenge(challenge.id))
              .then(onChange)
              .then(reread)
          }
          style={inked(challenge.inside ? C.slate : C.pine)}
        >
          {challenge.inside ? t("listsView.leave") : t("listsView.join")}
        </button>
        {challenge.mine ? (
          <button
            /* Un défi mesure des gens : le retirer efface aussi ce que
               les autres y ont fait. */
            onClick={() =>
              setRequest({
                title: t("listsView.confirmChallengeTitle"),
                body: t("listsView.confirmChallengeBody", { title: challenge.title }),
                action: t("common.delete"),
                severe: true,
                onConfirm: () => void deleteChallenge(challenge.id).then(onChange),
              })
            }
            title={t("listsView.deleteChallenge")}
            style={{ ...bare, color: C.burgundy }}
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>

      {/* CE QUE ÇA VAUT, DIT PENDANT QUE ÇA COURT. Un chiffre qui tombe
          à la fin sans avoir prévenu ne récompense rien : on annonce le
          palier atteint et celui qui suit, tant qu'il reste des jours. */}
      {state !== "upcoming" && challenge.inside && (
        <div
          style={{
            position: "relative",
            fontFamily: F.hand,
            fontSize: 15,
            color: C.inkFaded,
            marginTop: 6,
          }}
        >
          {state === "finished"
            ? t("listsView.wasWorth", { points: worthOfChallenge(done, goal) })
            : t("listsView.worth", {
                points: worthOfChallenge(done, goal),
                count: Math.max(0, left),
              })}
        </div>
      )}

      {/* The progress leaves the log of screenings as a NUMBER only:
          the server counts, it does not copy out — and only counts
          people who have asked to take part. */}
      <div style={{ position: "relative", marginTop: 8 }}>
        {progress?.length === 0 && <Guideline tight>{t("listsView.noParticipants")}</Guideline>}
        {(progress ?? []).map((a) => (
          <Meter
            key={a.pseudo}
            name={a.pseudo}
            done={a.done}
            total={goal}
            ink={state === "finished" ? C.moss : C.burgundy}
          />
        ))}
      </div>

      {/* DÉFIER QUELQU'UN — et seulement pour qui a monté le défi. Un
          participant peut y entrer et en sortir ; il n'y engage personne
          d'autre. Le serveur le redit, la route exige `administer`. */}
      {challenge.mine && state !== "finished" && (
        <div style={{ position: "relative", marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={invite}
              onChange={(e) => setInvitee(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void summon();
                }
              }}
              placeholder={t("listsView.challengeSomebody")}
              aria-label={t("listsView.challengeSomebody")}
              style={{ ...underlineInput, flex: "1 1 160px", width: "auto" }}
            />
            <button onClick={() => void summon()} disabled={!invite.trim()} style={inked(C.pine)}>
              <UserPlus size={12} />
              {t("listsView.summon")}
            </button>
          </div>
          {trouble && <Trouble>{trouble}</Trouble>}
        </div>
      )}

      {/* PROLONGER : le bouton n'existe que si les cinq bornes le
          permettent — celles du client rejouent exactement celles de la
          requête SQL, pour ne pas offrir un geste qui coûte un pouvoir
          et se fait refuser. */}
      {/* PROLONGER — le pouvoir s'achète ICI s'il manque.

          C'est le seul moment où on le veut : devant un défi qui finit
          demain et qu'on n'a pas bouclé. Au comptoir, « prolonger un
          défi » est une ligne abstraite qu'on n'achète pas. */}
      {canExtend && powerHeld === 0 && sold && (
        <div
          style={{
            position: "relative",
            marginTop: 8,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
            {t("listsView.extend")}
          </span>
          <BuyChip item={sold.id} price={sold.price} onBought={reread} compact />
        </div>
      )}

      {canExtend && powerHeld > 0 && (
        <button
          onClick={push}
          data-tour="lists-extend"
          style={{
            ...bare,
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            color: C.ochre,
            marginTop: 8,
          }}
        >
          {t("listsView.extend")}
        </button>
      )}

      {/* ------------------------------------------------------------
          LE SECOND SOUFFLE — ce qui rattrape un défi manqué
          ------------------------------------------------------------

          LA PROLONGATION NE COUVRAIT PAS CE CAS, ET C'EST TOUT L'OBJET :
          elle est réservée à qui a CRÉÉ le défi, capée à deux, et
          s'arrête une semaine après la fin. Un participant qui s'aperçoit
          trop tard qu'il a laissé filer n'avait rien — le défi était
          raté, et la seule voie était d'attendre le suivant.

          Il ne s'affiche donc QUE sur un défi fini et non soldé, ce qui
          est le seul moment où il sert : dessiné pendant qu'il court, il
          serait un bouton qui ne fait rien. */}
      {state === "finished" && (
        <SecondWind challengeId={challenge.id} onPushed={setEnds} onChange={onChange} />
      )}
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </div>
  );
}

function SecondWind({
  challengeId,
  onPushed,
  onChange,
}: {
  challengeId: string;
  onPushed: (ends: string) => void;
  onChange: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const catalogue = useShop();
  const sold = catalogue.find((i) => i.power === "second-wind");
  const held = sold?.held ?? 0;
  const [trouble, setTrouble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!sold) return null;

  const blow = async () => {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      const again = await secondWind(challengeId);
      onPushed(again.ends_on);
      await onChange();
    } catch (e) {
      /* Le serveur rend le pouvoir quand il refuse — essayer ne coûte
         rien, et il faut le dire, sans quoi le clic a l'air perdu. */
      setTrouble((e as Error).message);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      {held > 0 ? (
        <button
          onClick={blow}
          disabled={busy}
          data-tour="lists-second-wind"
          style={{
            ...bare,
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            color: C.pine,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {t("listsView.secondWind")}
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
            {t("listsView.secondWind")}
          </span>
          <BuyChip item={sold.id} price={sold.price} onBought={onChange} compact />
        </div>
      )}
      {trouble && <Trouble>{trouble}</Trouble>}
    </div>
  );
}

/* The head of the view — see `ViewHeading`, shared with the quiz and the
   counter. Only the icon, the tint and the two sentences belong here. */
const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <ViewHeading
      icon={<ListChecks size={22} color={C.moss} />}
      title={t("listsView.heading")}
      blurb={t("listsView.subheading")}
    >
      {children}
    </ViewHeading>
  );
};
