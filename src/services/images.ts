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

/* L'image est ramenée à une taille d'affiche avant d'être rangée. IndexedDB
   pourrait encaisser l'original, mais 700 px suffisent largement au plus grand
   affichage : autant garder la base légère et le rendu instantané. */
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
        // un Blob, pas une chaîne base64 : c'est tout l'intérêt d'IndexedDB
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("encodage impossible"))),
          "image/jpeg",
          0.82
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
