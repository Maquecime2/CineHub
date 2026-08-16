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
import { bare, chip, inked } from "../theme/styles";
import { Guideline, Label, Trouble, ViewHeading, Waiting } from "../components/ui";
import { Layer } from "../components/ui/Layer";
import { useSay } from "../components/ui/Feedback";
import { CoffeeRing, StampCorner } from "../components/atmosphere";
import { Halftone, Stamp, glass, perforated, velvet } from "../components/atmosphere/hall";
import { Purse } from "../components/play/Purse";
import { Ladder } from "../components/play/Ladder";
import { Collection, RARITY_INK } from "../components/play/Collection";
import { STAMP_INK, stampLabel } from "../components/play/stamps";
import { WonDraw } from "../components/shelf/WonDraw";
import { WON_PREFIX } from "../services/wonDecor";
import { priceGap, RATE } from "../domain/points";
import { hash, pickFrom, tiltOf } from "../domain/seeded";
import { SKINS, skinOf } from "../theme/skins";
import { loadSkinKey } from "../theme/applySkin";
import { paperLayer } from "../theme/surfaces";
import { PackStudio } from "./counter/PackStudio";
import { usePurse, refreshPurse } from "../hooks/usePurse";
import { stall } from "../hooks/useHall";
import { Moderation } from "../components/play/Moderation";
import { HallWindow } from "../components/layout/HallWindow";
import {
  buy,
  iAmAdmin,
  ladder as readLadder,
  serverConfigured,
  sell as sellBack,
  wear,
  type Holdings,
  type Rank,
  type ShopItem,
  type DecorDef,
  type Wearable,
} from "../services/server";

/** Les quatre familles qu'on porte. Recopié du serveur, qui décide. */
const WEARABLE: readonly Wearable[] = ["stamp", "skin", "paper", "title"];
const isWearable = (k: string): boolean => (WEARABLE as readonly string[]).includes(k);

/* LE CATALOGUE DES VIGNETTES N'EST PLUS RECOPIÉ ICI. Il l'était pour
   dessiner les cases VIDES — ce qui manque n'est dans aucune réponse,
   par définition — et onze lignes en dur suffisaient tant qu'il y avait
   onze vignettes. Elles se créent maintenant depuis le studio, donc la
   liste complète arrive avec l'étal (`stall`), et une case vide se
   dessine à partir de ce que le serveur DIT exister plutôt qu'à partir
   de ce que ce fichier croyait savoir. */

