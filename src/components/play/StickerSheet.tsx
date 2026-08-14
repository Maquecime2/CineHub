/* ============================================================
   LA PLANCHE — le carnet à souches où l'on colle
   ============================================================

   UNE CASE VIDE EST UNE CASE, PAS UN BLANC. On voit la silhouette de ce
   qui manque et la case pointillée qui l'attend : c'est ce qui distingue
   un album d'une liste de ce qu'on possède. Sans les vides, personne ne
   sait qu'il y a onze vignettes ni combien il en reste.

   MAIS LA SILHOUETTE NE DIT PAS LE SUJET. On voit qu'il manque une
   dorée, pas laquelle : un album qui montre d'avance tous ses dessins
   n'a plus rien à ouvrir.

   LES DOUBLES SE COMPTENT, ils ne se cachent pas. Un double est ce qu'on
   échange du regard, et c'est aussi la seule preuve visible que le
   hasard est du hasard.

   Chaque vignette penche de son propre angle, SEMÉ par son identifiant :
   la même vignette est collée pareil demain. Une planche qui gigote
   n'est pas une planche.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tiltOf, usesPin } from "../../domain/seeded";
import { PushPin } from "../atmosphere";
import { perforated } from "../atmosphere/hall";
import { Label } from "../ui";
import { RARITY_INK, StickerArt } from "./stickers";

export interface Album {
  /** Le catalogue entier, tel que le serveur le connaît. */
  all: readonly { id: string; rarity: string }[];
  /** Ce qu'on a, et en combien d'exemplaires. */
  held: { sticker_id: string; copies: number }[];
}

export function StickerSheet({ all, held, tour }: Album & { tour?: string }) {
  const { t } = useTranslation();
  const copies = new Map(held.map((h) => [h.sticker_id, h.copies]));
  const got = all.filter((s) => copies.has(s.id)).length;

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 12,
          }}
        >
          {all.map((s) => {
            const n = copies.get(s.id) ?? 0;
            const mine = n > 0;
            return (
              <div
                key={s.id}
                title={mine ? t(`stickers.${s.id.replace(/^vig-/, "")}`) : undefined}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  padding: 9,
                  background: mine ? C.paper : "transparent",
                  border: `1px ${mine ? "solid" : "dashed"} ${mine ? C.line : alpha(C.line, 0.7)}`,
                  transform: mine ? `rotate(${tiltOf(s.id)}deg)` : undefined,
                  /* L'ombre n'est portée QUE par ce qui est collé : c'est
                     ce qui fait ressortir le plein du vide sans couleur. */
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
                  <StickerArt id={s.id} rarity={s.rarity} />
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
    </div>
  );
}
