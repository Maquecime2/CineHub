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
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, chip, inked, underlineInput } from "../../theme/styles";
import { Label, Trouble, Waiting } from "../../components/ui";
import { Layer } from "../../components/ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { WonDraw } from "../../components/shelf/WonDraw";
import { WON_PREFIX } from "../../services/wonDecor";
import {
  mediaTickets,
  packCatalogue,
  retirePack,
  retireWonDecor,
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
                    onTrouble={setTrouble}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
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

function PackRow({
  pack,
  inside,
  openHere,
  onToggle,
  busy,
  onRetire,
  onRetirePiece,
  onAdd,
  onTrouble,
}: {
  pack: PackDef;
  inside: Piece[];
  openHere: boolean;
  onToggle: () => void;
  busy: boolean;
  onRetire: () => void;
  onRetirePiece: (s: Piece) => void;
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

  return (
    <div
      style={{
        borderTop: `1px solid ${C.line}`,
        padding: "10px 0",
        opacity: pack.retired ? 0.55 : 1,
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
      </div>

      {openHere && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {inside.map((s) => (
              <div
                key={s.id}
                style={{
                  width: 78,
                  padding: 6,
                  background: C.paper,
                  border: `1px solid ${C.line}`,
                  opacity: s.retired ? 0.45 : 1,
                  textAlign: "center",
                }}
              >
                <div style={{ height: 48 }}>
                  <WonDraw motif={`${WON_PREFIX}${s.id}`} />
                </div>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 8.5,
                    color: C.inkFaded,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label.fr}
                </div>
                <button
                  disabled={busy}
                  onClick={() => onRetirePiece(s)}
                  style={{ ...bare, fontFamily: F.mono, fontSize: 8.5, color: C.burgundy }}
                >
                  {t(s.retired ? "counter.studio.putBack" : "counter.studio.retire")}
                </button>
              </div>
            ))}
            {inside.length === 0 && (
              <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
                {t("counter.studio.emptyPack")}
              </div>
            )}
          </div>

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

   Deux gestes en un : les octets partent chez Azure avec un ticket
   signé, et la ligne de catalogue part au serveur. L'ORDRE EST CELUI-CI
   et pas l'inverse — une ligne écrite avant l'image donnerait une
   vignette qui existe et ne se montre pas, ce qui est la seule des deux
   moitiés qu'on ne peut pas rattraper en réessayant.
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
  const [rarity, setRarity] = useState("common");
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

  const send = async (file: File) => {
    const ext = KINDS[file.type];
    if (!ext) return onTrouble(t("counter.studio.badKind"));
    if (file.size > MAX_BYTES) return onTrouble(t("counter.studio.tooBig"));

    const name = slug(file.name.replace(/\.[^.]+$/, ""));
    const id = `vig-${name || "sans-nom"}`;
    if (taken.includes(id)) return onTrouble(t("counter.studio.taken"));

    const key = `decor/${id}.${ext}`;
    setSending(true);
    try {
      const [ticket] = await mediaTickets([`bank/${key}`], "write");
      if (!ticket) throw new Error(t("counter.studio.noTicket"));
      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "content-type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`${put.status}`);
      /* L'image est en place : la ligne peut suivre. */
      onAdd({
        id,
        packId,
        rarity,
        media: key,
        labelFr: name.replace(/-/g, " "),
        labelEn: name.replace(/-/g, " "),
        wall,
        tintable,
      });
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
        if (file) void send(file);
      }}
      style={{
        marginTop: 10,
        padding: "12px 14px",
        border: `1px dashed ${alpha(C.slate, 0.6)}`,
        background: alpha(C.slate, 0.05),
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {["common", "rare", "gold"].map((r) => (
          <button
            key={r}
            onClick={() => setRarity(r)}
            aria-pressed={rarity === r}
            style={{
              ...chip,
              ...(rarity === r ? { background: alpha(C.ochre, 0.28), borderColor: C.ochre } : null),
            }}
          >
            {t(`counter.studio.rarity.${r}`)}
          </button>
        ))}
        <button
          onClick={() => setWall((w) => !w)}
          aria-pressed={wall}
          style={{
            ...chip,
            ...(wall ? { background: alpha(C.slate, 0.28), borderColor: C.slate } : null),
          }}
        >
          {t("counter.studio.wall")}
        </button>
        <button
          onClick={() => setTintable((v) => !v)}
          aria-pressed={tintable}
          style={{
            ...chip,
            ...(tintable ? { background: alpha(C.slate, 0.28), borderColor: C.slate } : null),
          }}
        >
          {t("counter.studio.tintable")}
        </button>
        <span style={{ flex: 1 }} />
        <button
          disabled={busy || sending}
          onClick={() => pick.current?.click()}
          style={{ ...inked(C.slate), fontSize: 10 }}
        >
          {t(sending ? "counter.studio.sending" : "counter.studio.choose")}
        </button>
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
        {t("counter.studio.dropHint")}
      </div>
      <input
        ref={pick}
        type="file"
        accept={Object.keys(KINDS).join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send(file);
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