export function CounterView({
  connected,
  onGo,
}: {
  connected: boolean;
  /** Pour aller gagner ce qui manque : le comptoir ne navigue pas seul. */
  onGo?: (view: "quiz" | "lists") => void;
}) {
  const { t } = useTranslation();
  const say = useSay();
  const purse = usePurse(connected);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [decors, setDecors] = useState<DecorDef[]>([]);
  const [held, setHeld] = useState<Holdings | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [scope, setScope] = useState<"world" | "friends">("friends");
  const [opening, setOpening] = useState<string[] | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  /* L'ARTICLE EN COURS D'ACHAT, ET CELUI QUI VIENT DE L'ÊTRE. Le premier
     désarme le bouton — `take` est asynchrone, et deux clics rapides
     partaient deux fois ; le serveur refusait le doublon, mais l'écran
     ne disait rien pendant ce temps. Le second fait tomber le tampon
     d'encaissement, puis s'efface tout seul. */
  const [busy, setBusy] = useState<string | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const [studio, setStudio] = useState(false);

  /* Servi de mémoire à l'entrée, redemandé après un geste : voir
     `hooks/useHall`. Un achat passe par `reread`, donc par `refresh`. */
  const show = useCallback(
    (d: { items: ShopItem[]; decors: DecorDef[]; held: Holdings | null }) => {
      setItems(d.items);
      setDecors(d.decors);
      setHeld(d.held);
      setLoading(false);
    },
    []
  );

  const reread = useCallback(async () => {
    if (!connected) return;
    show(await stall.refresh());
  }, [connected, show]);

  useEffect(() => {
    if (!connected) return;
    stall
      .load()
      .then(show)
      /* PLUS AVALÉ. Un `catch` vide laissait un présentoir vide et muet :
         « il n'y a rien » et « on n'a pas pu demander » se ressemblent
         beaucoup trop à l'écran pour qu'on les confonde. */
      .catch((e: Error) => {
        setTrouble(e.message);
        setLoading(false);
      });
  }, [connected, show]);

  /* Le tampon d'encaissement ne reste pas : il dit « c'est fait » et
     s'en va. La durée suit les jetons de mouvement, donc le réglage
     « moins d'animations » l'écourte avec le reste. */
  useEffect(() => {
    if (!bought) return;
    const gone = setTimeout(() => setBought(null), 1400);
    return () => clearTimeout(gone);
  }, [bought]);

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

  const take = async (item: ShopItem) => {
    /* LA GARDE EST ICI ET PAS SEULEMENT AU SERVEUR. Le serveur refuse
       bien le doublon d'un article unique, mais une pochette s'achète
       autant de fois qu'on veut : deux clics rapides étaient deux
       pochettes payées, et la seconde arrivait sans qu'on l'ait
       demandée. */
    if (busy) return;
    setBusy(item.id);
    setTrouble(null);
    try {
      const got = await buy(item.id);
      await refreshPurse();
      await reread();
      /* Une pochette s'ouvre ; le reste se range, avec un tampon. */
      if (got.drawn.length > 0) setOpening(got.drawn);
      else setBought(item.id);
    } catch (e) {
      setTrouble((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /* Rendre : le serveur refuse à qui n'a pas le rôle, et cet écran ne
     fait que ne pas dessiner le bouton. Les deux disent la même chose,
     et c'est le serveur qui décide. */
  const give = async (item: ShopItem) => {
    setTrouble(null);
    try {
      await sellBack(item.id);
      await refreshPurse();
      await reread();
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  /* ON ENVOIE L'IDENTIFIANT DE L'ARTICLE, y compris pour une peau, dont
     le serveur range la clé. L'inverse était le comportement, et il
     était faux : la possession se vérifie sur `owned`, qui ne contient
     que des articles — porter une peau achetée répondait 403, toujours,
     et aucun écran ne le disait puisque le refus était silencieux. */
  const put = async (what: Wearable, id: string | null) => {
    setTrouble(null);
    try {
      await wear({ [what]: id });
      await reread();
      /* PORTER UNE PEAU OU UN PAPIER NE SE VOIT PAS TOUJOURS TOUT DE
         SUITE : le fond de page change dans le dos de la personne, qui
         regarde une carte au milieu de l'étal. On le dit. */
      say(t(id ? "counter.shop.nowWorn" : "counter.shop.nowBare"));
      /* La peau et le papier se portent SUR-LE-CHAMP : les garder en
         mémoire locale est ce qui les applique au premier rendu, hors
         ligne compris. */
      await refreshPurse();
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

      {loading ? (
        <div style={{ marginTop: 30 }}>
          <Label>{t("counter.shop.title")}</Label>
          <Waiting lines={4} />
        </div>
      ) : (
        <Shelf
          items={items}
          decors={decors}
          tokens={purse?.tokens ?? 0}
          worn={held?.worn ?? {}}
          onBuy={take}
          onWear={put}
          onSell={give}
          busy={busy}
          bought={bought}
          trouble={trouble}
          onEarn={(where) => onGo?.(where)}
        />
      )}

      <div style={{ marginTop: 30 }}>
        {loading ? (
          <Waiting lines={3} />
        ) : (
          <Collection all={decors} held={held?.decors ?? []} tour="counter-album" />
        )}
      </div>

      {/* LE BUREAU DE MODÉRATION, EN DERNIER ET SOUS CONDITION. Il n'a
          rien à faire dans la lecture ordinaire d'un comptoir : c'est du
          travail, pas un plaisir. Il vient donc après l'album, et
          seulement pour qui porte le rôle. */}
      {iAmAdmin() && (
        <>
          <Moderation />
          <div style={{ marginTop: 18 }} data-tour="counter-studio">
            <button onClick={() => setStudio(true)} style={{ ...inked(C.slate), fontSize: 10 }}>
              {t("counter.studio.open")}
            </button>
          </div>
          {studio && (
            <PackStudio
              onClose={() => {
                setStudio(false);
                void reread();
              }}
            />
          )}
        </>
      )}

      {opening && <Packet drawn={opening} decors={decors} onClose={() => setOpening(null)} />}
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

/* L'ORDRE DES RANGÉES EST UN ORDRE DE PRIX ET DE VISIBILITÉ. Ce qu'on
   porte devant soi d'abord — tampon, titre —, ce qui habille la page
   ensuite, ce qui se joue en dernier. `pack` vient de la base et non du
   code, mais il a sa rangée comme les autres. */
const FAMILIES = ["stamp", "title", "paper", "skin", "pack", "power"] as const;

/** Les trois filtres de l'étal. Un mot chacun, pas une couleur. */
type Sift = "all" | "afford" | "mine";

function Shelf({
  items,
  decors,
  tokens,
  worn,
  onBuy,
  onWear,
  onSell,
  busy,
  bought,
  trouble,
  onEarn,
}: {
  items: ShopItem[];
  decors: DecorDef[];
  tokens: number;
  worn: Partial<Record<Wearable, string | null>>;
  onBuy: (i: ShopItem) => void;
  onWear: (what: Wearable, id: string | null) => void;
  onSell: (i: ShopItem) => void;
  busy: string | null;
  bought: string | null;
  trouble: string | null;
  onEarn: (where: "quiz" | "lists") => void;
}) {
  const { t } = useTranslation();
  const [sift, setSift] = useState<Sift>("all");
  const [dear, setDear] = useState(false);

  const keep = (i: ShopItem) =>
    sift === "all" ||
    (sift === "mine"
      ? !!i.owned || (i.held ?? 0) > 0
      : !i.owned && priceGap(i.price, tokens) === 0);

  const shown = items.filter(keep);

  /* LA VITRINE : CE QU'ON PEUT S'OFFRIR MAINTENANT, ET DE PLUS CHER.
     Elle ne met pas en avant ce qui rapporte le plus au comptoir — il n'y
     a rien à vendre ici — mais ce que la bourse permet DÉJÀ, ce qui est
     la seule information qu'on vient chercher en arrivant. Vide, elle ne
     s'affiche pas : une vitrine qui dit « rien pour vous » est pire
     qu'une vitrine absente. */
  const window = [...items]
    .filter((i) => !i.owned && priceGap(i.price, tokens) === 0)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3);

  const card = (i: ShopItem, big = false) => (
    <Article
      key={`${big ? "vitrine-" : ""}${i.id}`}
      item={i}
      big={big}
      decors={decors}
      tokens={tokens}
      worn={worn}
      busy={busy === i.id}
      justBought={bought === i.id}
      onBuy={onBuy}
      onWear={onWear}
      onSell={onSell}
      onEarn={onEarn}
    />
  );

  return (
    <div data-tour="counter-shop" style={{ marginTop: 30 }}>
      <Label>{t("counter.shop.title")}</Label>

      {sift === "all" && window.length > 0 && (
        <div data-tour="counter-window" style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 16,
              color: C.inkFaded,
              marginBottom: 6,
            }}
          >
            {t("counter.shop.window")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {window.map((i) => card(i, true))}
          </div>
        </div>
      )}

      {/* LE TRI ET LE FILTRE, EN PASTILLES DE PAPIER. `chip` existe déjà
          et sert partout ailleurs : un troisième dessin de bouton pour
          trois boutons de plus aurait été un dialecte de plus. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {(["all", "afford", "mine"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSift(k)}
            aria-pressed={sift === k}
            style={{
              ...chip,
              ...(sift === k ? { background: alpha(C.ochre, 0.28), borderColor: C.ochre } : null),
            }}
          >
            {t(`counter.shop.sift.${k}`)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => setDear((d) => !d)} style={chip}>
          {t(dear ? "counter.shop.sort.dear" : "counter.shop.sort.cheap")}
        </button>
      </div>

      <div style={{ position: "relative", ...velvet(), padding: "6px 14px 16px" }}>
        <Halftone />
        {FAMILIES.map((family) => {
          const row = shown
            .filter((i) => i.kind === family)
            .sort((a, b) => (dear ? b.price - a.price : a.price - b.price));
          if (row.length === 0) return null;
          return (
            <div key={family} style={{ position: "relative", paddingTop: 14 }}>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 9.5,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: C.inkFaded,
                  marginBottom: 8,
                }}
              >
                {t(`counter.shop.rows.${family}`)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {row.map((i) => card(i))}
              </div>
              {/* La tablette : un liseré clair, comme un rebord éclairé. */}
              <div
                style={{
                  height: 1,
                  marginTop: 14,
                  background: alpha(C.ink, 0.12),
                }}
              />
            </div>
          );
        })}
        {shown.length === 0 && (
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 16,
              color: C.inkFaded,
              padding: "18px 2px 8px",
            }}
          >
            {t(`counter.shop.nothing.${sift}`)}
          </div>
        )}
        <div style={{ ...glass }} />
      </div>
      {trouble && <Trouble>{trouble}</Trouble>}
    </div>
  );
}

function Article({
  item,
  big = false,
  decors,
  tokens,
  worn,
  busy,
  justBought,
  onBuy,
  onWear,
  onSell,
  onEarn,
}: {
  item: ShopItem;
  big?: boolean;
  decors: DecorDef[];
  tokens: number;
  worn: Partial<Record<Wearable, string | null>>;
  busy: boolean;
  justBought: boolean;
  onBuy: (i: ShopItem) => void;
  onWear: (what: Wearable, id: string | null) => void;
  onSell: (i: ShopItem) => void;
  onEarn: (where: "quiz" | "lists") => void;
}) {
  const { t, i18n } = useTranslation();
  const missing = priceGap(item.price, tokens);
  const wearable = isWearable(item.kind);
  /* CE QU'ON PORTE SE COMPARE DE DEUX FAÇONS, et c'est la seule
     irrégularité du lot : une peau range sa CLÉ, les trois autres
     rangent l'identifiant de l'article. Le sélecteur de peaux compare
     des clés, et il a raison — il s'ouvre sans réseau. */
  const on = wearable
    ? worn[item.kind as Wearable] === (item.kind === "skin" ? item.grants : item.id)
    : false;

  /* CE QU'ON PEUT RENDRE. Un achat ordinaire est définitif — c'est ce
     qui donne son poids au geste — mais reprendre la boutique article
     par article demande de pouvoir défaire. D'où ce bouton, qui n'existe
     que pour le rôle, et le rôle ne s'obtient que par l'environnement du
     déploiement.

     Une pochette n'y figure pas : elle ne se possède pas, elle se
     rachète autant qu'on veut. */
  const returnable = iAmAdmin() && (item.owned || (item.held ?? 0) > 0);

  return (
    <div
      style={{
        position: "relative",
        width: big ? 214 : 148,
        padding: big ? "14px 15px 15px" : "10px 11px 11px",
        background: C.card,
        border: `1px solid ${big ? alpha(C.ochre, 0.55) : C.line}`,
        boxShadow: big
          ? `2px 4px 12px rgba(20,14,8,0.34), 0 0 0 3px ${alpha(C.ochre, 0.14)}`
          : "2px 3px 7px rgba(20,14,8,0.3)",
        transform: `rotate(${tiltOf(item.id)}deg)`,
        opacity: busy ? 0.6 : 1,
        transition: "opacity var(--motion-fast) var(--motion-ease)",
      }}
    >
      {item.owned && <StampCorner text={t("counter.shop.owned")} />}

      {/* LE TAMPON D'ENCAISSEMENT — un MOMENT, donc les effets chers y
          sont permis, contrairement aux rangées qui défilent. Il
          s'abat une fois, à l'achat, et disparaît de lui-même : il dit
          « c'est fait » là où l'écran ne disait rien du tout. */}
      {justBought && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            pointerEvents: "none",
            animation: "sheetIn var(--motion-fast) var(--motion-ease) backwards",
          }}
        >
          <Stamp text={t("counter.shop.paid")} ink={C.pine} tilt={-11} />
        </div>
      )}

      <div
        style={{
          height: big ? 76 : 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Preview item={item} decors={decors} big={big} />
      </div>

      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontSize: big ? 17 : 14,
          color: C.ink,
          marginTop: 4,
          minHeight: 34,
        }}
      >
        {nameOfItem(item, t, i18n.language)}
      </div>

      {item.owned && wearable ? (
        <button
          onClick={() => onWear(item.kind as Wearable, on ? null : item.id)}
          style={{ ...bare, fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: C.pine }}
        >
          {on ? t("counter.shop.takeOff") : t("counter.shop.wear")}
        </button>
      ) : missing > 0 ? (
        /* LE MANQUE EST NOMMÉ, l'article reste sur l'étal — ET ON DIT
           MAINTENANT PAR OÙ LE COMBLER. « Il vous manque douze jetons »
           était vrai et sans issue : rien sur cet écran ne dit qu'un
           quiz sans faute en rapporte quinze. */
        <div>
          <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
            {t("counter.shop.short", { count: missing })}
          </div>
          <Earn missing={missing} onEarn={onEarn} />
        </div>
      ) : (
        <button
          onClick={() => onBuy(item)}
          disabled={busy}
          style={{ ...inked(C.ochre), fontSize: big ? 11 : 9.5, cursor: busy ? "wait" : "pointer" }}
        >
          {t(busy ? "counter.shop.buying" : "counter.shop.buy", { price: item.price })}
        </button>
      )}

      {item.kind === "power" && (item.held ?? 0) > 0 && (
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 4 }}>
          ×{item.held}
        </div>
      )}

      {returnable && (
        <button
          onClick={() => onSell(item)}
          title={t("counter.shop.sellNote")}
          style={{
            ...bare,
            display: "block",
            marginTop: 5,
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 1,
            color: C.burgundy,
            borderBottom: `1px dotted ${alpha(C.burgundy, 0.5)}`,
          }}
        >
          {t("counter.shop.sell", { price: item.price })}
        </button>
      )}
    </div>
  );
}

