/* ============================================================
   LA PELLICULE, EN LECTURE SEULE
   ============================================================

   A poster is a promise made by a marketing department; a frame is the
   film. Six of them say the light, the faces and the period in one
   glance, which is exactly what one is trying to decide when a film is
   proposed and one has not seen it.

   ELLE A L'ALLURE DE CELLE DU DOSSIER, ET CE N'EST PAS DE LA COQUETTERIE.
   C'était une grille d'images nues, à côté d'une pellicule numérotée sur
   carton dans le dossier du même film : deux traitements pour le même
   geste, dans un produit qui n'a qu'une façon de dire « voici des
   images ». On garde donc le carton, le numéro et l'inclinaison SEMÉE
   (`tiltOf`, jamais un tirage au sort — un mur qui gigote n'est pas un
   mur), et l'agrandissement passe par la MÊME visionneuse.

   CE QU'ELLE NE FAIT PAS : ajouter, légender, effacer, insérer dans le
   texte. `StillsStrip` fait tout cela et reste le seul endroit où on le
   fait — un plan de TMDB n'a rien à annoter, et une capture ne se
   modifie que dans son dossier.

   THEY COST ONE REQUEST, AND IT IS ALREADY PAID. `getDetails` appends
   `images` to the call it was making anyway — see `tmdb.js`. What is
   stored is a PATH, so the strip asks for w300 and the enlargement for
   w1280 without the card having to be rewritten the day one of the two
   changes. See `shots`, which now carries that distinction.

   THEY ARE NOT `stills`. Those are what YOU captured: they live in this
   device's vault, they are mirrored server-side, they count against
   `MEDIA_CEILING`, and they carry a caption one writes. On unifie le
   REGARD, jamais la nature. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { Label } from "../ui";
import { tiltOf } from "../../domain/seeded";
import { StillLightbox } from "../stills/StillLightbox";
import { ShotImage, type Shot } from "../stills/shots";

export function FrameStrip({
  shots,
  title,
  /** Ce que la bande annonce. Absent : « quelques plans ». */
  label,
}: {
  shots: Shot[];
  title: string;
  label?: string;
}) {
  const { t } = useTranslation();
  /** Le rang ouvert en grand, ou `null` tant que la planche est fermée. */
  const [open, setOpen] = useState<number | null>(null);
  /* Une image que le navigateur n'a pas pu charger n'est pas une case
     vide : elle sort de la planche. TMDB connaît des chemins dont il ne
     sert plus l'image. */
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const shown = shots.filter((s) => !broken.has(s.id));
  if (!shown.length) return null;
  const heading = label ?? t("frames.title");

  return (
    <div style={{ marginTop: 16 }}>
      <Label>{heading}</Label>
      <ul
        aria-label={heading}
        style={{
          listStyle: "none",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12,
          margin: "8px 0 0",
          padding: 0,
        }}
      >
        {shown.map((shot, i) => (
          <li key={shot.id}>
            <button
              onClick={() => setOpen(i)}
              aria-label={t("frames.enlarge", { title, place: i + 1, total: shown.length })}
              style={{
                ...bare,
                display: "block",
                width: "100%",
                padding: 0,
                /* SEMÉE SUR L'IMAGE, jamais tirée au sort : la même
                   vignette penche du même côté à chaque ouverture. */
                transform: `rotate(${Number(tiltOf(shot.id)) / 7}deg)`,
              }}
            >
              {/* LE CARTON DE LA PELLICULE : un blanc autour de l'image,
                  et l'ombre qui la décolle du papier. */}
              <div
                style={{
                  position: "relative",
                  background: C.card,
                  padding: 5,
                  paddingBottom: 16,
                  border: `1px solid ${alpha(C.line, 0.8)}`,
                  boxShadow: "1px 3px 7px rgba(30,20,10,0.16)",
                }}
              >
                <ShotImage
                  shot={shot}
                  onBroken={() => setBroken((was) => new Set(was).add(shot.id))}
                  style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "cover",
                    background: alpha(C.ink, 0.06),
                  }}
                />
                {/* LE NUMÉRO, comme sur la pellicule du dossier : c'est
                    ce qui fait d'une planche une planche et non six
                    images posées côte à côte. */}
                <span
                  style={{
                    position: "absolute",
                    right: 6,
                    bottom: 3,
                    fontFamily: F.mono,
                    fontSize: 9,
                    color: C.inkFaded,
                  }}
                >
                  {i + 1}
                </span>
                {shot.caption && (
                  <span
                    style={{
                      position: "absolute",
                      left: 6,
                      bottom: 3,
                      maxWidth: "72%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: F.hand,
                      fontSize: 12,
                      color: C.inkFaded,
                    }}
                  >
                    {shot.caption}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {open != null && (
        <StillLightbox
          shots={shown}
          index={open}
          title={title}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
