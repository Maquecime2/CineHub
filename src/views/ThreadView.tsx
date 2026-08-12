/* ============================================================
   THE FEED — what the others are watching
   ============================================================

   The first view of this binder that does not speak of YOUR collection.
   It holds in three things, in that order: looking for somebody, seeing
   who one follows, reading what they have seen.

   WHAT THE FEED DOES NOT SAY, AND CANNOT SAY. The server keeps no
   history: it knows a card has moved, not what changed inside it. So we
   never write "gave it four stars" — we show the film as it stands today
   at its owner's, and we say "at so-and-so's". Claiming to tell a
   gesture one has not observed would be inventing.

   THERE IS NO DIRECTORY, and that is not an oversight: one only finds
   the people whose username one knows, and who have chosen to show
   themselves. A list of registered users would make this binder a social
   network, which it is not.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Search, UserPlus, UserMinus, Users } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { tap, underlineInput } from "../theme/styles";
import { Label } from "../components/ui";
import { PosterArt } from "../components/film/PosterArt";
import { initialsOf } from "../domain/film";
import { tiltOf } from "../domain/seeded";
import {
  readFeed,
  mySubscriptions,
  unfollow,
  profileOf,
  serverConfigured,
  follow,
  type NewsItem,
  type Profile,
} from "../services/server";

export function ThreadView({ connected }: { connected: boolean }) {
  const [abonnements, setAbonnements] = useState<Profile[]>([]);
  const [nouvelles, setNouvelles] = useState<NewsItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [trouve, setTrouve] = useState<Profile | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  const reread = useCallback(async () => {
    if (!connected) return;
    const [a, f] = await Promise.all([mySubscriptions(), readFeed()]);
    setAbonnements(a.abonnements);
    setNouvelles(f.nouvelles);
  }, [connected]);

  useEffect(() => {
    reread().catch(() => setNouvelles([]));
  }, [reread]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline>
          Aucun serveur n'est réglé : le classeur vit entièrement chez vous, et il n'y a personne à
          follow.
        </Guideline>
      </Page>
    );
  }

  if (!connected) {
    return (
      <Page>
        <Guideline>
          Il faut un compte pour suivre quelqu'un — le bouton au pied du rail. Votre collection,
          elle, n'en a pas besoin.
        </Guideline>
      </Page>
    );
  }

  const search = async () => {
    setSouci(null);
    setTrouve(null);
    const name = query.trim().toLowerCase();
    if (!name) return;
    try {
      setTrouve(await profileOf(name));
    } catch {
      /* The server answers the same thing for "does not exist" and
         "does not show themselves": we take up that silence, without
         inventing which of the two. */
      setSouci(`Personne ne partage sa collection sous « ${name} ».`);
    }
  };

  const toggle = async (profil: Profile) => {
    const follows = profil.suivi ?? abonnements.some((a) => a.pseudo === profil.pseudo);
    if (follows) await unfollow(profil.pseudo);
    else await follow(profil.pseudo);
    setTrouve({ ...profil, suivi: !follows });
    await reread();
  };

  return (
    <Page>
      {/* ---- chercher quelqu'un ---- */}
      <div data-tour="thread-search" style={{ marginBottom: 26, maxWidth: 420 }}>
        <Label>Chercher quelqu'un</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="son pseudonyme"
            autoCapitalize="none"
            spellCheck={false}
            style={{ ...underlineInput, fontFamily: F.mono, fontSize: 13 }}
          />
          <button onClick={search} style={button(C.ink)}>
            <Search size={12} /> VOIR
          </button>
        </div>
        {souci && (
          <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 8 }}>
            {souci}
          </div>
        )}
        {trouve && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              padding: "10px 12px",
              background: C.card,
              border: `1px solid ${C.line}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 19, color: C.ink }}>
                {trouve.pseudo}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                {trouve.films} film{trouve.films > 1 ? "s" : ""} montrés
              </div>
            </div>
            <a href={`#/chez/${trouve.pseudo}`} style={link}>
              SA COLLECTION
            </a>
            <button onClick={() => toggle(trouve)} style={button(C.burgundy)}>
              {trouve.suivi ? <UserMinus size={12} /> : <UserPlus size={12} />}
              {trouve.suivi ? "NE PLUS SUIVRE" : "SUIVRE"}
            </button>
          </div>
        )}
      </div>

      {/* ---- qui l'on suit ---- */}
      {abonnements.length > 0 && (
        <div data-tour="thread-follows" style={{ marginBottom: 30 }}>
          <Label>Vous suivez</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {abonnements.map((a) => (
              <span
                key={a.pseudo}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.inkFaded,
                }}
              >
                <a href={`#/chez/${a.pseudo}`} style={{ color: C.ink, textDecoration: "none" }}>
                  {a.pseudo}
                </a>
                {/* A collection closed again does not vanish from the
                    list: one stays subscribed, and the feed goes quiet.
                    Saying so avoids believing in a breakdown. */}
                {a.ouverte === false && <em style={{ opacity: 0.7 }}>refermée</em>}
                <button
                  onClick={() => toggle(a)}
                  title={`Ne plus suivre ${a.pseudo}`}
                  style={{ ...tap, all: "unset", cursor: "pointer", color: C.burgundy }}
                >
                  <UserMinus size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- le fil ---- */}
      <div data-tour="thread-news">
        <Label>Dernièrement, chez eux</Label>
        {nouvelles === null && <Guideline>Ouverture…</Guideline>}
        {nouvelles?.length === 0 && (
          <Guideline>
            {abonnements.length === 0
              ? "Vous ne suivez encore personne. Cherchez un pseudonyme ci-dessus."
              : "Rien de neuf chez les gens que vous suivez."}
          </Guideline>
        )}
        {nouvelles && nouvelles.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 20,
              marginTop: 10,
            }}
          >
            {nouvelles.map((n) => (
              <figure
                key={`${n.pseudo}-${n.id}`}
                style={{ margin: 0, transform: `rotate(${tiltOf(n.id)}deg)` }}
              >
                <div
                  style={{
                    background: C.card,
                    padding: 7,
                    border: `1px solid ${C.line}`,
                    boxShadow: `2px 5px 14px ${alpha(C.ink, 0.2)}`,
                  }}
                >
                  <PosterArt
                    film={n.film as never}
                    initials={initialsOf(String(n.film.title || ""))}
                  />
                  <figcaption style={{ padding: "8px 3px 2px" }}>
                    <div style={{ fontFamily: F.title, fontSize: 14, color: C.ink }}>
                      {String(n.film.title || "")}
                    </div>
                    {/* « chez untel », et non « untel a fait ceci » : on
                        montre un état, on ne raconte pas un geste. */}
                    <a
                      href={`#/chez/${n.pseudo}`}
                      style={{
                        fontFamily: F.mono,
                        fontSize: 9.5,
                        color: C.burgundy,
                        textDecoration: "none",
                      }}
                    >
                      chez {n.pseudo}
                    </a>
                    {n.film.review ? (
                      <div
                        style={{
                          fontFamily: F.hand,
                          fontSize: 15,
                          color: C.inkFaded,
                          marginTop: 5,
                          lineHeight: 1.35,
                        }}
                      >
                        {String(n.film.review)}
                      </div>
                    ) : null}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

const Page = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: "34px 24px 70px", maxWidth: 1100 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
      <Users size={22} color={C.cobalt} />
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
        Le fil
      </h1>
    </div>
    <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginBottom: 24 }}>
      ce que regardent les gens que vous suivez
    </div>
    {children}
  </div>
);

const Guideline = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginTop: 8 }}>
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

const link = {
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.inkFaded,
  textDecoration: "none",
  borderBottom: `1px dashed ${C.line}`,
};
