import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { C } from "../../theme/tokens";
import { getImage } from "../../db";

/* Une image d'IndexedDB, servie en URL d'objet le temps de l'affichage. */
export function IdbImage({
  imageKey,
  alt = "",
  style,
  onClick,
}: {
  imageKey: string;
  alt?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null,
      alive = true;
    getImage(imageKey)
      .then((blob: Blob | undefined) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(console.error);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey]);
  if (!url) return <div style={{ ...style, background: C.paperDark }} />;
  return <img src={url} alt={alt} onClick={onClick} style={style} />;
}
