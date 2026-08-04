/* ============================================================
   IMAGES — mesure et réduction avant rangement.
   ============================================================ */

/* Dimensions réelles d'un fichier image, pour pouvoir afficher ce qui a
   effectivement été conservé plutôt que de le promettre. */
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

/* Les formats qui savent porter de la transparence. Le JPEG n'en fait
   pas partie, et c'est tout le problème réglé plus bas. */
const KEEPS_ALPHA = ["image/png", "image/webp", "image/gif"];

/* L'image est ramenée à une taille d'affiche avant d'être rangée. IndexedDB
   pourrait encaisser l'original, mais 700 px suffisent largement au plus grand
   affichage : autant garder la base légère et le rendu instantané.

   LE FOND QUI DEVENAIT NOIR. Tout ressortait en JPEG, y compris les PNG
   détourés. Or un JPEG n'a pas de canal alpha : le canevas est
   transparent là où l'image ne peint rien, et l'encodeur, n'ayant nulle
   part où ranger cette transparence, la rend en noir. Un objet de déco
   découpé arrivait donc sur l'étagère dans un rectangle noir.

   On garde donc le format quand il sait porter la transparence, et le
   JPEG pour tout le reste — une affiche est une photo, elle n'a pas de
   trou et le PNG la ferait peser trois fois plus. */
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
        // un Blob, pas une chaîne base64 : c'est tout l'intérêt d'IndexedDB
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("encodage impossible"))),
          alpha ? "image/png" : "image/jpeg",
          // la qualité ne dit rien au PNG, qui ne perd rien
          alpha ? undefined : 0.82
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
