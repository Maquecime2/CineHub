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
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Search, UserPlus, UserMinus, Users } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { bare, inked, underlineInput } from "../theme/styles";
import { Guideline, Label, Trouble, ViewHeading, Waiting } from "../components/ui";
import { Stamp } from "../components/atmosphere/hall";
import { STAMP_INK, stampLabel } from "../components/play/stamps";
import { PosterArt } from "../components/film/PosterArt";
import { initialsOf } from "../domain/film";
import { tiltOf } from "../domain/seeded";
import { feed } from "../hooks/useHall";
import { HallWindow } from "../components/layout/HallWindow";
import {
  unfollow,
  profileOf,
  serverConfigured,
  follow,
  type NewsItem,
  type Profile,
} from "../services/server";

export function ThreadView({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  const [subscriptions, setAbonnements] = useState<Profile[]>([]);
  const [news, setNouvelles] = useState<NewsItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [trouve, setTrouve] = useState<Profile | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  /* SERVI DE MÉMOIRE À L'ENTRÉE, REDEMANDÉ APRÈS UN GESTE. `App` démonte
     la vue à chaque changement d'onglet : sans cela, un aller-retour au
     comptoir relisait le fil entier. Voir `hooks/useHall`. */
  const show = useCallback((d: { subscriptions: Profile[]; news: NewsItem[] }) => {
    setAbonnements(d.subscriptions);
    setNouvelles(d.news);
  }, []);

  const reread = useCallback(async () => {
    if (!connected) return;
    show(await feed.refresh());
  }, [connected, show]);

  useEffect(() => {
    if (!connected) return;
    feed
      .load()
      .then(show)
      /* LE FIL SE TAISAIT DE DEUX FAÇONS ET N'EN MONTRAIT QU'UNE. Une
         liste vide et une requête refusée arrivaient toutes les deux
         ici, et l'écran affichait la même chose : rien. On dit
         maintenant laquelle des deux. */
      .catch((e: Error) => {
        setNouvelles([]);
        setSouci(e.message);
      });
  }, [connected, show]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline>{t("threadView.noServer")}</Guideline>
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
      /* LA PHRASE ÉTAIT CASSÉE, et par un remplacement automatique :
         elle disait « Personne ne sharing sa collection sous … » — un
         mot français remplacé par sa traduction anglaise au milieu
         d'une phrase française. Elle est écrite en dur depuis toujours ;
         elle passe donc aux clés, comme le reste. */
      setSouci(t("threadView.noSuchPerson", { name }));
    }
  };

  const toggle = async (profil: Profile) => {
    const follows = profil.followed ?? subscriptions.some((a) => a.pseudo === profil.pseudo);
    if (follows) await unfollow(profil.pseudo);
    else await follow(profil.pseudo);
    setTrouve({ ...profil, followed: !follows });
    await reread();
  };

  return (
    <Page>
      {/* ---- chercher quelqu'un ---- */}
      <div data-tour="thread-search" style={{ marginBottom: 26, maxWidth: 420 }}>
        <Label>{t("threadView.find")}</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={t("threadView.pseudoPlaceholder")}
            autoCapitalize="none"
            spellCheck={false}
            style={{ ...underlineInput, fontFamily: F.mono, fontSize: 13 }}
          />
          <button onClick={search} style={inked(C.ink)}>
            <Search size={12} /> {t("threadView.look")}
          </button>
        </div>
        {souci && <Trouble>{souci}</Trouble>}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 7,
                  fontFamily: F.title,
                  fontStyle: "italic",
                  fontSize: 19,
                  color: C.ink,
                }}
              >
                {trouve.pseudo}
                {trouve.stamp && (
                  <Stamp
                    text={t(stampLabel(trouve.stamp))}
                    ink={STAMP_INK[trouve.stamp] ?? C.burgundy}
                  />
                )}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                {t("threadView.shown", { count: trouve.films })}
              </div>
            </div>
            <a href={`#/chez/${trouve.pseudo}`} style={link}>
              {t("threadView.theirCollection")}
            </a>
            <button onClick={() => toggle(trouve)} style={inked(C.burgundy)}>
              {trouve.followed ? <UserMinus size={12} /> : <UserPlus size={12} />}
              {trouve.followed ? t("threadView.unfollow") : t("threadView.follow")}
            </button>
          </div>
        )}
      </div>

      {/* ---- qui l'on suit ---- */}
      {subscriptions.length > 0 && (
        <div data-tour="thread-follows" style={{ marginBottom: 30 }}>
          <Label>{t("threadView.youFollow")}</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {subscriptions.map((a) => (
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
                {a.stamp && (
                  <Stamp text={t(stampLabel(a.stamp))} ink={STAMP_INK[a.stamp] ?? C.burgundy} />
                )}
                {/* A collection closed again does not vanish from the
                    list: one stays subscribed, and the feed goes quiet.
                    Saying so avoids believing in a breakdown.

                    ET ÇA NE S'EST JAMAIS AFFICHÉ. Le serveur envoie
                    `open` ; cette ligne lisait `ouverte`, donc elle
                    comparait `undefined` à `false` — faux, toujours.
                    Quatrième de la famille dans ce dépôt, après
                    `liste_id`, `per` et le `Profile` qui l'épelait. */}
                {a.open === false && (
                  <em style={{ opacity: 0.7 }}>{t("threadView.closedAgain")}</em>
                )}
                <button
                  onClick={() => toggle(a)}
                  title={t("threadView.unfollowSomebody", { pseudo: a.pseudo })}
                  style={{ ...bare, color: C.burgundy }}
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
        <Label>{t("threadView.lately")}</Label>
        {/* LE SQUELETTE OFFICIEL, ET PAS UNE PHRASE. `Waiting` porte
            `role="status"` et `aria-live` : une ligne de texte muette
            dit à l'œil qu'on attend et ne le dit à personne d'autre. */}
        {news === null && <Waiting lines={3} label={t("threadView.opening")} />}
        {news?.length === 0 && (
          <Guideline tight>
            {subscriptions.length === 0 ? t("threadView.followNobody") : t("threadView.nothingNew")}
          </Guideline>
        )}
        {news && news.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 20,
              marginTop: 10,
            }}
          >
            {news.map((n) => (
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
                    {/* "at so-and-so's", and not "so-and-so did this": we show a
                        state, we do not tell a gesture. */}
                    <a
                      href={`#/chez/${n.pseudo}`}
                      style={{
                        fontFamily: F.mono,
                        fontSize: 9.5,
                        color: C.burgundy,
                        textDecoration: "none",
                      }}
                    >
                      {t("threadView.at", { pseudo: n.pseudo })}
                    </a>
                    {n.stamp && (
                      <span style={{ marginLeft: 5 }}>
                        <Stamp
                          text={t(stampLabel(n.stamp))}
                          ink={STAMP_INK[n.stamp] ?? C.burgundy}
                        />
                      </span>
                    )}
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

/* La tête de la vue — voir `ViewHeading`, partagé avec les listes, le
   quiz et le comptoir. C'était la TROISIÈME copie de ce bloc dans le
   projet, avec son `Guideline` et son `button` : le fil ne se lit jamais
   en même temps que les deux autres, et c'est ainsi qu'un bloc se
   recopie sans que personne ne le voie. */
const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <ViewHeading
      icon={<Users size={22} color={C.cobalt} />}
      title={t("threadView.heading")}
      blurb={t("threadView.subheading")}
      wide
    >
      {children}
    </ViewHeading>
  );
};

const link = {
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.inkFaded,
  textDecoration: "none",
  borderBottom: `1px dashed ${C.line}`,
};
