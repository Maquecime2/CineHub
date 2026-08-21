/* ============================================================
   LE STUDIO — où les objets d'étagère se fabriquent
   ============================================================

   LA SEULE PARTIE DU CATALOGUE QUI SE CRÉE SANS ÉCRIRE DE CODE. Les
   tampons, les peaux, les papiers, les titres et les pouvoirs demandent
   tous du code pour être RENDUS : une peau est quatorze couleurs et
   quatre polices, un pouvoir est une règle de partie. Un objet est une
   image et une rareté, et une pochette est un prix — il n'y a rien à
   écrire, donc rien qui justifie un déploiement.

   C'EST AUSSI LA SEULE PORTE PAR LAQUELLE UN BIBELOT ENTRE. Chacun
   déposait les siens ; ce dépôt est fermé, et les objets neufs sortent
   d'une pochette. Ce qui se crée ici finit sur les étagères des gens,
   ce qui est une raison de plus de ne pas s'y tromper.

   L'IMAGE NE PASSE PAS PAR LE SERVEUR. Le navigateur demande un ticket
   signé pour UN blob, quinze minutes, sous `bank/decor/<clé>`, puis
   envoie les octets à Azure directement. Le serveur ne reçoit que la
   CLÉ. Un serveur qui relaie des octets est un serveur qu'on peut
   remplir, et celui-ci tient sur une petite machine.

   `bank/decor/…` ET PAS `p/` NI `decor/<uuid>`, et ce n'est pas
   cosmétique : le préfixe privé prouve l'appartenance par le CHEMIN, et
   un objet de pochette doit se voir chez tout le monde. `decor/<uuid>`,
   lui, est un bibelot DÉPOSÉ par quelqu'un, dont le droit de lecture se
   demande à la base — les deux se ressemblent et ne se gardent pas
   pareil. C'est le même raisonnement que les images des questions de
   quizz, et que les affiches des douze démonstrations.

   ON RETIRE, ON N'EFFACE PAS. Un identifiant d'objet est écrit dans la
   collection de tout le monde — et sur les étagères —, un identifiant
   de pochette dans le journal des dépenses. Le studio n'a donc pas de bouton « supprimer », et son
   absence est la décision.

   IL PASSE PAR `<Layer>` : il est ouvert depuis la colonne de vue, qui
   porte une transformation pendant son animation d'entrée — un
   `position: fixed` rendu dedans s'ancrerait sur elle.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, chip, inked, underlineInput } from "../../theme/styles";
import { Label, Trouble, Waiting } from "../../components/ui";
import { Confirmation, type ConfirmRequest } from "../../components/ui/Confirmation";
import { Layer } from "../../components/ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { WonDraw } from "../../components/shelf/WonDraw";
import { WON_PREFIX } from "../../services/wonDecor";
import {
  mediaTickets,
  packCatalogue,
  retirePack,
  retireWonDecor,
  deletePack,
  deleteWonDecor,
  savePack,
  saveDecor,
  type PackDef,
  type DecorDef,
} from "../../services/server";

type Piece = DecorDef & { retired: boolean };

/* CE QU'ON ACCEPTE DE DÉPOSER. Trois types, et le SVG en fait partie :
   un bibelot est un dessin, et une image matricielle de trente pixels
   de côté est floue sur un écran dense. Il n'est pas assaini, et il n'a
   pas à l'être — il s'affiche dans une balise `img`, où le navigateur
   l'isole lui-même : ni script, ni accès au document qui l'affiche.
   C'est plus sûr qu'un nettoyage, et non moins. Voir `WonDraw`. */