/**
 * LE NOM D'UN ARTICLE VIENT DE TROIS ENDROITS, ET L'ORDRE COMPTE.
 *
 * Une peau a déjà un nom, dans `skins.<clé>.label` — celui que le
 * sélecteur affiche ; lui en écrire un second sous `counter.items`
 * aurait été deux vérités pour une chose.
 *
 * Une pochette porte le sien DANS LA BASE : elle est écrite après la
 * compilation, aucune clé de traduction ne peut l'attendre.
 *
 * Le reste est du catalogue en dur, donc traduit comme le reste.
 */
function nameOfItem(item: ShopItem, t: (k: string) => string, lang: string): string {
  if (item.kind === "skin" && item.grants) return t(`skins.${item.grants}.label`);
  if (item.label) return lang.startsWith("en") ? item.label.en : item.label.fr;
  return t(`counter.items.${item.id}`);
}

/* ------------------------------------------------------------
   PAR OÙ COMBLER LE MANQUE
   ------------------------------------------------------------
   Le barème est une copie d'affichage (`domain/points`), et c'est
   exactement l'usage pour lequel elle existe : dire ce qu'une chose
   vaut AVANT de l'avoir faite, sans aller-retour. Elle ne crédite
   rien. */
function Earn({ missing, onEarn }: { missing: number; onEarn: (w: "quiz" | "lists") => void }) {
  const { t } = useTranslation();
  /* Le geste le plus rentable d'abord, mais pas au-delà du nécessaire :
     proposer un défi à trente quand il manque trois jetons est un
     conseil qui ne sert personne. */
  const gesture =
    missing > RATE.quiz_flawless
      ? { key: "challenge", worth: RATE.challenge, where: "lists" as const }
      : { key: "quiz_flawless", worth: RATE.quiz_flawless, where: "quiz" as const };

  return (
    <button
      onClick={() => onEarn(gesture.where)}
      style={{
        ...bare,
        display: "block",
        marginTop: 3,
        fontFamily: F.mono,
        fontSize: 9,
        letterSpacing: 0.8,
        color: C.pine,
        borderBottom: `1px dotted ${alpha(C.pine, 0.5)}`,
      }}
    >
      {t(`counter.shop.earn.${gesture.key}`, { worth: gesture.worth })}
    </button>
  );
}

