/* ============================================================
   LA COLLECTION — ce qu'on a tiré, et ce qui manque
   ============================================================

   C'ÉTAIT UNE PLANCHE DE VIGNETTES À COLLER, c'est devenu une vitrine
   de bibelots. Le raisonnement n'a pas changé d'une ligne, seul l'objet
   a changé de nature : ce qu'on tire se POSE maintenant sur une
   étagère, et cette page dit ce qu'on a de quoi la garnir.

   UNE CASE VIDE EST UNE CASE, PAS UN BLANC. On voit la silhouette de ce
   qui manque et la case pointillée qui l'attend : c'est ce qui distingue
   une collection d'une liste de ce qu'on possède. Sans les vides,
   personne ne sait combien il en reste.

   MAIS LA SILHOUETTE NE DIT PAS LE SUJET. On voit qu'il manque un doré,
   pas lequel : une collection qui montre d'avance tous ses dessins n'a
   plus rien à ouvrir.

   LES DOUBLES SE COMPTENT, ils ne se cachent pas. Un double est ce
   qu'on montre, et c'est aussi la seule preuve visible que le hasard est
   du hasard. On ne peut PLUS les échanger — un objet gagné ne se
   partage pas, sinon la première personne généreuse vide la boutique —
   et c'est la seule chose que cette page a perdue en changeant de
   nature.

   Chaque objet penche de son propre angle, SEMÉ par son identifiant :
   le même objet est posé pareil demain. Une vitrine qui gigote n'est
   pas une vitrine.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tiltOf, usesPin } from "../../domain/seeded";
import { PushPin } from "../atmosphere";
import { perforated } from "../atmosphere/hall";
import { Label } from "../ui";
import { WonDraw } from "../shelf/WonDraw";
import { WON_PREFIX } from "../../services/wonDecor";
import type { DecorDef } from "../../services/server";

export const RARITY_INK: Record<string, string> = {
  common: C.ink,
  rare: C.ochre,
  gold: C.burgundy,
};

export function Collection({
  all,
  held,
  tour,
}: {
  /** Le catalogue entier, tel que le serveur le connaît. */
  all: readonly DecorDef[];
  /** Ce qu'on a, et en combien d'exemplaires. */
  held: { decor_id: string; copies: number }[];
  tour?: string;
}) {
  const { t, i18n } = useTranslation();
  const copies = new Map(held.map((h) => [h.decor_id, h.copies]));
  const got = all.filter((s) => copies.has(s.id)).length;

  /* À POSER ET À ACCROCHER NE SE MÉLANGENT PAS.

     Ce sont deux familles d'objets et pas deux variantes : l'un se pose
     sur la planche, l'autre se pend au fond de la rangée, et le cabinet
     les range déjà dans deux tiroirs. Les montrer en vrac ici obligeait
     à les tirer pour découvrir lequel est lequel — et un lierre qu'on
     croit poser reste sur les bras.

     Une famille vide ne s'affiche pas : un titre suivi de rien est pire
     qu'un titre absent. */
  const families = [
    { wall: false, title: t("shelf.toStandTitle"), of: all.filter((d) => !d.wall) },
    { wall: true, title: t("shelf.toHangTitle"), of: all.filter((d) => d.wall) },
  ].filter((f) => f.of.length > 0);

  /* LE NOM VIENT DE LA BASE, TOUJOURS. Ces objets s'écrivent après la
     compilation : aucune clé de traduction ne peut les attendre. */
  const nameOf = (d: DecorDef) => (i18n.language.startsWith("en") ? d.label.en : d.label.fr);

  return (
    <div data-tour={tour} data-print-block>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <Label>{t("counter.album.title")}</Label>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.inkFaded }}>
          {got}/{all.length}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          background: C.card,
          border: `1px solid ${C.line}`,
          padding: "16px 14px 16px 24px",
        }}
      >
        {/* Le bord perforé du carnet à souches, sur la reliure. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 13,
            ...perforated("y", { hole: C.paperDark }),
          }}
        />

        {families.map((family) => (
          <div key={String(family.wall)} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 8.5,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: C.inkFaded,
                marginBottom: 6,
              }}
            >
              {family.title}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                gap: 12,
              }}
            >
              {family.of.map((s) => {
                const n = copies.get(s.id) ?? 0;
                const mine = n > 0;
                return (
                  <div
                    key={s.id}
                    title={mine ? nameOf(s) : undefined}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      padding: 9,
                      background: mine ? C.paper : "transparent",
                      border: `1px ${mine ? "solid" : "dashed"} ${mine ? C.line : alpha(C.line, 0.7)}`,
                      transform: mine ? `rotate(${tiltOf(s.id)}deg)` : undefined,
                      /* L'ombre n'est portée QUE par ce qui est acquis :
                     c'est ce qui fait ressortir le plein du vide sans
                     couleur. */
                      boxShadow: mine ? "1px 2px 5px rgba(30,20,10,0.18)" : undefined,
                    }}
                  >
                    {mine && usesPin(s.id) && (
                      <PushPin
                        color={RARITY_INK[s.rarity] ?? C.ink}
                        style={{ top: -6, left: "50%", marginLeft: -7 }}
                      />
                    )}

                    {mine ? (
                      <WonDraw
                        motif={`${WON_PREFIX}${s.id}`}
                        color={s.tintable ? (RARITY_INK[s.rarity] ?? C.ink) : undefined}
                      />
                    ) : (
                      /* CE QUI MANQUE SE DEVINE SANS SE MONTRER : un carré
                     lavé de la teinte de sa rareté, et rien de plus. */
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: alpha(RARITY_INK[s.rarity] ?? C.ink, 0.08),
                        }}
                      />
                    )}

                    {n > 1 && (
                      <span
                        style={{
                          position: "absolute",
                          right: 3,
                          bottom: 2,
                          fontFamily: F.mono,
                          fontSize: 9.5,
                          color: C.inkFaded,
                        }}
                      >
                        ×{n}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* CE QU'ON EN FAIT, DIT ICI. Une collection qui ne mène nulle
            part est une collection qu'on regarde une fois : ces objets
            se posent, et rien sur cet écran ne le disait. */}
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 12 }}>
          {t("counter.album.whereToPlace")}
        </div>
      </div>
    </div>
  );
}
