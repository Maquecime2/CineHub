/* ============================================================
   LE COMPTOIR — le guichet, le présentoir, le carnet à souches
   ============================================================

   LE HALL OÙ L'ON SE RETROUVE AVANT LA SÉANCE. Le classeur est un carnet
   d'archiviste ; cette vue-ci est l'endroit où l'on croise les autres, et
   elle en emprunte les objets — un ticket, une vitrine, une affiche
   collée sur la vitre, un album à souches.

   ELLE NE S'AFFICHE PAS SANS COMPTE, et pas non plus sans serveur. Ce
   n'est pas une restriction à contourner : sans compte il n'y a personne
   à qui se comparer et personne à qui montrer un tampon. L'onglet
   lui-même n'existe pas dans le rail — `needsServer` s'en charge — et
   cette page dit la phrase qui manque plutôt que d'offrir des boutons
   morts.

   TROIS BANDES, ET ELLES NE SE VALENT PAS. Le guichet en premier parce
   qu'on vient ici pour savoir ce qu'on a ; le palmarès ensuite, qui est
   la conséquence ; la boutique et l'album en dernier, qui sont ce qu'on
   fait de tout ça.

   L'OUVERTURE D'UNE POCHETTE EST LE SEUL MOMENT MODAL de la vue, et il
   passe par `<Layer>` : un `position: fixed` rendu dans la colonne
   s'ancrerait sur elle et non sur la fenêtre, parce que `[data-enters]`
   est un contexte d'empilement transformé. C'est écrit dans CLAUDE.md et
   c'est déjà arrivé.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Coins } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { bare, inked } from "../theme/styles";
import { Guideline, Label, ViewHeading } from "../components/ui";
import { Layer } from "../components/ui/Layer";
import { CoffeeRing, StampCorner } from "../components/atmosphere";
import { Halftone, Stamp, glass, perforated, velvet } from "../components/atmosphere/hall";
import { Purse } from "../components/play/Purse";
import { Ladder } from "../components/play/Ladder";
import { StickerSheet } from "../components/play/StickerSheet";
import { STAMP_INK, stampLabel } from "../components/play/stamps";
import { StickerArt } from "../components/play/stickers";
import { priceGap } from "../domain/points";
import { tiltOf } from "../domain/seeded";
import { usePurse, refreshPurse } from "../hooks/usePurse";
import {
  buy,
  ladder as readLadder,
  myHoldings,
  serverConfigured,
  shop as readShop,
  wear,
  type Holdings,
  type Rank,
  type ShopItem,
} from "../services/server";

/* Le catalogue des vignettes, tel que le serveur le connaît. Il est
   recopié ici pour dessiner les cases VIDES : la planche doit montrer ce
   qui manque, or ce qui manque n'est dans aucune réponse — par
   définition, on ne le possède pas. */
const ALL_STICKERS = [
  { id: "vig-projecteur", rarity: "common" },
  { id: "vig-fauteuil", rarity: "common" },
  { id: "vig-bobine", rarity: "common" },
  { id: "vig-ticket", rarity: "common" },
  { id: "vig-esquimau", rarity: "common" },
  { id: "vig-rideau", rarity: "common" },
  { id: "vig-clap", rarity: "rare" },
  { id: "vig-cadran", rarity: "rare" },
  { id: "vig-lanterne", rarity: "rare" },
  { id: "vig-palme", rarity: "gold" },
  { id: "vig-nitrate", rarity: "gold" },
] as const;