/** Ce qu'on voit de l'article avant de l'acheter. */
function Preview({ item, decors, big }: { item: ShopItem; decors: DecorDef[]; big?: boolean }) {
  const { t } = useTranslation();
  if (item.kind === "stamp") {
    return <Stamp text={t(stampLabel(item.id))} ink={STAMP_INK[item.id] ?? C.burgundy} tilt={-7} />;
  }
  if (item.kind === "pack") return <PackPreview item={item} decors={decors} big={big} />;
  if (item.kind === "skin") return <SkinPreview granted={item.grants} big={big} />;
  if (item.kind === "paper") return <PaperPreview id={item.id} big={big} />;
  if (item.kind === "title") return <TitlePreview id={item.id} big={big} />;
  if (item.kind === "power") return <PowerPreview power={item.power} big={big} />;
  return <div style={{ width: 40, height: 40 }} />;
}

/* UNE POCHETTE ENTROUVERTE, ET UN SEUL OBJET QUI DÉPASSE.
   ------------------------------------------------------------

   ELLE EN MONTRAIT TROIS, ET ELLE MENTAIT. L'éventail venait du temps
   où une pochette rendait trois vignettes ; elle en rend UNE, et un
   dessin qui en montre trois est une promesse qu'on ne tient pas — le
   genre de détail qu'on ne relit jamais parce qu'il a l'air décoratif.

   L'ancien dessin d'avant l'éventail cachait tout, au nom de « ce qu'il
   y a dedans ne se montre pas ». Cette règle valait quand il y avait UNE
   pochette : on savait ce qu'elle contenait. Il y en a plusieurs
   maintenant, créées à la main, et une pochette qui ne montre rien est
   une pochette qu'on n'achète pas — la surprise est dans QUEL objet
   sort, jamais dans la question de savoir si le paquet est vide.

   On montre donc le rabat, et UN objet qui dépasse, pris dans le stock
   de CETTE pochette et choisi de façon SEMÉE : la même pochette montre
   le même demain. Un étal qui gigote n'est pas un étal. */
