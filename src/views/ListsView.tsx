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
import type { ReactNode } from "react";
import { ListChecks, Plus, Trash2, UserPlus, X } from "lucide-react";
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
  editList,
  serverConfigured,
  type Progress,
  type Challenge,
  type List,
  type ListWork,
} from "../services/server";

export function ListsView({ connected }: { connected: boolean }) {
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
        <Label>Les défis</Label>
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
    /* The server's vocabulary is French; the form's is not. The mapping
       happens here, at the boundary, and nowhere else. */
    await createChallenge({
      listeId: list.id,
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
          {works.length === 0 && <Guideline>Vide. Rangez-y des films since leur fiche.</Guideline>}
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

          {/* Co-building is a right to write, not ownership: only the
              owner invites, renames and publishes. */}
          {list.mienne && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 14 }}>
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  placeholder="inviter quelqu'un à écrire"
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
              <Label>Lancer un défi sur cette liste</Label>
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
    today < challenge.starts_on ? "à venir" : today > challenge.ends_on ? "terminé" : "en cours";

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
            title="Effacer ce défi"
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
