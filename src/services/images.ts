/* ============================================================
   IMAGES — measuring and shrinking before storage.
   ============================================================ */

/* The real dimensions of an image file, so as to display what was
   actually kept rather than promise it. */
export const imageSize = (file: File): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ w: 0, h: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

/* The formats that know how to carry transparency. JPEG is not one of
   them, and that is the whole problem settled below. */
const KEEPS_ALPHA = ["image/png", "image/webp", "image/gif"];

/* The image is brought back to poster size before being stored.
   IndexedDB could take the original, but 700 px is ample for the largest
   display: better keep the database light and the rendering instant.

   THE BACKGROUND THAT TURNED BLACK. Everything came out as JPEG,
   including cut-out PNGs. But a JPEG has no alpha channel: the canvas is
   transparent where the image paints nothing, and the encoder, having
   nowhere to store that transparency, renders it black. A cut-out decor
   object therefore arrived on the shelf inside a black rectangle.

   So we keep the format when it knows how to carry transparency, and
   JPEG for all the rest — a poster is a photograph, it has no hole and
   PNG would make it weigh three times as much. */
export const shrinkImage = (file: File, maxW = 700): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const alpha = KEEPS_ALPHA.includes(file.type);
        // a Blob, not a base64 string: that is the whole point of IndexedDB
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("encodage impossible"))),
          alpha ? "image/png" : "image/jpeg",
          // quality says nothing to PNG, which loses nothing
          alpha ? undefined : 0.82
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
