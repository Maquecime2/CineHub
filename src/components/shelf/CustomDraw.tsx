import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getImage } from "../../db";
import { customDecorByKey } from "../../services/customDecor";

/* The drawing of an imported pattern.

   It carries the same signature as the house drawings —
   `({ color, style })` — and that is the whole point: `DecorItem`,
   `WallItem` and the cabinet call a component without knowing whether the
   line comes from `objects.jsx` or from the user's disk.

   A tintable SVG is injected as it is: its ink was replaced by
   `currentColor` at import time, and it is enough to lay the colour on
   the parent for it to take it. The rest — a PNG, an SVG whose lines we
   could not read — is shown as we received it; colour does not speak to
   it, and the settings panel therefore does not offer it. */
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
        /* What is laid down touches the bottom of its cell, what hangs
           dangles from the top: that is what the house drawings do, and
           without it any old image floats in the middle of the void. */
        objectPosition: spec.wall ? "center top" : "center bottom",
        ...style,
      }}
    />
  );
}
