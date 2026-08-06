/* ============================================================
   L'ÉCRAN DE CONTRÔLE DES PEAUX — quatorze mondes, côte à côte
   ============================================================

   Quatorze peaux veut dire que toute pièce nouvelle est un pari sur
   quatorze rendus qu'on ne regarde jamais. On en avait la preuve : un
   dégradé d'onglet écrit `${couleur}cc` a cessé de vouloir dire quoi que
   ce soit le jour où les jetons sont devenus des renvois, et les onglets
   ont perdu leur relief sans un mot — parce que personne ne les regardait
   ailleurs que sur sa propre peau.

   Cette planche n'existe donc qu'EN DÉVELOPPEMENT, et elle ne montre pas
   des couleurs : elle montre les VRAIS composants, ceux du site, rendus
   quatorze fois. Une pastille de couleur aurait dit que le contraste
   passe ; seul un titre au-dessus d'un fond dit s'il se lit.

   COMMENT UNE PEAU TIENT SUR UN FRAGMENT DE PAGE. `applySkin` écrit sur
   la racine du document, ce qui ne permet qu'une peau à la fois. Mais les
   variables CSS cascadent : les mêmes paires, posées en style sur un
   `div`, habillent tout ce qu'il contient et rien d'autre. C'est à quoi
   sert `skinVars`, qu'`applySkin` emploie de son côté — une seule
   définition pour les deux.

   LES POLICES, ELLES, SONT TOUTES CHARGÉES ICI. Le choix de la peau s'en
   dispense délibérément (quatorze jeux pour un panneau qu'on ouvre deux
   fois), et ses vignettes affichent donc les polices de secours. Ce
   compromis-là ne vaut pas sur une planche dont la typographie est
   justement l'objet. */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { C, F, alpha } from "../../theme/tokens";
import { SKINS, type Skin } from "../../theme/skins";
import { skinVars } from "../../theme/applySkin";
import { InkStars, Label, Tally } from "../../components/ui";
import {
  CoffeeRing,
  FileNumber,
  InkUnderline,
  PushPin,
  StampCorner,
  Tape,
  TapeResidue,
} from "../../components/atmosphere";

/* Toutes les polices de toutes les peaux, en une seule requête. */
const ALL_FONTS_ID = "skinlab-fonts";