const KINDS: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Un bibelot pèse quelques kilo-octets. Au-delà, c'est autre chose. */
const MAX_BYTES = 512 * 1024;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export function PackStudio({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const box = useDialog(onClose);

  const [packs, setPacks] = useState<PackDef[] | null>(null);
  const [decors, setDecors] = useState<Piece[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* EFFACER NE SE FAIT PAS D'UN CLIC. Le geste reprend la vignette à
     ceux qui l'ont tirée : il passe par la carte de confirmation du
     projet, en `severe`, comme la suppression d'une fiche. */
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const reread = useCallback(async () => {
    try {
      const got = await packCatalogue();
      setPacks(got.packs);
      setDecors(got.decors);
      setTrouble(null);
    } catch (e) {
      setPacks([]);
      setTrouble((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reread();
  }, [reread]);

  const guard = async (run: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      await run();
      await reread();
    } catch (e) {
      setTrouble((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layer>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: alpha(C.ink, 0.55),
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: 20,
          overflowY: "auto",
        }}
        onClick={onClose}
      >
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={t("counter.studio.title")}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(720px, 100%)",
            margin: "auto",
            background: C.card,
            border: `1px solid ${C.line}`,
            padding: "20px 22px 22px",
            boxShadow: "4px 8px 24px rgba(20,14,8,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Label>{t("counter.studio.title")}</Label>
            <span style={{ flex: 1 }} />
            <button onClick={onClose} style={{ ...bare, fontFamily: F.mono, fontSize: 10 }}>
              {t("counter.studio.close")}
            </button>
          </div>

          <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginBottom: 12 }}>
            {t("counter.studio.blurb")}
          </div>

          {trouble && <Trouble onRetry={() => void reread()}>{trouble}</Trouble>}

          {packs === null ? (
            <Waiting lines={4} />
          ) : (
            <>
              <NewPack
                busy={busy}
                onSave={(p) => guard(() => savePack(p))}
                taken={packs.map((p) => p.id)}
              />

              {packs.length === 0 ? (
                <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 14 }}>
                  {t("counter.studio.none")}
                </div>
              ) : (
                packs.map((p) => (
                  <PackRow
                    key={p.id}
                    pack={p}
                    inside={decors.filter((s) => s.packId === p.id)}
                    openHere={open === p.id}
                    onToggle={() => setOpen(open === p.id ? null : p.id)}
                    busy={busy}
                    onRetire={() => guard(() => retirePack(p.id, p.retired))}
                    onRetirePiece={(s) => guard(() => retireWonDecor(s.id, s.retired))}
                    onAdd={(s) => guard(() => saveDecor(s))}
                    onEditPiece={(s, patch) =>
                      guard(() =>
                        saveDecor({ id: s.id, packId: s.packId, media: s.media, ...patch })
                      )
                    }
                    onDeletePack={() =>
                      setRequest({
                        title: t("counter.studio.deletePackTitle", { name: p.label.fr }),
                        body: t("counter.studio.deletePackBody"),
                        action: t("counter.studio.deleteForGood"),
                        severe: true,
                        onConfirm: () => guard(() => deletePack(p.id)),
                      })
                    }
                    onDeletePiece={(s) =>
                      setRequest({
                        title: t("counter.studio.deleteTitle", { name: s.label.fr }),
                        body: t("counter.studio.deleteBody"),
                        action: t("counter.studio.deleteForGood"),
                        severe: true,
                        onConfirm: () => guard(() => deleteWonDecor(s.id)),
                      })
                    }
                    onTrouble={setTrouble}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </Layer>
  );
}

/* ------------------------------------------------------------
   UNE POCHETTE NEUVE
   ------------------------------------------------------------ */

function NewPack({
  busy,
  taken,
  onSave,
}: {
  busy: boolean;
  taken: string[];
  onSave: (p: { id: string; price: number; labelFr: string; labelEn: string }) => void;
}) {
  const { t } = useTranslation();
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");
  const [price, setPrice] = useState(25);

  /* L'IDENTIFIANT SE DÉDUIT DU NOM, ET IL EST MONTRÉ. Le demander aurait
     été un champ de plus à remplir juste ; le cacher aurait laissé
     découvrir après coup qu'on ne peut plus le changer — il est écrit
     dans le journal des dépenses dès le premier achat. */
  const id = slug(fr) || "pochette";
  const clash = taken.includes(id);

  return (
    <div
      style={{
        padding: "10px 12px 12px",
        background: alpha(C.ochre, 0.06),
        border: `1px dashed ${alpha(C.ochre, 0.5)}`,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <label style={{ flex: "1 1 180px" }}>
          <Small>{t("counter.studio.nameFr")}</Small>
          <input value={fr} onChange={(e) => setFr(e.target.value)} style={underlineInput} />
        </label>
        <label style={{ flex: "1 1 180px" }}>
          <Small>{t("counter.studio.nameEn")}</Small>
          <input value={en} onChange={(e) => setEn(e.target.value)} style={underlineInput} />
        </label>
        <label style={{ flex: "0 0 90px" }}>
          <Small>{t("counter.studio.price")}</Small>
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            style={underlineInput}
          />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <code style={{ fontFamily: F.mono, fontSize: 10.5, color: C.inkFaded }}>{id}</code>
        <span style={{ flex: 1 }} />
        <button
          disabled={busy || !fr.trim() || !en.trim() || clash}
          onClick={() => {
            onSave({ id, price, labelFr: fr.trim(), labelEn: en.trim() });
            setFr("");
            setEn("");
          }}
          style={{
            ...inked(C.ochre),
            fontSize: 10,
            opacity: busy || !fr.trim() || !en.trim() || clash ? 0.45 : 1,
          }}
        >
          {t("counter.studio.create")}
        </button>
      </div>
      {clash && (
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.burgundy, marginTop: 4 }}>
          {t("counter.studio.taken")}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   UNE POCHETTE ET SON CONTENU
   ------------------------------------------------------------ */

/* ------------------------------------------------------------
   UNE POCHETTE ET SON CONTENU
   ------------------------------------------------------------

   TROIS CHOSES SE LISAIENT MAL, ET LES TROIS SONT ICI.

   LA VIGNETTE NE SE VOYAIT PAS. `WonDraw` lit par défaut le cache de
   l'étal, rempli par la lecture du hall : ce qu'on vient de déposer n'y
   est pas, ce qui est retiré non plus. Le studio affichait donc un carré
   vide à l'endroit exact où il faut voir ce qu'on publie. Il tient
   `media` dans sa propre réponse, et le passe.

   LA RARETÉ NE SE LISAIT NULLE PART. On la choisissait au dépôt et plus
   jamais ensuite : rien, sur la grille, ne disait laquelle était dorée.
   Elle est écrite sur chaque vignette — en toutes lettres, parce qu'un
   liseré doré disparaît sous cinq des dix-sept peaux, et que le verdict
   se dit par un MOT.

   « RETIRÉ » ÉTAIT UNE OPACITÉ. Une vignette à 45 % ressemble à une
   vignette qui charge. C'est un état : il s'écrit.
   ------------------------------------------------------------ */

/** Les trois raretés, dans l'ordre où on les regarde. */
const RARITIES = ["gold", "rare", "common"] as const;

const RARITY_INK: Record<string, string> = {
  gold: C.ochre,
  rare: C.cobalt,
  common: C.slate,
};

function PieceCard({
  piece,
  busy,
  onRetire,
  onDelete,
  onEdit,
}: {
  piece: Piece;
  busy: boolean;
  onRetire: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const ink = RARITY_INK[piece.rarity] || C.slate;

  return (
    <div
      style={{
        width: 118,
        padding: 8,
        background: C.paper,
        border: `1px solid ${piece.retired ? C.line : alpha(ink, 0.55)}`,
        textAlign: "center",
      }}
    >
      {/* Le fond de l'étagère sous la vignette : une image claire sur un
          fond clair ne se juge pas, et c'est là-dessus qu'elle sera vue. */}
      <div
        style={{
          height: 64,
          padding: 4,
          background: alpha(C.ink, 0.06),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <WonDraw motif={`${WON_PREFIX}${piece.id}`} media={piece.media} />
      </div>

      <div
        style={{
          fontFamily: F.mono,
          fontSize: 8.5,
          letterSpacing: 0.6,
          color: ink,
          marginTop: 5,
        }}
      >
        {t(`counter.studio.rarity.${piece.rarity}`).toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: F.body,
          fontSize: 11.5,
          color: C.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={piece.label.fr}
      >
        {piece.label.fr}
      </div>

      {/* CE QUI NE SE DEVINE PAS D'UNE IMAGE se dit sous elle : un objet
          qui se pend au fond de la rangée ne se pose pas sur la planche. */}
      {(piece.wall || piece.tintable) && (
        <div style={{ fontFamily: F.mono, fontSize: 8, color: C.inkFaded, marginTop: 1 }}>
          {[
            piece.wall ? t("counter.studio.wall") : null,
            piece.tintable ? t("counter.studio.tintable") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {piece.retired && (
        <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.burgundy, marginTop: 3 }}>
          {t("counter.studio.retired")}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 5,
          borderTop: `1px solid ${C.line}`,
          paddingTop: 5,
        }}
      >
        <button
          disabled={busy}
          onClick={onEdit}
          style={{ ...bare, fontFamily: F.mono, fontSize: 8.5, color: C.slate }}
        >
          {t("counter.studio.edit")}
        </button>
        <button
          disabled={busy}
          onClick={onRetire}
          style={{ ...bare, fontFamily: F.mono, fontSize: 8.5, color: C.inkFaded }}
        >
          {t(piece.retired ? "counter.studio.putBack" : "counter.studio.retire")}
        </button>
        <button
          disabled={busy}
          onClick={onDelete}
          aria-label={t("counter.studio.deleteOne", { name: piece.label.fr })}
          style={{ ...bare, display: "flex", color: C.burgundy }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   RETOUCHER UNE VIGNETTE APRÈS COUP

   Le nom venait du nom de FICHIER, et rien ne permettait d'en changer :
   « cine hub 2026 » et « sans titre » sont restés tels quels sur l'étal.
   La rareté, elle, se choisissait une fois pour toutes au dépôt. Tout
   cela est une ligne de catalogue, et `upsertDecor` la réécrit déjà —
   il n'y avait qu'à l'atteindre.
   ------------------------------------------------------------ */

function EditPiece({
  piece,
  busy,
  onSave,
  onClose,
}: {
  piece: Piece;
  busy: boolean;
  onSave: (patch: {
    rarity: string;
    labelFr: string;
    labelEn: string;
    wall: boolean;
    tintable: boolean;
  }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [fr, setFr] = useState(piece.label.fr);
  const [en, setEn] = useState(piece.label.en);
  const [rarity, setRarity] = useState<string>(piece.rarity);
  const [wall, setWall] = useState(!!piece.wall);
  const [tintable, setTintable] = useState(!!piece.tintable);

  return (
    <div
      style={{
        marginTop: 10,
        padding: "12px 14px",
        border: `1px solid ${alpha(C.slate, 0.6)}`,
        background: alpha(C.slate, 0.06),
      }}
    >
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{
            width: 90,
            height: 90,
            flexShrink: 0,
            padding: 6,
            background: alpha(C.ink, 0.06),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WonDraw motif={`${WON_PREFIX}${piece.id}`} media={piece.media} />
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <label style={{ display: "block" }}>
            <Small>{t("counter.studio.nameFr")}</Small>
            <input value={fr} onChange={(e) => setFr(e.target.value)} style={underlineInput} />
          </label>
          <label style={{ display: "block", marginTop: 8 }}>
            <Small>{t("counter.studio.nameEn")}</Small>
            <input value={en} onChange={(e) => setEn(e.target.value)} style={underlineInput} />
          </label>
        </div>
      </div>

      <div
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}
      >
        <Traits
          rarity={rarity}
          wall={wall}
          tintable={tintable}
          onRarity={setRarity}
          onWall={setWall}
          onTintable={setTintable}
        />
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...bare, fontFamily: F.mono, fontSize: 10 }}>
          {t("counter.studio.cancel")}
        </button>
        <button
          disabled={busy || !fr.trim() || !en.trim()}
          onClick={() => onSave({ rarity, labelFr: fr.trim(), labelEn: en.trim(), wall, tintable })}
          style={{ ...inked(C.slate), fontSize: 10, opacity: busy || !fr.trim() ? 0.45 : 1 }}
        >
          {t("counter.studio.save")}
        </button>
      </div>
      {/* L'identifiant, lui, ne bouge pas : il est écrit dans la
          collection de ceux qui l'ont tirée. */}
      <code style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>{piece.id}</code>
    </div>
  );
}

/** Les trois réglages qu'une image ne dit pas d'elle-même. */
function Traits({
  rarity,
  wall,
  tintable,
  onRarity,
  onWall,
  onTintable,
}: {
  rarity: string;
  wall: boolean;
  tintable: boolean;
  onRarity: (r: string) => void;
  onWall: (v: boolean) => void;
  onTintable: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {RARITIES.map((r) => (
        <button
          key={r}
          onClick={() => onRarity(r)}
          aria-pressed={rarity === r}
          style={{
            ...chip,
            ...(rarity === r
              ? { background: alpha(RARITY_INK[r] as string, 0.28), borderColor: RARITY_INK[r] }
              : null),
          }}
        >
          {t(`counter.studio.rarity.${r}`)}
        </button>
      ))}
      <button
        onClick={() => onWall(!wall)}
        aria-pressed={wall}
        style={{
          ...chip,
          ...(wall ? { background: alpha(C.slate, 0.28), borderColor: C.slate } : null),
        }}
      >
        {t("counter.studio.wall")}
      </button>
      <button
        onClick={() => onTintable(!tintable)}
        aria-pressed={tintable}
        style={{
          ...chip,
          ...(tintable ? { background: alpha(C.slate, 0.28), borderColor: C.slate } : null),
        }}
      >
        {t("counter.studio.tintable")}
      </button>
    </>
  );
}

function PackRow({
  pack,
  inside,
  openHere,
  onToggle,
  busy,
  onRetire,
  onDeletePack,
  onRetirePiece,
  onDeletePiece,
  onAdd,
  onEditPiece,
  onTrouble,
}: {
  pack: PackDef;
  inside: Piece[];
  openHere: boolean;
  onToggle: () => void;
  busy: boolean;
  onRetire: () => void;
  onDeletePack: () => void;
  onRetirePiece: (s: Piece) => void;
  onDeletePiece: (s: Piece) => void;
  onEditPiece: (
    s: Piece,
    patch: { rarity: string; labelFr: string; labelEn: string; wall: boolean; tintable: boolean }
  ) => void;
  onAdd: (s: {
    id: string;
    packId: string;
    rarity: string;
    media: string;
    labelFr: string;
    labelEn: string;
    wall?: boolean;
    tintable?: boolean;
  }) => void;
  onTrouble: (m: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const open = inside.find((s) => s.id === editing);

  return (
    <div
      style={{
        borderTop: `1px solid ${C.line}`,
        padding: "10px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onToggle}
          aria-expanded={openHere}
          style={{ ...bare, fontFamily: F.title, fontStyle: "italic", fontSize: 17, color: C.ink }}
        >
          {pack.label.fr}
        </button>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {t("counter.studio.summary", {
            price: pack.price,
            count: inside.filter((s) => !s.retired).length,
          })}
        </span>
        <span style={{ flex: 1 }} />
        {pack.retired && (
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.burgundy }}>
            {t("counter.studio.retired")}
          </span>
        )}
        <button disabled={busy} onClick={onRetire} style={chip}>
          {t(pack.retired ? "counter.studio.putBack" : "counter.studio.retire")}
        </button>
        <button
          disabled={busy}
          onClick={onDeletePack}
          aria-label={t("counter.studio.deletePackOne", { name: pack.label.fr })}
          style={{ ...bare, display: "flex", color: C.burgundy }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {openHere && (
        <div style={{ marginTop: 10 }}>
          {/* PAR RARETÉ, parce que c'est la question qu'on se pose en
              regardant une pochette : ce qu'elle a de rare. Une rangée
              par famille, et les vides ne se dessinent pas. */}
          {RARITIES.map((r) => {
            const lot = inside.filter((s) => s.rarity === r);
            if (lot.length === 0) return null;
            return (
              <div key={r} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 9,
                    letterSpacing: 1.2,
                    color: RARITY_INK[r],
                    marginBottom: 4,
                  }}
                >
                  {t(`counter.studio.rarity.${r}`).toUpperCase()} · {lot.length}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {lot.map((s) => (
                    <PieceCard
                      key={s.id}
                      piece={s}
                      busy={busy}
                      onRetire={() => onRetirePiece(s)}
                      onDelete={() => onDeletePiece(s)}
                      onEdit={() => setEditing(editing === s.id ? null : s.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {inside.length === 0 && (
            <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
              {t("counter.studio.emptyPack")}
            </div>
          )}

          {open && (
            <EditPiece
              piece={open}
              busy={busy}
              onSave={(patch) => {
                onEditPiece(open, patch);
                setEditing(null);
              }}
              onClose={() => setEditing(null)}
            />
          )}

          <Drop
            packId={pack.id}
            busy={busy}
            taken={inside.map((s) => s.id)}
            onAdd={onAdd}
            onTrouble={onTrouble}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   LE DÉPÔT D'UNE IMAGE
   ------------------------------------------------------------

   CHOISIR UN FICHIER N'ENVOIE PLUS RIEN. Le geste partait d'un coup :
   on ne voyait pas ce qu'on avait pris, le nom se déduisait du nom de
   fichier — d'où « sans titre » et « cine hub 2026 » restés sur l'étal —
   et il n'y avait pas de marche arrière. On voit maintenant l'image, en
   grand, sur le fond de l'étagère ; on la nomme ; on règle sa rareté ;
   et l'envoi est un second geste, qu'on peut ne pas faire.

   L'ORDRE DES DEUX MOITIÉS N'A PAS CHANGÉ, et il ne doit pas : les
   octets partent chez Azure avec un ticket signé, PUIS la ligne de
   catalogue part au serveur. Une ligne écrite avant l'image donnerait
   une vignette qui existe et ne se montre pas, ce qui est la seule des
   deux moitiés qu'on ne rattrape pas en réessayant.
   ------------------------------------------------------------ */

function Drop({
  packId,
  busy,
  taken,
  onAdd,
  onTrouble,
}: {
  packId: string;
  busy: boolean;
  taken: string[];
  onAdd: (s: {
    id: string;
    packId: string;
    rarity: string;
    media: string;
    labelFr: string;
    labelEn: string;
    wall?: boolean;
    tintable?: boolean;
  }) => void;
  onTrouble: (m: string) => void;
}) {
  const { t } = useTranslation();
  const pick = useRef<HTMLInputElement>(null);
  const [rarity, setRarity] = useState<string>("common");
  /* LES DEUX PROPRIÉTÉS QU'UNE IMAGE NE DIT PAS D'ELLE-MÊME, et c'est
     pour cela qu'on les demande ici plutôt que de les deviner :

     `wall` — un objet qui se PEND au fond de la rangée ne se pose pas
     sur la planche. Rien dans un PNG ne le dit, et se tromper met un
     lierre debout sur une étagère.

     `tintable` — l'encre du thème lui parle-t-elle encore ? Un dessin
     au trait, oui ; une photographie, non. Le panneau de réglages
     n'offre alors pas la teinte, plutôt que d'offrir un curseur qui ne
     fait rien. Une image déposée est rendue dans une balise `img`, où
     la couleur ne passe pas : d'où le défaut à « non ». */
  const [wall, setWall] = useState(false);
  const [tintable, setTintable] = useState(false);
  const [sending, setSending] = useState(false);

  /** Ce qu'on a choisi, pas encore envoyé. */
  const [held, setHeld] = useState<{ file: File; url: string; ext: string } | null>(null);
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");

  /* L'URL d'objet est une ressource, pas une valeur : gardée, elle fuit
     à chaque image regardée puis abandonnée. */
  useEffect(() => () => void (held && URL.revokeObjectURL(held.url)), [held]);

  const hold = (file: File) => {
    const ext = KINDS[file.type];
    if (!ext) return onTrouble(t("counter.studio.badKind"));
    if (file.size > MAX_BYTES) return onTrouble(t("counter.studio.tooBig"));
    const name = slug(file.name.replace(/\.[^.]+$/, ""));
    if (taken.includes(`vig-${name || "sans-nom"}`)) return onTrouble(t("counter.studio.taken"));
    onTrouble("");
    setHeld({ file, url: URL.createObjectURL(file), ext });
    setFr(name.replace(/-/g, " "));
    setEn(name.replace(/-/g, " "));
  };

  const drop = () => {
    if (held) URL.revokeObjectURL(held.url);
    setHeld(null);
    setFr("");
    setEn("");
  };

  const send = async () => {
    if (!held) return;
    /* L'IDENTIFIANT SUIT LE NOM QU'ON VIENT D'ÉCRIRE, et non le nom du
       fichier : c'est la seule occasion de le choisir, puisqu'il est
       écrit dans la collection dès le premier tirage. */
    const id = `vig-${slug(fr) || "sans-nom"}`;
    if (taken.includes(id)) return onTrouble(t("counter.studio.taken"));

    const key = `decor/${id}.${held.ext}`;
    setSending(true);
    try {
      /* Stock commun (`bank/…`), hors du compte de qui que ce soit. */
      const [ticket] = (await mediaTickets([`bank/${key}`], "write")).tickets;
      if (!ticket) throw new Error(t("counter.studio.noTicket"));
      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "content-type": held.file.type },
        body: held.file,
      });
      if (!put.ok) throw new Error(`${put.status}`);
      /* L'image est en place : la ligne peut suivre. */
      onAdd({
        id,
        packId,
        rarity,
        media: key,
        labelFr: fr.trim(),
        labelEn: en.trim() || fr.trim(),
        wall,
        tintable,
      });
      drop();
    } catch (e) {
      onTrouble((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) hold(file);
      }}
      style={{
        marginTop: 10,
        padding: "12px 14px",
        border: `1px dashed ${alpha(C.slate, 0.6)}`,
        background: alpha(C.slate, 0.05),
      }}
    >
      {held ? (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {/* EN GRAND, ET SUR LE FOND DE L'ÉTAGÈRE. Une vignette se
                juge à la taille où on la verra, sur la matière où elle
                sera posée — pas en timbre-poste sur du blanc. */}
            <div
              style={{
                width: 140,
                height: 140,
                flexShrink: 0,
                padding: 10,
                background: alpha(C.ink, 0.06),
                border: `1px solid ${C.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={held.url}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <label style={{ display: "block" }}>
                <Small>{t("counter.studio.nameFr")}</Small>
                <input value={fr} onChange={(e) => setFr(e.target.value)} style={underlineInput} />
              </label>
              <label style={{ display: "block", marginTop: 8 }}>
                <Small>{t("counter.studio.nameEn")}</Small>
                <input value={en} onChange={(e) => setEn(e.target.value)} style={underlineInput} />
              </label>
              <code
                style={{
                  display: "block",
                  fontFamily: F.mono,
                  fontSize: 9.5,
                  color: C.inkFaded,
                  marginTop: 8,
                }}
              >
                vig-{slug(fr) || "sans-nom"}
              </code>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
            }}
          >
            <Traits
              rarity={rarity}
              wall={wall}
              tintable={tintable}
              onRarity={setRarity}
              onWall={setWall}
              onTintable={setTintable}
            />
            <span style={{ flex: 1 }} />
            <button
              disabled={sending}
              onClick={drop}
              style={{ ...bare, fontFamily: F.mono, fontSize: 10 }}
            >
              {t("counter.studio.cancel")}
            </button>
            <button
              disabled={busy || sending || !fr.trim()}
              onClick={() => void send()}
              style={{
                ...inked(C.slate),
                fontSize: 10,
                opacity: busy || sending || !fr.trim() ? 0.45 : 1,
              }}
            >
              {t(sending ? "counter.studio.sending" : "counter.studio.publish")}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, flex: "1 1 240px" }}>
            {t("counter.studio.dropHint")}
          </div>
          <button
            disabled={busy}
            onClick={() => pick.current?.click()}
            style={{ ...inked(C.slate), fontSize: 10 }}
          >
            {t("counter.studio.choose")}
          </button>
        </div>
      )}

      <input
        ref={pick}
        type="file"
        accept={Object.keys(KINDS).join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) hold(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const Small = ({ children }: { children: string }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: 9,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.inkFaded,
    }}
  >
    {children}
  </div>
);
