/* ============================================================
   LES QUATRE IMAGES DE FIN DE PARTIE
   ============================================================

   QUATRE FICHIERS, ET IL N'Y EN AURA JAMAIS UN CINQUIÈME. Un par
   palier de `tierOf` (`domain/points`) : la fin d'une partie de quizz
   affiche celle de son palier, ou rien. C'est ce qui rend cet écran
   aussi court — il n'y a pas de liste à tenir, pas de ligne à créer,
   pas d'identifiant à choisir.

   IL N'Y A DONC AUCUNE TABLE, ET AUCUNE ROUTE. La clé EST le palier
   (`bank/cheer/perfect`, `held`, `half`, `missed`), donc l'écran de fin
   la compose sans rien demander à personne. Le studio des pochettes, à
   côté, doit écrire une ligne de `decor_def` parce qu'un bibelot porte
   un libellé et une rareté que l'image ne dit pas ; ici l'image ne dit
   rien d'autre qu'elle-même. Une table pour quatre lignes fixes aurait
   été du mobilier.

   PAS D'EXTENSION DANS LA CLÉ. Le type est porté par l'en-tête du blob,
   où il a toujours été, et une extension aurait obligé à ranger
   quelque part laquelle a été déposée — c'est-à-dire à réinventer la
   table qu'on vient d'éviter. Redéposer écrase, ce qui est exactement
   le geste qu'on veut : on remplace une image, on ne collectionne pas
   les anciennes.

   L'IMAGE NE PASSE PAS PAR LE SERVEUR. Un ticket signé pour UN blob,
   quinze minutes, puis les octets vont à Azure directement — copie
   exacte de `PackStudio`, pour la raison exacte : un serveur qui relaie
   des octets est un serveur qu'on peut remplir.

   RIEN NE VÉRIFIE QUE LES QUATRE SONT LÀ, et rien ne doit le vérifier.
   Le rideau marche sans une seule d'entre elles ; en déposer deux est
   un état parfaitement valide, pas un travail à moitié fait.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, inked } from "../../theme/styles";
import { Label, Trouble } from "../../components/ui";
import { Layer } from "../../components/ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { mediaTickets } from "../../services/server";

/* L'ORDRE EST CELUI DU BARÈME, du meilleur au pire — le même que
   `Tier` dans `domain/points`. Les recopier ici est un doublon assumé
   et minuscule : importer le type ne donnerait pas ses valeurs, et une
   liste de quatre mots qui ne changera pas ne mérite pas d'export. */
const TIERS = ["perfect", "held", "half", "missed"] as const;

/* CE QU'ON ACCEPTE. Le GIF est là pour la raison qui a fait ouvrir ce
   chantier — une image qui bouge dit « c'est fini » mieux qu'un texte —
   et les deux autres parce qu'un format animé moderne coûte dix fois
   moins cher à la bande passante pour le même effet. Pas de SVG : ces
   images-là ne sont pas des dessins d'interface. */
const KINDS: Record<string, true> = {
  "image/gif": true,
  "image/webp": true,
  "image/png": true,
};

/* CETTE IMAGE SE PAIE À CHAQUE FIN DE PARTIE, PAR JOUEUR. Elle n'entre
   dans aucun plafond — le stock commun n'est le coffre de personne — et
   c'est précisément pourquoi la borne est ici : rien d'autre ne la
   poserait. Deux mégaoctets sont déjà généreux pour trois secondes. */
const MAX_BYTES = 2 * 1024 * 1024;

export function CheerStudio({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const box = useDialog(onClose);
  const [busy, setBusy] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  /* CE QU'ON VIENT DE DÉPOSER, ET RIEN DE PLUS. On ne peut pas savoir
     ce qui est DÉJÀ en place : le stock commun se lit sans condition,
     donc un ticket revient valide même pour un blob absent, et
     interroger Azure depuis ici ne dirait la vérité qu'au prix d'une
     requête par palier à chaque ouverture. L'écran dit donc ce qu'il a
     fait, jamais ce qu'il croit savoir. */
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const send = async (tier: string, file: File) => {
    if (!KINDS[file.type]) return setTrouble(t("counter.cheer.badKind"));
    if (file.size > MAX_BYTES) return setTrouble(t("counter.cheer.tooBig"));
    setBusy(tier);
    setTrouble(null);
    try {
      const [ticket] = await mediaTickets([`bank/cheer/${tier}`], "write");
      if (!ticket) throw new Error(t("counter.cheer.noTicket"));
      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "content-type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`${put.status}`);
      setSent((was) => ({ ...was, [tier]: true }));
    } catch (e) {
      setTrouble((e as Error).message);
    } finally {
      setBusy(null);
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
          aria-label={t("counter.cheer.title")}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "min(520px, 100%)",
            margin: "auto",
            background: C.card,
            border: `1px solid ${C.line}`,
            padding: "20px 22px 22px",
            boxShadow: "4px 8px 24px rgba(20,14,8,0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Label>{t("counter.cheer.title")}</Label>
            <span style={{ flex: 1 }} />
            <button onClick={onClose} style={{ ...bare, fontFamily: F.mono, fontSize: 10 }}>
              {t("counter.cheer.close")}
            </button>
          </div>

          <div
            style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, margin: "8px 0 14px" }}
          >
            {t("counter.cheer.blurb")}
          </div>

          <Trouble>{trouble}</Trouble>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TIERS.map((tier) => (
              <div
                key={tier}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: `1px dotted ${C.line}`,
                  paddingBottom: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  {/* LE MÊME MOT QUE CELUI QUE LE JOUEUR VERRA, et pris
                      au même endroit : un libellé recopié ici aurait
                      dérivé du tampon à la première réécriture. */}
                  <div style={{ fontFamily: F.title, fontSize: 17, color: C.ink }}>
                    {t(`quizView.tier.${tier}`)}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                    bank/cheer/{tier}
                  </div>
                </div>
                {sent[tier] && (
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.moss }}>
                    {t("counter.cheer.done")}
                  </span>
                )}
                {/* LE CHAMP DE FICHIER EST DANS LE LABEL, ET C'EST CE QUI
                    LE REND ATTEIGNABLE AU CLAVIER. Un bouton qui
                    déclencherait un `input` caché par `click()` ne
                    prendrait pas le focus et n'annoncerait rien. */}
                <label style={{ ...inked(C.slate), fontSize: 10, cursor: "pointer" }}>
                  {busy === tier ? t("counter.cheer.sending") : t("counter.cheer.pick")}
                  <input
                    type="file"
                    accept="image/gif,image/webp,image/png"
                    disabled={busy != null}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      /* Le champ se vide : redéposer le MÊME fichier
                         après un échec ne déclenche pas `change` si sa
                         valeur n'a pas bougé. */
                      e.target.value = "";
                      if (file) void send(tier, file);
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layer>
  );
}
