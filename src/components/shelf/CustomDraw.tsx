import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getImage } from "../../db";
import { customDecorByKey } from "../../services/customDecor";

/* Le dessin d'un motif importé.

   Il porte la même signature que les dessins de la maison —
   `({ color, style })` — et c'est tout l'intérêt : `DecorItem`,
   `WallItem` et le cabinet appellent un composant sans savoir si le
   trait vient de `objects.jsx` ou du disque de l'utilisateur.

   Un SVG teintable est injecté tel quel : son encre a été remplacée par
   `currentColor` à l'import, et il suffit de poser la couleur sur le
   parent pour qu'il la prenne. Le reste — un PNG, un SVG dont on n'a pas
   su lire les traits — s'affiche tel qu'on l'a reçu ; la couleur ne lui
   parle pas, et le panneau de réglages ne la lui propose donc pas. */
export function CustomDraw({
  motif,
  color,
  style,
}: {
  motif: string;
  color?: string;
  style?: CSSProperties;
}) {
  const spec = customDecorByKey(motif);
  const [url, setUrl] = useState<string | null>(null);
  const [markup, setMarkup] = useState<string | null>(null);
  const imageKey = spec?.imageKey;
  const inline = spec?.kind === "svg";

  useEffect(() => {
    if (!imageKey) return;
    let objectUrl: string | null = null,
      alive = true;
    getImage(imageKey)
      .then(async (blob: Blob | undefined) => {
        if (!alive || !blob) return;
        if (inline) {
          const text = await blob.text();
          if (alive) setMarkup(text);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(console.error);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey, inline]);

  if (!spec) return null;

  if (inline)
    return (
      <span
        // le markup a été nettoyé à l'import : ni script, ni gestionnaire, ni lien distant
        dangerouslySetInnerHTML={{ __html: markup || "" }}
        style={{
          display: "block",
          lineHeight: 0,
          ...(spec.tintable && color ? { color } : null),
          ...style,
        }}
      />
    );

  if (!url) return <span style={style} />;
  return (
    <img
      src={url}
      alt={spec.label}
      draggable={false}
      style={{
        objectFit: "contain",
        /* Ce qui se pose touche le bas de sa case, ce qui s'accroche pend
           depuis le haut : c'est ce que font les dessins de la maison, et
           sans quoi une image quelconque flotte au milieu du vide. */
        objectPosition: spec.wall ? "center top" : "center bottom",
        ...style,
      }}
    />
  );
}