export function CounterView({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  const purse = usePurse(connected);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [held, setHeld] = useState<Holdings | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [scope, setScope] = useState<"world" | "friends">("friends");
  const [opening, setOpening] = useState<string[] | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const reread = useCallback(async () => {
    if (!connected) return;
    const [shopItems, holdings] = await Promise.all([readShop(), myHoldings()]);
    setItems(shopItems);
    setHeld(holdings);
  }, [connected]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  /* Le palmarès se relit à chaque changement d'onglet, et pas une fois
     pour toutes : deux tableaux gardés en mémoire seraient deux chiffres
     qui vieillissent en silence. */
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    readLadder(scope)
      .then((r) => alive && setRanks(r))
      .catch(() => alive && setRanks([]));
    return () => {
      alive = false;
    };
  }, [connected, scope, purse?.merit]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline tight>{t("counter.noServer")}</Guideline>
      </Page>
    );
  }
  if (!connected) {
    return (
      <Page>
        <Guideline tight>{t("counter.noAccount")}</Guideline>
      </Page>
    );
  }

  const take = async (item: ShopItem) => {
    setTrouble(null);
    try {
      const got = await buy(item.id);
      await refreshPurse();
      await reread();
      /* Une pochette s'ouvre ; un tampon se range. */
      if (got.drawn.length > 0) setOpening(got.drawn);
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  const put = async (what: "stamp" | "skin", id: string | null) => {
    setTrouble(null);
    try {
      await wear({ [what]: id });
      await reread();
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  return (
    <Page>
      {purse && <Purse purse={purse} tour="counter-purse" />}

      <div style={{ marginTop: 30 }}>
        <Ladder
          ranks={ranks}
          scope={scope}
          onScope={setScope}
          worldOpen={purse?.ladder === "tous"}
          tour="counter-ladder"
        />
        {purse?.ladder !== "tous" && <Guideline tight>{t("counter.ladder.closed")}</Guideline>}
      </div>

      <Shelf
        items={items}
        tokens={purse?.tokens ?? 0}
        worn={held?.worn ?? { stamp: null, skin: null }}
        onBuy={take}
        onWear={put}
        trouble={trouble}
      />

      <div style={{ marginTop: 30 }}>
        <StickerSheet all={ALL_STICKERS} held={held?.stickers ?? []} tour="counter-album" />
      </div>

      {opening && <Packet drawn={opening} onClose={() => setOpening(null)} />}
    </Page>
  );
}

/* ------------------------------------------------------------
   LE PRÉSENTOIR
   ------------------------------------------------------------

   Un article trop cher NE DISPARAÎT PAS de l'étal : son prix pâlit et le
   bouton NOMME le manque — « il vous manque douze jetons ». C'est ce que
   fait déjà le cartouche de la clef TMDB, et pour la même raison : un
   écran vide dit « il n'y a rien ici », pas « il vous manque quelque
   chose ». On ne sort pas d'un manque qu'on ne voit pas.
   ------------------------------------------------------------ */

const FAMILIES = ["stamp", "pack", "skin", "power"] as const;

function Shelf({
  items,
  tokens,
  worn,
  onBuy,
  onWear,
  trouble,
}: {
  items: ShopItem[];
  tokens: number;
  worn: { stamp: string | null; skin: string | null };
  onBuy: (i: ShopItem) => void;
  onWear: (what: "stamp" | "skin", id: string | null) => void;
  trouble: string | null;
}) {
  const { t } = useTranslation();

  return (
    <div data-tour="counter-shop" style={{ marginTop: 30 }}>
      <Label>{t("counter.shop.title")}</Label>
      <div style={{ position: "relative", ...velvet(), padding: "6px 14px 16px" }}>
        <Halftone />
        {FAMILIES.map((family) => {
          const row = items.filter((i) => i.kind === family);
          if (row.length === 0) return null;
          return (
            <div key={family} style={{ position: "relative", paddingTop: 14 }}>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 9.5,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: alpha(C.card, 0.75),
                  marginBottom: 8,
                }}
              >
                {t(`counter.shop.${family}`)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {row.map((i) => (
                  <Article
                    key={i.id}
                    item={i}
                    tokens={tokens}
                    worn={worn}
                    onBuy={onBuy}
                    onWear={onWear}
                  />
                ))}
              </div>
              {/* La tablette : un liseré clair, comme un rebord éclairé. */}
              <div
                style={{
                  height: 1,
                  marginTop: 14,
                  background: alpha(C.card, 0.18),
                }}
              />
            </div>
          );
        })}
        <div style={{ ...glass }} />
      </div>
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 6 }}>
          {trouble}
        </div>
      )}
    </div>
  );
}

function Article({
  item,
  tokens,
  worn,
  onBuy,
  onWear,
}: {
  item: ShopItem;
  tokens: number;
  worn: { stamp: string | null; skin: string | null };
  onBuy: (i: ShopItem) => void;
  onWear: (what: "stamp" | "skin", id: string | null) => void;
}) {
  const { t } = useTranslation();
  const missing = priceGap(item.price, tokens);
  const wearable = item.kind === "stamp" || item.kind === "skin";
  const on =
    (item.kind === "stamp" && worn.stamp === item.id) ||
    (item.kind === "skin" && worn.skin === item.grants);

  return (
    <div
      style={{
        position: "relative",
        width: 132,
        padding: "10px 11px 11px",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 3px 7px rgba(20,14,8,0.3)",
        transform: `rotate(${tiltOf(item.id)}deg)`,
      }}
    >
      {item.owned && <StampCorner text={t("counter.shop.owned")} />}

      <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Preview item={item} />
      </div>

      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontSize: 14,
          color: C.ink,
          marginTop: 4,
          minHeight: 34,
        }}
      >
        {t(`counter.items.${item.id}`)}
      </div>

      {item.owned && wearable ? (
        <button
          onClick={() =>
            onWear(item.kind as "stamp" | "skin", on ? null : (item.grants ?? item.id))
          }
          style={{ ...bare, fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.pine }}
        >
          {on ? t("counter.shop.takeOff") : t("counter.shop.wear")}
        </button>
      ) : missing > 0 ? (
        /* LE MANQUE EST NOMMÉ, l'article reste sur l'étal. */
        <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
          {t("counter.shop.short", { count: missing })}
        </div>
      ) : (
        <button onClick={() => onBuy(item)} style={{ ...inked(C.ochre), fontSize: 9.5 }}>
          {t("counter.shop.buy", { price: item.price })}
        </button>
      )}

      {item.kind === "power" && (item.held ?? 0) > 0 && (
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 4 }}>
          ×{item.held}
        </div>
      )}
    </div>
  );
}

