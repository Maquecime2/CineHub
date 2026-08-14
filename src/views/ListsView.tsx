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
import { ListChecks, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { bare, chip, inked, tap, underlineInput } from "../theme/styles";
import { Guideline, Label, Meter, ViewHeading } from "../components/ui";
import { StampCorner, TapeResidue } from "../components/atmosphere";
import { Halftone } from "../components/atmosphere/hall";
import { daysLeft, mayExtend, needsSettling, stateOf } from "../domain/challenges";
import { worthOfChallenge } from "../domain/points";
import { tiltOf } from "../domain/seeded";
import { refreshPurse } from "../hooks/usePurse";
import { useShop } from "../hooks/useShop";
import { BuyChip } from "../components/play/Buy";
import {
  createList,
  createChallenge,
  deleteList,
  deleteChallenge,
  inviteToList,
  readList,
  readChallenge,
  myChallenges,
  leaveChallenge,
  joinChallenge,
  removeFromListMembers,
  removeFromList,
  addToList,
  editList,
  extendChallenge,
  settleChallenge,
  serverConfigured,
  type Progress,
  type Challenge,
  type List,
  type ListWork,
} from "../services/server";
import { refreshLists } from "../hooks/useMyLists";
import { useTmdbKey } from "../services/tmdbKey";
import { searchMovies } from "../tmdb";

/** One TMDB result, as `searchMovies` hands it back. */
interface TmdbHit {
  tmdbId: number;
  title: string;
  year: number | null;
}

export function ListsView({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  const [lists, setLists] = useState<List[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  /* THROUGH THE SHARED STORE, NOT AROUND IT. This view held its own
     copy of "my lists" and the badges on the wall held another: a list
     opened here did not appear under a poster until something else
     happened to refresh them, and one that was erased here went on being
     offered. Two sources of truth for one question is one too many —
     `refreshLists` reads the server and tells everybody. */
  const reread = useCallback(async () => {
    if (!connected) return;
    const [l, d] = await Promise.all([refreshLists(), myChallenges()]);
    setLists(l);
    setChallenges(d.challenges);
  }, [connected]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline tight>{t("listsView.noServer")}</Guideline>
      </Page>
    );
  }

  if (!connected) {
    return (
      <Page>
        <Guideline tight>{t("listsView.noAccount")}</Guideline>
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
        {lists.length === 0 && <Guideline tight>{t("listsView.none")}</Guideline>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {lists.map((l) => (
            <OneList
              key={l.id}
              list={l}
              opened={opened === l.id}
              onToggle={() => setOpened(opened === l.id ? null : l.id)}
              onChange={reread}
            />
          ))}
        </div>
      </div>

      <div data-tour="lists-challenges">
        <Label>{t("listsView.challenges")}</Label>
        {challenges.length === 0 && <Guideline tight>{t("listsView.noChallenges")}</Guideline>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {challenges.map((d) => (
            <OneChallenge key={d.id} challenge={d} onChange={reread} />
          ))}
        </div>
      </div>
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
}: {
  list: List;
  opened: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [works, setWorks] = useState<ListWork[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [invite, setInvitee] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  const [challenge, setDraft] = useState({
    title: "",
    start: currentMonth().start,
    end: currentMonth().end,
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
              {o.per && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{o.per}</span>
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

          <FillFromTmdb list={list} onFiled={reread} />

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
                  onClick={() => deleteList(list.id).then(onChange)}
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
                <button onClick={run} style={inked(C.burgundy)}>
                  {t("listsView.launch")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
function FillFromTmdb({ list, onFiled }: { list: List; onFiled: () => Promise<void> }) {
  const { t } = useTranslation();
  const apiKey = useTmdbKey();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<TmdbHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [filed, setFiled] = useState<ReadonlySet<number>>(new Set());

  /* One writes in a list one may write in. A stranger's public list is
     read here, not filled. */
  if (!list.mienne && !list.isMember) return null;
  if (!apiKey) {
    return (
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 12 }}>
        {t("lists.searchNeedsKey")}
      </div>
    );
  }

  const look = async () => {
    const title = q.trim();
    if (!title) return;
    setBusy(true);
    setTrouble(null);
    try {
      setFound(await searchMovies({ title, apiKey, limit: 8 }));
    } catch (e) {
      setFound(null);
      setTrouble((e as Error).message || t("lists.searchNobody"));
    } finally {
      setBusy(false);
    }
  };

  const file = async (hit: TmdbHit) => {
    setBusy(true);
    try {
      await addToList(list.id, {
        tmdbId: hit.tmdbId,
        title: hit.title,
        year: hit.year ?? undefined,
      });
      setFiled((was) => new Set(was).add(hit.tmdbId));
      await onFiled();
    } catch (e) {
      setTrouble((e as Error).message || t("lists.filingFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-tour="lists-search" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && look()}
          placeholder={t("lists.searchPlaceholder")}
          style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16 }}
        />
        <button onClick={look} disabled={busy} style={inked(C.slate)}>
          <Search size={12} /> {busy ? t("lists.searching") : t("lists.search")}
        </button>
      </div>

      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
        {t("lists.searchNote")}
      </div>

      {found?.length === 0 && <Guideline tight>{t("lists.searchNobody")}</Guideline>}

      {found?.map((hit) => (
        <div
          key={hit.tmdbId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 0",
            borderBottom: `1px dashed ${alpha(C.line, 0.6)}`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontFamily: F.title, fontSize: 15, color: C.ink }}>
            {hit.title}
            {hit.year ? (
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                {" "}
                {hit.year}
              </span>
            ) : null}
          </span>
          <button
            onClick={() => file(hit)}
            disabled={busy || filed.has(hit.tmdbId)}
            style={{
              ...bare,
              color: filed.has(hit.tmdbId) ? C.moss : C.ink,
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 1,
            }}
          >
            {filed.has(hit.tmdbId) ? t("lists.added") : t("lists.add")}
          </button>
        </div>
      ))}

      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.burgundy, marginTop: 6 }}>
          {trouble}
        </div>
      )}
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
    { starts_on: challenge.starts_on, ends_on: ends, by: challenge.per },
    challenge.per ?? null
  );

  const state = stateOf({ starts_on: challenge.starts_on, ends_on: ends });
  const left = daysLeft({ ends_on: ends });
  const done = progress?.find((p) => p.pseudo === challenge.per)?.done ?? 0;

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
          {challenge.starts_on} → {ends} · {t("listsView.works", { count: challenge.works })} ·{" "}
          {t("listsView.fromList", { title: challenge.list })}
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
        {challenge.per === null || challenge.inside ? (
          <button
            onClick={() => deleteChallenge(challenge.id).then(onChange)}
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
            ? t("listsView.wasWorth", { points: worthOfChallenge(done, challenge.works) })
            : t("listsView.worth", {
                points: worthOfChallenge(done, challenge.works),
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
            total={challenge.works}
            ink={state === "finished" ? C.moss : C.burgundy}
          />
        ))}
      </div>

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
    </div>
  );
}

/* The month one is in, from the first to the last day: it is the period
   one wants nine times out of ten, and it is corrected in one click. */
function currentMonth() {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  const start = `${d.getFullYear()}-${two(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${last.getFullYear()}-${two(last.getMonth() + 1)}-${two(last.getDate())}`;
  return { start, end };
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
