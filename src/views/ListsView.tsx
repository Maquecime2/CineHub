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
  const [defis, setDefis] = useState<Challenge[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [title, setTitre] = useState("");

  const reread = useCallback(async () => {
    if (!connected) return;
    const [l, d] = await Promise.all([myLists(), myChallenges()]);
    setListes(l.listes);
    setDefis(d.defis);
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
    const nom = title.trim();
    if (!nom) return;
    const { id } = await createList({ titre: nom });
    setTitre("");
    await reread();
    setOuverte(id);
  };

  return (
    <Page>
      <div data-tour="lists-new" style={{ maxWidth: 460, marginBottom: 28 }}>
        <Label>Une nouvelle liste</Label>
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
          On y range les films depuis leur fiche — « ranger dans une liste », sous le catalogue.
        </div>
      </div>

      <div data-tour="lists-mine" style={{ marginBottom: 34 }}>
        <Label>Vos listes</Label>
        {lists.length === 0 && <Guideline>Aucune liste pour l'instant.</Guideline>}
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
        {defis.length === 0 && (
          <Guideline>
            Aucun défi. Un défi est une liste plus une période : ouvrez une liste ci-dessus pour en
            lancer un.
          </Guideline>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {defis.map((d) => (
            <OneChallenge key={d.id} defi={d} onChange={reread} />
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
  const [oeuvres, setOeuvres] = useState<ListWork[]>([]);
  const [membres, setMembres] = useState<string[]>([]);
  const [invite, setInvite] = useState("");
  const [souci, setSouci] = useState<string | null>(null);
  const [defi, setDefi] = useState({
    title: "",
    start: currentMonth().start,
    end: currentMonth().end,
  });

  const reread = useCallback(async () => {
    const r = await readList(list.id);
    setOeuvres(r.oeuvres);
    setMembres(r.membres);
  }, [list.id]);

  useEffect(() => {
    if (ouverte) reread().catch(() => {});
  }, [ouverte, reread]);

  const sendInvite = async () => {
    const nom = invite.trim().toLowerCase();
    if (!nom) return;
    setSouci(null);
    try {
      await inviteToList(list.id, nom);
      setInvite("");
      await reread();
    } catch {
      /* The server answers the same thing for "does not exist" and "you
         two have blocked each other": we take up that silence. */
      setSouci(`Personne à inviter sous « ${nom} ».`);
    }
  };

  const run = async () => {
    if (!defi.title.trim()) return;
    /* The server's vocabulary is French; the form's is not. The mapping
       happens here, at the boundary, and nowhere else. */
    await createChallenge({
      listeId: list.id,
      titre: defi.title.trim(),
      debut: defi.start,
      fin: defi.end,
    });
    setDefi({ ...defi, title: "" });
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
          {list.titre}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {list.oeuvres} film{list.oeuvres > 1 ? "s" : ""}
          {list.publique ? " · publique" : ""}
          {list.mienne ? "" : ` · chez ${list.proprietaire}`}
        </span>
      </button>

      {ouverte && (
        <div style={{ padding: "0 12px 14px" }}>
          {oeuvres.length === 0 && (
            <Guideline>Vide. Rangez-y des films depuis leur fiche.</Guideline>
          )}
          {oeuvres.map((o) => (
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
                {o.titre || `TMDB ${o.tmdb_id}`}
                {o.annee ? (
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                    {" "}
                    {o.annee}
                  </span>
                ) : null}
              </span>
              {/* Who put it there: in a list written by six hands, it
                  is the only thing one wants to know about a row. */}
              {o.par && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{o.par}</span>
              )}
              <button
                onClick={() => removeFromList(list.id, o.tmdb_id).then(reread)}
                title="Retirer de la liste"
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
              {membres.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {membres.map((m) => (
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
                    checked={list.publique}
                    onChange={(e) =>
                      editList(list.id, { publique: e.target.checked }).then(onChange)
                    }
                  />{" "}
                  visible de qui vous follows
                </label>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => deleteList(list.id).then(onChange)}
                  title="Effacer cette liste"
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
          {(list.mienne || list.membre) && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${C.line}` }}>
              <Label>Lancer un défi sur cette liste</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <input
                  value={defi.title}
                  onChange={(e) => setDefi({ ...defi, title: e.target.value })}
                  placeholder="Mars chez Varda"
                  style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, flex: "1 1 160px" }}
                />
                <input
                  type="date"
                  value={defi.start}
                  onChange={(e) => setDefi({ ...defi, start: e.target.value })}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 11, width: 130 }}
                />
                <input
                  type="date"
                  value={defi.end}
                  onChange={(e) => setDefi({ ...defi, end: e.target.value })}
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

function OneChallenge({ defi, onChange }: { defi: Challenge; onChange: () => Promise<void> }) {
  const [avancement, setAvancement] = useState<Progress[] | null>(null);

  const reread = useCallback(async () => {
    const r = await readChallenge(defi.id);
    setAvancement(r.avancement);
  }, [defi.id]);

  useEffect(() => {
    reread().catch(() => setAvancement([]));
  }, [reread]);

  const today = new Date().toISOString().slice(0, 10);
  const state = today < defi.debut ? "à venir" : today > defi.fin ? "terminé" : "en cours";

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 20, color: C.ink }}>
          {defi.titre}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {defi.debut} → {defi.fin} · {state} · {defi.oeuvres} film
          {defi.oeuvres > 1 ? "s" : ""} · d'après « {defi.liste} »
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() =>
            (defi.dedans ? leaveChallenge(defi.id) : joinChallenge(defi.id))
              .then(onChange)
              .then(reread)
          }
          style={button(defi.dedans ? C.slate : C.pine)}
        >
          {defi.dedans ? "SORTIR" : "PARTICIPER"}
        </button>
        {defi.par === null || defi.dedans ? (
          <button
            onClick={() => deleteChallenge(defi.id).then(onChange)}
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
        {avancement?.length === 0 && <Guideline>Person n'y participe encore.</Guideline>}
        {(avancement ?? []).map((a) => (
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
                  width: `${defi.oeuvres ? (100 * a.faites) / defi.oeuvres : 0}%`,
                  background: C.burgundy,
                  transition: "width var(--motion-slow) var(--motion-ease)",
                }}
              />
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
              {a.faites}/{defi.oeuvres}
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
