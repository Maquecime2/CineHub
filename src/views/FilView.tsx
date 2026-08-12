/* ============================================================
   LE FIL — ce que les autres regardent
   ============================================================

   La première vue de ce classeur qui ne parle pas de VOTRE collection.
   Elle tient en trois choses, dans cet ordre : chercher quelqu'un, voir
   qui l'on suit, lire ce qu'ils ont vu.

   CE QUE LE FIL NE DIT PAS, ET NE PEUT PAS DIRE. Le serveur ne garde
   aucune histoire : il sait qu'une fiche a bougé, pas ce qui a changé
   dedans. On n'écrit donc jamais « a mis quatre étoiles » — on montre
   le film tel qu'il est aujourd'hui chez son propriétaire, et l'on dit
   « chez untel ». Prétendre raconter un geste qu'on n'a pas observé
   serait inventer.

   IL N'Y A PAS D'ANNUAIRE, et ce n'est pas un oubli : on ne trouve que
   les gens dont on connaît le pseudonyme, et qui ont choisi de se
   montrer. Une liste des inscrits ferait de ce classeur un réseau
   social, ce qu'il n'est pas.
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
  lireLeFil,
  mesAbonnements,
  nePlusSuivre,
  profilDe,
  serveurConfigure,
  suivre,
  type Nouvelle,
  type Profil,
} from "../services/serveur";

export function FilView({ connecte }: { connecte: boolean }) {
  const [abonnements, setAbonnements] = useState<Profil[]>([]);
  const [nouvelles, setNouvelles] = useState<Nouvelle[] | null>(null);
  const [cherche, setCherche] = useState("");
  const [trouve, setTrouve] = useState<Profil | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  const relire = useCallback(async () => {
    if (!connecte) return;
    const [a, f] = await Promise.all([mesAbonnements(), lireLeFil()]);
    setAbonnements(a.abonnements);
    setNouvelles(f.nouvelles);
  }, [connecte]);

  useEffect(() => {
    relire().catch(() => setNouvelles([]));
  }, [relire]);

  if (!serveurConfigure()) {
    return (
      <Page>
        <Consigne>
          Aucun serveur n'est réglé : le classeur vit entièrement chez vous, et il n'y a personne à
          suivre.
        </Consigne>
      </Page>
    );
  }

  if (!connecte) {
    return (
      <Page>
        <Consigne>
          Il faut un compte pour suivre quelqu'un — le bouton au pied du rail. Votre collection,
          elle, n'en a pas besoin.
        </Consigne>
      </Page>
    );
  }

  const chercher = async () => {
    setSouci(null);
    setTrouve(null);
    const nom = cherche.trim().toLowerCase();
    if (!nom) return;
    try {
      setTrouve(await profilDe(nom));
    } catch {
      /* Le serveur répond la même chose pour « n'existe pas » et « ne se
         montre pas » : on reprend ce silence, sans inventer laquelle
         des deux. */
      setSouci(`Person ne partage sa collection sous « ${nom} ».`);
    }
  };

  const basculer = async (profil: Profil) => {
    const suit = profil.suivi ?? abonnements.some((a) => a.pseudo === profil.pseudo);
    if (suit) await nePlusSuivre(profil.pseudo);
    else await suivre(profil.pseudo);
    setTrouve({ ...profil, suivi: !suit });
    await relire();
  };

  return (
    <Page>
      {/* ---- chercher quelqu'un ---- */}
      <div data-tour="fil-chercher" style={{ marginBottom: 26, maxWidth: 420 }}>
        <Label>Chercher quelqu'un</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && chercher()}
            placeholder="son pseudonyme"
            autoCapitalize="none"
            spellCheck={false}
            style={{ ...underlineInput, fontFamily: F.mono, fontSize: 13 }}
          />
          <button onClick={chercher} style={bouton(C.ink)}>
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
            <a href={`#/chez/${trouve.pseudo}`} style={lien}>
              SA COLLECTION
            </a>
            <button onClick={() => basculer(trouve)} style={bouton(C.burgundy)}>
              {trouve.suivi ? <UserMinus size={12} /> : <UserPlus size={12} />}
              {trouve.suivi ? "NE PLUS SUIVRE" : "SUIVRE"}
            </button>
          </div>
        )}
      </div>

      {/* ---- qui l'on suit ---- */}
      {abonnements.length > 0 && (
        <div data-tour="fil-abonnements" style={{ marginBottom: 30 }}>
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
                {/* Une collection refermée ne disparaît pas de la liste :
                    on reste abonné, et le fil se tait. Le dire évite de
                    croire à une panne. */}
                {a.ouverte === false && <em style={{ opacity: 0.7 }}>refermée</em>}
                <button
                  onClick={() => basculer(a)}
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
      <div data-tour="fil-nouvelles">
        <Label>Dernièrement, chez eux</Label>
        {nouvelles === null && <Consigne>Ouverture…</Consigne>}
        {nouvelles?.length === 0 && (
          <Consigne>
            {abonnements.length === 0
              ? "Vous ne suivez encore personne. Cherchez un pseudonyme ci-dessus."
              : "Rien de neuf chez les gens que vous suivez."}
          </Consigne>
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

const Consigne = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginTop: 8 }}>
    {children}
  </div>
);

const bouton = (encre: string) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  gap: 6,
  padding: "7px 12px",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.card,
  background: encre,
  border: `1px solid ${encre}`,
});

const lien = {
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.inkFaded,
  textDecoration: "none",
  borderBottom: `1px dashed ${C.line}`,
};
