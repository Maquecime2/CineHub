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
import { tap, underlineInput } from "../theme/styles";
import { Label } from "../components/ui";
import {
  createList,
  createChallenge,
  deleteList,
  deleteChallenge,
  inviteToList,
  readList,
  readChallenge,
  myChallenges,
  myLists,
  leaveChallenge,
  joinChallenge,
  removeFromListMembers,
  removeFromList,
  addToList,
  editList,
  serverConfigured,
  type Progress,
  type Challenge,
  type List,
  type ListWork,
} from "../services/server";
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
  const [lists, setListes] = useState<List[]>([]);
  const [challenges, setDefis] = useState<Challenge[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [title, setTitre] = useState("");

  const reread = useCallback(async () => {
    if (!connected) return;
    const [l, d] = await Promise.all([myLists(), myChallenges()]);
    setListes(l.lists);
    setDefis(d.challenges);
  }, [connected]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline>
          Aucun serveur n'est réglé : les listes et les défis se partagent, et il n'y a personne
          avec qui.
        </Guideline>
      </Page>
    );
  }

  if (!connected) {
    return (
      <Page>
        <Guideline>
          Il faut un compte — le bouton au pied du rail. Votre vidéothèque, elle, n'en a pas besoin.
        </Guideline>
      </Page>
    );
  }

  const freshOne = async () => {
    const name = title.trim();
    if (!name) return;
    const { id } = await createList({ title: name });
    setTitre("");
    await reread();
    setOuverte(id);
  };

  return (
    <Page>
      <div data-tour="lists-new" style={{ maxWidth: 460, marginBottom: 28 }}>
        <Label>Une nouvelle list</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            value={title}
            onChange={(e) => setTitre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && freshOne()}
            placeholder="Les films qu'il faut avoir vus en mars"
            style={{ ...underlineInput, fontFamily: F.hand, fontSize: 17 }}
          />
          <button onClick={freshOne} style={button(C.ink)}>
            <Plus size={12} /> OUVRIR
          </button>
        </div>
        {/* The gesture of filling a list starts from the CARD: that is
            where one has the film in front of one's eyes, and its work
            identifier. */}
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
          On y range les films since leur fiche — « ranger dans une list », sous at catalogue.
        </div>
      </div>

      <div data-tour="lists-mine" style={{ marginBottom: 34 }}>
        <Label>Vos lists</Label>
        {lists.length === 0 && <Guideline>Aucune list pour l'instant.</Guideline>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {lists.map((l) => (
            <OneList
              key={l.id}
              list={l}
              ouverte={ouverte === l.id}
              onOuvrir={() => setOuverte(ouverte === l.id ? null : l.id)}
              onChange={reread}
            />
          ))}
        </div>
      </div>

      <div data-tour="lists-challenges">
        <Label>{t("listsView.challenges")}</Label>
        {challenges.length === 0 && (
          <Guideline>
            Aucun défi. Un défi est une liste plus une période : ouvrez une liste ci-dessus pour en
            lancer un.
          </Guideline>
        )}
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
  ouverte,
  onOuvrir,
  onChange,
}: {
  list: List;
  ouverte: boolean;
  onOuvrir: () => void;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [works, setOeuvres] = useState<ListWork[]>([]);
  const [members, setMembres] = useState<string[]>([]);
  const [invite, setInvite] = useState("");
  const [souci, setSouci] = useState<string | null>(null);
  const [challenge, setDefi] = useState({
    title: "",
    start: currentMonth().start,
    end: currentMonth().end,
  });

  const reread = useCallback(async () => {
    const r = await readList(list.id);
    setOeuvres(r.works);
    setMembres(r.members);
  }, [list.id]);

  useEffect(() => {
    if (ouverte) reread().catch(() => {});
  }, [ouverte, reread]);

  const sendInvite = async () => {
    const name = invite.trim().toLowerCase();
    if (!name) return;
    setSouci(null);
    try {
      await inviteToList(list.id, name);
      setInvite("");
      await reread();
    } catch {
      /* The server answers the same thing for "does not exist" and "you
         two have blocked each other": we take up that silence. */
      setSouci(`Personne à inviter sous « ${name} ».`);
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
    setDefi({ ...challenge, title: "" });
    await onChange();
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <button
        onClick={onOuvrir}
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
          {list.is_public ? " · publique" : ""}
          {list.mienne ? "" : ` · chez ${list.owner}`}
        </span>
      </button>

      {ouverte && (
        <div style={{ padding: "0 12px 14px" }}>
          {works.length === 0 && <Guideline>{t("lists.searchNote")}</Guideline>}
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
                title="Retirer de la list"
                style={{ ...small, color: C.burgundy }}
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
                  onChange={(e) => setInvite(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  placeholder={t("listsView.inviteSomebody")}
                  autoCapitalize="none"
                  spellCheck={false}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                />
                <button onClick={sendInvite} style={button(C.pine)}>
                  <UserPlus size={12} /> INVITER
                </button>
              </div>
              {souci && (
                <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 4 }}>
                  {souci}
                </div>
              )}
              {members.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {members.map((m) => (
                    <span key={m} style={token}>
                      {m}
                      <button
                        onClick={() => removeFromListMembers(list.id, m).then(reread)}
                        title={`Retirer ${m}`}
                        style={{ ...small, color: C.burgundy }}
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
                  visible de qui vous follows
                </label>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => deleteList(list.id).then(onChange)}
                  title="Effacer cette list"
                  style={{ ...small, color: C.burgundy }}
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
                  onChange={(e) => setDefi({ ...challenge, title: e.target.value })}
                  placeholder="Mars chez Varda"
                  style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, flex: "1 1 160px" }}
                />
                <input
                  type="date"
                  value={challenge.start}
                  onChange={(e) => setDefi({ ...challenge, start: e.target.value })}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
                />
                <input
                  type="date"
                  value={challenge.end}
                  onChange={(e) => setDefi({ ...challenge, end: e.target.value })}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
                />
                <button onClick={run} style={button(C.burgundy)}>
                  LANCER
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
  const [souci, setSouci] = useState<string | null>(null);
  const [filed, setRangés] = useState<ReadonlySet<number>>(new Set());

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
    setSouci(null);
    try {
      setFound(await searchMovies({ title, apiKey, limit: 8 }));
    } catch (e) {
      setFound(null);
      setSouci((e as Error).message || t("lists.searchNobody"));
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
      setRangés((was) => new Set(was).add(hit.tmdbId));
      await onFiled();
    } catch (e) {
      setSouci((e as Error).message || t("lists.filingFailed"));
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
        <button onClick={look} disabled={busy} style={button(C.slate)}>
          <Search size={12} /> {busy ? t("lists.searching") : t("lists.search")}
        </button>
      </div>

      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
        {t("lists.searchNote")}
      </div>

      {found?.length === 0 && <Guideline>{t("lists.searchNobody")}</Guideline>}

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
              ...small,
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

      {souci && (
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.burgundy, marginTop: 6 }}>
          {souci}
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

  const reread = useCallback(async () => {
    const r = await readChallenge(challenge.id);
    setAvancement(r.progress);
  }, [challenge.id]);

  useEffect(() => {
    reread().catch(() => setAvancement([]));
  }, [reread]);

  const today = new Date().toISOString().slice(0, 10);
  const state =
    today < challenge.starts_on
      ? t("listsView.upcoming")
      : today > challenge.ends_on
        ? t("listsView.finished")
        : t("listsView.running");

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 20, color: C.ink }}>
          {challenge.title}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {challenge.starts_on} → {challenge.ends_on} · {state} · {challenge.works} film
          {challenge.works > 1 ? "s" : ""} · d'après « {challenge.list} »
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() =>
            (challenge.inside ? leaveChallenge(challenge.id) : joinChallenge(challenge.id))
              .then(onChange)
              .then(reread)
          }
          style={button(challenge.inside ? C.slate : C.pine)}
        >
          {challenge.inside ? "SORTIR" : "PARTICIPER"}
        </button>
        {challenge.per === null || challenge.inside ? (
          <button
            onClick={() => deleteChallenge(challenge.id).then(onChange)}
            title={t("listsView.deleteChallenge")}
            style={{ ...small, color: C.burgundy }}
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>

      {/* The progress leaves the log of screenings as a NUMBER only:
          the server counts, it does not copy out — and only counts
          people who have asked to take part. */}
      <div style={{ marginTop: 8 }}>
        {progress?.length === 0 && <Guideline>Person n'y participe more.</Guideline>}
        {(progress ?? []).map((a) => (
          <div
            key={a.pseudo}
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}
          >
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 10.5,
                color: C.ink,
                width: 110,
                flexShrink: 0,
              }}
            >
              {a.pseudo}
            </span>
            <span
              style={{
                flex: 1,
                height: 7,
                background: alpha(C.ink, 0.08),
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  right: "auto",
                  width: `${challenge.works ? (100 * a.done) / challenge.works : 0}%`,
                  background: C.burgundy,
                  transition: "width var(--motion-slow) var(--motion-ease)",
                }}
              />
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
              {a.done}/{challenge.works}
            </span>
          </div>
        ))}
      </div>
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

const Page = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: "34px 24px 70px", maxWidth: 1000 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
      <ListChecks size={22} color={C.moss} />
      <h1
        style={{
          margin: 0,
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 34,
          color: C.ink,
        }}
      >
        Listes et défis
      </h1>
    </div>
    <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginBottom: 24 }}>
      ce qu'on se donne à voir, seul ou à plusieurs
    </div>
    {children}
  </div>
);

const Guideline = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 8 }}>
    {children}
  </div>
);

const button = (ink: string) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  gap: 6,
  padding: "7px 12px",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.card,
  background: ink,
  border: `1px solid ${ink}`,
});

const small = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  color: C.inkFaded,
};

const token = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 8px",
  border: `1px solid ${C.line}`,
  fontFamily: F.mono,
  fontSize: 10,
  color: C.inkFaded,
};
