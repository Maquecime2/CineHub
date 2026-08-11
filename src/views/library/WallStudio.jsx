/* L'ATELIER DU MUR — le pendant de l'atelier déco, côté fiches.

   L'étagère se règle depuis longtemps ; le mur, lui, n'offrait rien. Il
   reçoit ici les mêmes poignées, et surtout le MÊME nuancier : peinture,
   papier peint, encre, texture viennent de `ui/Swatches`, extraits de
   l'atelier de l'étagère précisément pour que les deux surfaces ne
   divergent jamais.

   Deux volets, parce qu'il y a deux choses à régler : ce sur quoi les
   fiches sont accrochées, et les fiches elles-mêmes. */
import { useState } from "react";
import { Calque } from "../../components/ui/Calque";
import { X, RotateCcw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { STUDIO_BOX, Title, OptionButton, SurfaceTab } from "../../components/ui/Swatches";
import { CARD_SIZES, SPREADS, MESSES, HANGS, DEFAULT_WALL_LOOK } from "./wallLook";

const Row = ({ children }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{children}</div>
);

/* Un réglage = un titre et une rangée de choix tirés de son catalogue.
   Les quatre se ressemblent parce qu'ils font la même chose : nommer une
   clé et la retenir. */
const Choice = ({ title, catalog, value, onPick, top }) => (
  <>
    <Title top={top}>{title}</Title>
    <Row>
      {Object.entries(catalog).map(([k, v]) => (
        <OptionButton key={k} on={value === k} onClick={() => onPick(k)}>
          {v.label}
        </OptionButton>
      ))}
    </Row>
  </>
);

function CardsTab({ look, set }) {
  return (
    <>
      <Choice
        title="TAILLE DES FICHES"
        top={4}
        catalog={CARD_SIZES}
        value={look.size}
        onPick={(size) => set({ size })}
      />
      <Choice
        title="ÉCARTEMENT"
        catalog={SPREADS}
        value={look.spread}
        onPick={(spread) => set({ spread })}
      />
      {/* « Rangé » ne retire pas le désordre, il le met à zéro : le tirage
          de chaque fiche est intact, et remonter d'un cran rend au mur
          exactement l'allure qu'il avait. */}
      <Choice
        title="DÉSORDRE"
        catalog={MESSES}
        value={look.mess}
        onPick={(mess) => set({ mess })}
      />
      <Choice title="ACCROCHE" catalog={HANGS} value={look.hang} onPick={(hang) => set({ hang })} />
    </>
  );
}

const TABS = [
  { key: "wall", label: "MUR" },
  { key: "cards", label: "FICHES" },
];

export function WallStudio({ look, onChange, onReset, onClose }) {
  const [tab, setTab] = useState("cards");
  // le décor est vide au départ : rien n'est écrit tant qu'on ne choisit rien
  const setDecor = (patch) => onChange({ decor: { ...(look.decor || {}), ...patch } });

  return (
    <Calque>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      <div style={STUDIO_BOX}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            ATELIER DU MUR
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onReset}
            title="Revenir au mur d'origine"
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontFamily: F.mono,
              fontSize: 9,
              color: C.burgundy,
            }}
          >
            <RotateCcw size={11} /> D'ORIGINE
          </button>
          {/* Une croix seule n'a pas de nom : sans étiquette, un lecteur
              d'écran annonce « bouton » et rien d'autre. */}
          <button
            onClick={onClose}
            aria-label="Fermer l'atelier"
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
          {TABS.map((t) => (
            <OptionButton key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </OptionButton>
          ))}
        </div>

        {tab === "wall" ? (
          <SurfaceTab decor={look.decor} set={setDecor} />
        ) : (
          <CardsTab look={look} set={onChange} />
        )}

        <div
          style={{
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
            marginTop: 10,
          }}
        >
          {DEFAULT_WALL_LOOK.size === look.size && !look.decor
            ? "le mur est encore tel qu'on l'a trouvé"
            : "ce mur est à cette collection — l'autre garde le sien"}
        </div>
      </div>
    </Calque>
  );
}