function useAllSkinFonts(): void {
  useEffect(() => {
    const familles = [...new Set(SKINS.flatMap((s) => s.google))];
    const href = `https://fonts.googleapis.com/css2?${familles
      .map((f) => `family=${f}`)
      .join("&")}&display=swap`;
    let link = document.getElementById(ALL_FONTS_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = ALL_FONTS_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
    /* On ne retire pas le lien en partant : les polices resteraient
       chargées de toute façon, et les reposer à chaque aller-retour
       coûterait plus que de le laisser en place. */
  }, []);
}

/* ------------------------------------------------------------
   L'ÉCHANTILLON — tout ce qui doit tenir sur chaque peau
   ------------------------------------------------------------

   Rien ici n'est propre à la planche : ce sont les composants du site.
   Ajouter une pièce au vocabulaire visuel veut dire l'ajouter ICI, sans
   quoi elle échappe au contrôle. */
function Specimen() {
  return (
    <div style={{ position: "relative", padding: "18px 20px 22px" }}>
      <CoffeeRing style={{ right: -26, bottom: -34 }} rotate={18} />

      <div style={{ fontFamily: F.title, fontStyle: "italic", fontWeight: 700, fontSize: 27 }}>
        Le titre
      </div>
      <InkUnderline width={150} />
      <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginTop: 2 }}>
        et sa mention manuscrite
      </div>
      <div style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink, marginTop: 10 }}>
        Le corps du texte, celui des critiques — deux lignes suffisent à dire si l&apos;encre se
        détache vraiment du papier.
      </div>

      {/* LE CARTON POSÉ — la pièce la plus employée du site */}
      <div
        style={{
          position: "relative",
          marginTop: 18,
          padding: "16px 16px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: "3px 5px 12px rgba(30,20,10,0.22)",
          transform: "rotate(-0.7deg)",
        }}
      >
        <Tape color={C.ochre} style={{ top: -11, left: 26 }} />
        <PushPin style={{ top: -6, right: 18 }} />
        <FileNumber id="skinlab" style={{ right: 12, bottom: 8 }} />
        <Label>Étiquette tapée</Label>
        <InkStars value={3.5} />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <Tally label="Séances" value={128} />
          <Tally label="Revoyures" value={31} ink={C.burgundy} />
        </div>
      </div>

      {/* LES ACCENTS — les quatre teintes qui percent le fond, et un onglet */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 }}>
        {(["burgundy", "ochre", "pine", "slate", "cobalt", "vermillion", "moss"] as const).map(
          (t) => (
            <span
              key={t}
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: "var(--tag-tracking)",
                textTransform: "var(--tag-transform)" as never,
                borderRadius: "var(--tag-radius)",
                padding: "4px 9px",
                color: C.card,
                background: C[t],
                boxShadow: "1px 2px 4px rgba(0,0,0,0.25)",
              }}
            >
              {t}
            </span>
          )
        )}
      </div>

      {/* L'ONGLET DE CLASSEUR — le dégradé qui s'était éteint sans un mot */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "flex-start" }}>
        {[C.burgundy, C.cobalt, C.pine].map((couleur, i) => (
          <span
            key={i}
            style={{
              background: `linear-gradient(180deg, ${couleur}, ${couleur} 60%, ${alpha(couleur, 0.8)})`,
              color: C.card,
              fontFamily: F.mono,
              fontSize: 10.5,
              letterSpacing: "var(--tag-tracking)",
              textTransform: "var(--tag-transform)" as never,
              padding: "7px 12px",
              borderRadius: "0 var(--tag-radius) var(--tag-radius) 0",
              boxShadow: "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
              textShadow: "0 1px 1px rgba(0,0,0,0.3)",
            }}
          >
            Onglet
          </span>
        ))}
        <TapeResidue style={{ position: "relative", marginTop: 4 }} w={60} />
      </div>

      {/* LE CHAMP DE SAISIE — souvent oublié, souvent illisible */}
      <input
        readOnly
        value="un champ souligné"
        style={{
          marginTop: 16,
          width: "100%",
          boxSizing: "border-box",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${C.line}`,
          outline: "none",
          fontFamily: F.body,
          fontSize: 13.5,
          color: C.ink,
          padding: "4px 2px",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------
   LA PLANCHE
   ------------------------------------------------------------ */

const CARD: CSSProperties = {
  position: "relative",
  border: "1px solid rgba(0,0,0,0.25)",
  boxShadow: "2px 6px 18px rgba(20,14,8,0.3)",
  overflow: "hidden",
};

function SkinPanel({ skin }: { skin: Skin }) {
  return (
    <div style={{ ...CARD, ...skinVars(skin), background: skin.page } as CSSProperties}>
      {/* L'EN-TÊTE EST HORS DE LA PEAU. Il doit rester lisible même quand
          la peau qu'il annonce est, elle, en défaut — c'est justement ce
          cas-là qu'on vient chercher ici. D'où des valeurs en dur, les
          seules du fichier, et assumées. */}
      <div
        style={{
          padding: "7px 12px",
          background: "#1b1713",
          color: "#f0e8d8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span>{skin.label}</span>
        <span style={{ opacity: 0.55 }}>
          {skin.key}
          {skin.dark ? " · nuit" : ""}
        </span>
      </div>
      <Specimen />
    </div>
  );
}

export function SkinLab() {
  useAllSkinFonts();
  /* Une peau seule, en grand, quand on est venu en regarder UNE. */
  const [seule, setSeule] = useState<string | null>(null);
  const montrees = seule ? SKINS.filter((s) => s.key === seule) : SKINS;

  return (
    <div style={{ padding: "30px 40px 70px", position: "relative" }}>
      <StampCorner text="CONTRÔLE" />
      <div style={{ fontFamily: F.title, fontWeight: 700, fontSize: 38, color: C.ink }}>
        La planche des peaux
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded, marginBottom: 18 }}>
        les mêmes pièces, {SKINS.length} fois — visible en développement seulement
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
        <button onClick={() => setSeule(null)} style={filtreStyle(seule === null)}>
          toutes
        </button>
        {SKINS.map((s) => (
          <button key={s.key} onClick={() => setSeule(s.key)} style={filtreStyle(seule === s.key)}>
            {s.key}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: seule ? "minmax(0, 520px)" : "repeat(auto-fill, minmax(330px, 1fr))",
          gap: 22,
        }}
      >
        {montrees.map((s) => (
          <SkinPanel key={s.key} skin={s} />
        ))}
      </div>
    </div>
  );
}

const filtreStyle = (actif: boolean): CSSProperties => ({
  all: "unset",
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  padding: "4px 9px",
  color: actif ? C.card : C.inkFaded,
  background: actif ? C.ink : "transparent",
  border: `1px solid ${actif ? C.ink : C.line}`,
  borderRadius: 2,
});
