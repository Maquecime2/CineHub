/* ============================================================
   THE SKIN PICKER — what the site looks like
   ============================================================

   One thumbnail per skin, and the thumbnail IS the skin: its background
   is the page background of the one it offers, its title is written in
   its title font, its pills are its tokens. A preview that drew itself
   otherwise would end up lying — it is the same rule as the Decor
   Workshop's thumbnails.

   The fonts of a skin one has not chosen are NOT loaded: its title
   therefore shows in its stack's fallback font until one has tried it.
   That is an accepted compromise — preloading fourteen sets of fonts for
   a panel one opens twice costs far more than what the preview gains by
   it. The colours, for their part, are right the first time, and they
   are what one looks at. */
import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Lock, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { DEFAULT_SKIN, SKINS, type Skin } from "../../theme/skins";
import { ownedItems } from "../../theme/owned";
import { accountOpen } from "../../services/server";
import { usePurse } from "../../hooks/usePurse";
import { BuyChip } from "../play/Buy";
import { refreshOwned } from "../../theme/owned";

const PANEL: CSSProperties = {
  position: "fixed",
  right: 40,
  top: 90,
  zIndex: 60,
  width: 330,
  maxHeight: "calc(100vh - 140px)",
  overflowY: "auto",
  padding: "14px 16px",
  background: C.card,
  border: `1px solid ${C.line}`,
  boxShadow: "2px 8px 24px rgba(20,14,8,0.4)",
};

/* CE QU'UNE PEAU DONNE À VOIR, EN PETIT — et ce qu'il faut pour l'avoir.

   ON LIT LES VALEURS DE LA PEAU, PAS CELLES DU DOCUMENT : celles-ci sont
   celles de la peau en place, et les dix-sept vignettes seraient
   identiques.

   L'ÉCHANTILLON PÂLIT, LA BARRE D'ACHAT NON. C'était l'erreur de la
   première version : l'opacité était posée sur TOUTE la vignette, donc
   sur le bouton aussi — et un bouton à cinquante-cinq pour cent est un
   bouton désactivé, quoi qu'il dise. On ne voyait pas qu'on pouvait
   acheter.

   La barre vit donc HORS de l'échantillon, sur le fond du site et non
   sur celui de la peau. Ce n'est pas qu'une question d'opacité : cela
   dit à quoi elle appartient. L'échantillon montre ce qu'on aurait ; la
   barre est le magasin, et le magasin n'est pas en vitrine. */