/** Ce qu'on voit de l'article avant de l'acheter. */
function Preview({ item }: { item: ShopItem }) {
  const { t } = useTranslation();
  if (item.kind === "stamp") {
    return <Stamp text={t(stampLabel(item.id))} ink={STAMP_INK[item.id] ?? C.burgundy} tilt={-7} />;
  }
  if (item.kind === "pack") {
    /* Trois cartes de dos : ce qu'il y a dedans ne se montre pas. */
    return (
      <div style={{ position: "relative", width: 46, height: 46 }}>
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            style={{
              position: "absolute",
              inset: 0,
              left: n * 6,
              top: n * -2,
              background: C.paperDark,
              border: `1px solid ${C.line}`,
              transform: `rotate(${n * 4 - 4}deg)`,
            }}
          />
        ))}
      </div>
    );
  }
  if (item.kind === "skin") {
    return (
      <div
        style={{
          width: 46,
          height: 40,
          border: `1px solid ${C.line}`,
          background: `linear-gradient(140deg, ${C.paper}, ${C.paperDark} 55%, ${C.ochre})`,
        }}
      />
    );
  }
  return (
    <div style={{ width: 40, height: 40, opacity: 0.75 }}>
      <StickerArt id="vig-clap" rarity="rare" />
    </div>
  );
}

/* ------------------------------------------------------------
   L'OUVERTURE D'UNE POCHETTE — le seul moment modal
   ------------------------------------------------------------

   ET LE HASARD EST DÉJÀ TOMBÉ. Les vignettes sont en base avant que
   cette couche ne s'affiche : recharger la page ne rejoue rien, et c'est
   ce qui distingue une pochette d'une machine à sous.

   Elle passe par `<Layer>`, qui la rend dans le corps du document. Un
   `position: fixed` posé dans la colonne de vue s'ancrerait sur la
   colonne, parce que `[data-enters]` porte une transformation pendant
   son entrée.
   ------------------------------------------------------------ */

function Packet({ drawn, onClose }: { drawn: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Layer>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: alpha(C.ink, 0.55),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            background: C.card,
            border: `1px solid ${C.line}`,
            padding: "22px 26px 20px",
            maxWidth: 420,
            boxShadow: "4px 8px 24px rgba(20,14,8,0.4)",
          }}
        >
          <CoffeeRing style={{ right: -40, bottom: -46 }} rotate={-14} />
          <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 22, color: C.ink }}>
            {t("counter.album.opened")}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            {drawn.map((id, i) => (
              <div
                key={`${id}-${i}`}
                style={{
                  width: 84,
                  height: 84,
                  padding: 10,
                  background: C.paper,
                  border: `1px solid ${C.line}`,
                  transform: `rotate(${tiltOf(`${id}-${i}`)}deg)`,
                  boxShadow: "1px 3px 8px rgba(30,20,10,0.22)",
                  /* Les cartes sortent l'une après l'autre. Le décalage
                     est un multiple de la durée lente, donc le mouvement
                     réduit les pose toutes en même temps. */
                  animation: "slideOut var(--motion-slow) var(--motion-ease) backwards",
                  animationDelay: `calc(var(--motion-slow) * ${i * 0.6})`,
                }}
              >
                <StickerArt
                  id={id}
                  rarity={ALL_STICKERS.find((s) => s.id === id)?.rarity ?? "common"}
                />
              </div>
            ))}
          </div>

          <button onClick={onClose} style={{ ...inked(C.ink), marginTop: 18 }}>
            {t("counter.album.close")}
          </button>
        </div>
      </div>
    </Layer>
  );
}

/* ------------------------------------------------------------ */

const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <ViewHeading
      icon={<Coins size={22} color={C.ochre} />}
      title={t("counter.heading")}
      blurb={t("counter.subheading")}
    >
      {/* Le bord perforé du hall, sur toute la hauteur de la colonne :
          c'est le seul endroit du classeur qui en porte, et il dit qu'on
          a changé de pièce. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 6,
          top: 90,
          bottom: 40,
          width: 10,
          opacity: 0.5,
          ...perforated("y", { hole: C.paperDark, pitch: 18 }),
        }}
      />
      {children}
    </ViewHeading>
  );
};