function PackPreview({ item, decors, big }: { item: ShopItem; decors: DecorDef[]; big?: boolean }) {
  const inside = decors.filter((s) => s.packId === item.id);
  const size = big ? 44 : 32;
  const one = inside.length === 0 ? null : pickFrom(inside, hash(item.id));

  return (
    <div
      style={{
        position: "relative",
        width: size * 1.6,
        height: size * 1.55,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* L'objet dépasse du rabat, donc il est dessiné DERRIÈRE lui et
          décalé vers le haut : c'est ce chevauchement qui dit « il sort
          de là » plutôt que « il est posé devant ». */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          marginLeft: -size / 2,
          width: size,
          height: size,
          padding: 3,
          background: C.paper,
          border: `1px ${one ? "solid" : "dashed"} ${C.line}`,
          transform: "rotate(-6deg)",
          boxShadow: "1px 2px 4px rgba(30,20,10,0.2)",
        }}
      >
        {one && (
          <WonDraw
            motif={`${WON_PREFIX}${one.id}`}
            color={one.tintable ? RARITY_INK[one.rarity] : undefined}
          />
        )}
      </div>

      {/* Le rabat de la pochette, par-dessus le bas de l'objet. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: size * 0.78,
          background: `linear-gradient(170deg, ${C.paperDark}, ${C.card})`,
          border: `1px solid ${C.line}`,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            top: 5,
            height: 1,
            background: alpha(C.ink, 0.18),
          }}
        />
      </div>
    </div>
  );
}

/* L'ENCRE, RÉSOLUE, ET PRISE AU CATALOGUE PLUTÔT QU'AU DOCUMENT.
   Un papier part dans une URL de données : un `var()` écrit dans un SVG
   embarqué ne résout rien, il n'a pas la racine du document pour parent.
   On lit donc la peau EN COURS dans son catalogue — pas les variables
   posées sur la racine, qui obligeraient à un `getComputedStyle` que les
   tests n'ont pas. */
const resolvedInk = (): string => skinOf(loadSkinKey()).c.ink ?? "#6E6153";

/** UN PAPIER SE MONTRE À L'ENCRE DU THÈME EN COURS, comme il s'appliquera. */
function PaperPreview({ id, big }: { id: string; big?: boolean }) {
  const layer = paperLayer(id, resolvedInk());
  return (
    <div
      style={{
        width: big ? 118 : 84,
        height: big ? 62 : 46,
        background: C.paper,
        border: `1px solid ${C.line}`,
        boxShadow: `inset 0 0 12px ${alpha(C.ink, 0.08)}`,
        ...layer,
      }}
    />
  );
}

/** UN TITRE SE LIT. C'est ce qui le distingue d'un tampon, donc on l'écrit. */
function TitlePreview({ id, big }: { id: string; big?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        padding: "4px 10px",
        border: `1px solid ${alpha(C.slate, 0.6)}`,
        borderRadius: "var(--tag-radius)",
        background: alpha(C.slate, 0.1),
        fontFamily: F.title,
        fontSize: big ? 15 : 12,
        letterSpacing: 0.6,
        color: C.slate,
        whiteSpace: "nowrap",
      }}
    >
      {t(`counter.items.${id}`)}
    </div>
  );
}

/* CHAQUE POUVOIR SON PICTOGRAMME.
   ------------------------------------------------------------
   Ils partageaient tous la vignette du clap, par défaut d'une branche —
   trois articles impossibles à distinguer sur l'étal, et deux de plus
   depuis. Cinq dessins, du même trait que les vignettes : un même carré,
   une même épaisseur, des bouts ronds. */
const POWER_DRAW: Record<string, string> = {
  halve: "M22 50 H46 M54 34 H78 M54 50 H78 M54 66 H78 M26 34 L42 66 M42 34 L26 66",
  redo: "M76 44 A26 26 0 1 0 70 68 M76 26 V46 H56",
  extend: "M20 50 H74 M60 34 L78 50 L60 66 M26 30 V70",
  double: "M28 68 L44 32 L60 68 M34 56 H54 M70 32 V68 M62 40 L70 32 L78 40",
  "second-wind": "M24 58 A26 26 0 1 1 34 74 M24 40 V60 H44 M52 44 V54 M66 40 V58",
};

function PowerPreview({ power, big }: { power?: string; big?: boolean }) {
  const d = POWER_DRAW[power ?? ""];
  const side = big ? 56 : 42;
  if (!d) return <div style={{ width: side, height: side }} />;
  return (
    <svg
      viewBox="0 0 100 100"
      width={side}
      height={side}
      fill="none"
      stroke={C.cobalt}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="50" cy="50" r="42" fill={alpha(C.cobalt, 0.08)} stroke="none" />
      <path d={d} />
    </svg>
  );
}

/* CE QU'UNE PEAU DONNE À VOIR, EN PETIT.

   ON LIT LES VALEURS DE LA PEAU, PAS CELLES DU DOCUMENT. C'est la même
   règle que le sélecteur de peaux — et elle est écrite là-bas parce que
   l'oublier rend toutes les vignettes identiques. Ici c'était pire : la
   vignette montrait la peau EN PLACE, donc les trois articles se
   ressemblaient, et se ressemblaient d'autant plus qu'ils ressemblaient
   à l'écran qu'on avait déjà sous les yeux. On achetait à l'aveugle.

   Son fond, son titre dans SA fonte, et les six teintes qui portent
   l'identité. La fonte n'est pas encore chargée tant que la peau n'est
   pas appliquée — le navigateur retombe sur la famille de repli, et le
   dégradé plus les six pastilles suffisent à distinguer un nitrate d'un
   drive-in. */
function SkinPreview({ granted, big }: { granted?: string; big?: boolean }) {
  const skin = SKINS.find((s) => s.key === granted);
  if (!skin) return <div style={{ width: 46, height: 40 }} />;
  return (
    <div
      style={{
        width: big ? 132 : 92,
        height: big ? 72 : 50,
        padding: "5px 6px",
        boxSizing: "border-box",
        background: skin.page,
        border: `1px solid ${alpha(skin.c.ink!, 0.35)}`,
        borderRadius: skin.tag.radius,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: skin.fonts.title,
          fontSize: 11,
          lineHeight: 1.1,
          color: skin.c.ink,
          letterSpacing: skin.tag.tracking,
          textTransform: skin.tag.transform as never,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        Aa
      </div>
      <div style={{ display: "flex", gap: 2.5, marginTop: 5 }}>
        {["burgundy", "ochre", "pine", "slate", "cobalt", "vermillion"].map((k) => (
          <span
            key={k}
            style={{
              width: 11,
              height: 11,
              borderRadius: skin.tag.radius,
              background: skin.c[k],
              border: `1px solid ${alpha(skin.c.ink!, 0.2)}`,
            }}
          />
        ))}
      </div>
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

function Packet({
  drawn,
  decors,
  onClose,
}: {
  drawn: string[];
  decors: DecorDef[];
  onClose: () => void;
}) {
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

          {/* UNE POCHETTE VIDE SE DIT. Elle est possible depuis qu'un
              administrateur peut en créer une et oublier de la garnir :
              un cadre vide sans un mot se lirait comme un achat perdu. */}
          {drawn.length === 0 && (
            <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 10 }}>
              {t("counter.album.emptyPack")}
            </div>
          )}

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
                <WonDraw
                  motif={`${WON_PREFIX}${id}`}
                  color={
                    decors.find((s) => s.id === id)?.tintable === false
                      ? undefined
                      : RARITY_INK[decors.find((s) => s.id === id)?.rarity ?? "common"]
                  }
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