function SkinCard({
  skin,
  on,
  locked,
  onBought,
  onPick,
}: {
  skin: Skin;
  on: boolean;
  /** Verrouillée : on la voit, on ne la porte pas encore. */
  locked: boolean;
  onBought: () => void;
  onPick: () => void;
}) {
  const { t } = useTranslation();

  const sample = (
    <>
      <div
        style={{
          fontFamily: skin.fonts.title,
          fontSize: 16,
          color: skin.c.ink,
          letterSpacing: skin.tag.tracking,
          textTransform: skin.tag.transform as never,
        }}
      >
        {t(`skins.${skin.key}.label`)}
      </div>
      <div
        style={{ fontFamily: skin.fonts.hand, fontSize: 13, color: skin.c.inkFaded, marginTop: 1 }}
      >
        {t(`skins.${skin.key}.note`)}
      </div>
      {/* the six tokens that carry the identity, in the order they are seen */}
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {["burgundy", "ochre", "pine", "slate", "cobalt", "vermillion"].map((k) => (
          <span
            key={k}
            style={{
              width: 15,
              height: 15,
              borderRadius: skin.tag.radius,
              background: skin.c[k],
              border: `1px solid ${alpha(skin.c.ink!, 0.2)}`,
            }}
          />
        ))}
      </div>
    </>
  );

  if (!locked) {
    return (
      <button
        onClick={onPick}
        aria-pressed={on}
        aria-label={t(`skins.${skin.key}.label`)}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          boxSizing: "border-box",
          display: "block",
          width: "100%",
          marginBottom: 8,
          padding: "10px 12px",
          background: skin.page,
          border: on ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
          borderRadius: skin.tag.radius,
        }}
      >
        {sample}
      </button>
    );
  }

  return (
    <div
      style={{
        marginBottom: 8,
        border: `1px solid ${C.line}`,
        borderRadius: skin.tag.radius,
        overflow: "hidden",
      }}
    >
      {/* L'échantillon, en retrait : ce qu'on n'a pas encore. */}
      <div
        aria-label={t(`skins.${skin.key}.label`)}
        style={{
          position: "relative",
          padding: "10px 12px",
          background: skin.page,
          opacity: 0.62,
          filter: "saturate(0.8)",
        }}
      >
        {sample}
        <Lock
          size={13}
          color={skin.c.ink}
          style={{ position: "absolute", top: 10, right: 11, opacity: 0.7 }}
        />
      </div>

      {/* LE MAGASIN, à pleine intensité et sur le papier du site. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "7px 10px",
          background: C.paperDark,
          borderTop: `1px solid ${C.line}`,
        }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>
          {t("skins.price", { price: skin.price })}
        </span>
        <BuyChip item={skin.locked!} price={skin.price ?? 0} onBought={onBought} compact />
      </div>
    </div>
  );
}

export function SkinPicker({
  skin,
  onPick,
  onClose,
}: {
  skin: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  usePurse();
  const [, again] = useState(0);
  const mine = accountOpen() ? ownedItems() : [];

  /* Une peau achetée doit apparaître déverrouillée SANS RECHARGER : ce
     qu'on possède vit en mémoire locale, rafraîchie depuis le serveur,
     et ce compteur force la grille à se redessiner ensuite. */
  const reread = () => {
    void refreshOwned().then(() => again((n: number) => n + 1));
  };

  /* VERROUILLÉES PARTOUT, Y COMPRIS SANS SERVEUR — et c'est délibéré.

     J'avais posé l'exception inverse : hors ligne, tout libre, pour ne
     rien retirer à qui n'a pas de compte. Le produit a tranché
     autrement, et l'argument se tient : ces seize peaux SE VOIENT, avec
     leur prix, sur un classeur qui n'a jamais parlé à un serveur. C'est
     la seule chose de tout le projet qui donne une raison d'en ouvrir
     un, et une vitrine cachée n'attire personne.

     Ce que cela ne change pas : le classeur MARCHE entier sans compte.
     On range, on note, on cherche, on importe, on exporte. Ce qu'on n'a
     pas, c'est le choix de la robe — et on voit exactement laquelle,
     et à quel prix. */
  const isLocked = (s: Skin) => !!s.locked && !mine.includes(s.locked) && s.key !== DEFAULT_SKIN;

  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div style={PANEL}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            PEAU DU SITE
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Fermer le choix des peaux"
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
            <X size={13} />
          </button>
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
            marginBottom: 10,
          }}
        >
          elle change tout — le fond, les couleurs, les polices, les onglets
        </div>

        {/* CE QU'ON NE PEUT PAS AVOIR N'EST PAS DESSINÉ.

            Une peau verrouillée qu'on n'a pas achetée n'apparaît pas —
            pas grisée, pas barrée, pas accompagnée d'un prix. C'est la
            règle de tout ce qui dépend du dehors dans ce classeur, et
            elle vaut ici plus qu'ailleurs : sans compte, la grille doit
            être exactement celle qu'elle a toujours été, quatorze peaux
            et rien qui laisse deviner qu'il en existe d'autres.

            Le filtre est ICI et non dans `applySkin`, qui continue de
            servir sans poser de question la peau qu'on lui demande. Une
            peau achetée puis le réseau coupé reste appliquée : la clé
            est en mémoire locale, et le classeur ne se déguise pas tout
            seul au rechargement. */}
        {SKINS.map((s) => (
          <SkinCard
            key={s.key}
            skin={s}
            on={s.key === skin}
            locked={isLocked(s)}
            onBought={reread}
            onPick={() => onPick(s.key)}
          />
        ))}

        {/* What the skin does not touch, said once rather than never:
            the user who painted their cards must know why they do not
            follow. */}
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 13.5,
            color: C.inkFaded,
            marginTop: 12,
            borderTop: `1px solid ${C.line}`,
            paddingTop: 8,
          }}
        >
          vos cartons et le décor de vos étagères gardent leurs couleurs : ce sont vos choix, pas
          l&apos;habillage du site
        </div>
      </div>
    </>
  );
}
