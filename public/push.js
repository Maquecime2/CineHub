/* ============================================================
   CE QUE LE CLASSEUR FAIT D'UNE NOTIFICATION
   ============================================================

   Ce fichier est chargé PAR le service worker fabriqué par le greffon
   (`workbox.importScripts`). Il n'est pas le service worker : celui-là
   est généré à la construction, avec la liste des fichiers précachés,
   et on ne peut pas y écrire à la main sans le remplacer entièrement.

   Il tient en deux gestes, et n'en veut pas un troisième :
   afficher ce qu'on a reçu, et ouvrir le classeur quand on y touche.
   ============================================================ */
/* `self` est déjà connu d'ESLint dans un contexte de travailleur ; seul
   `clients` a besoin d'être déclaré. */
/* global clients */

self.addEventListener("push", (e) => {
  /* Un message vide arrive pour de vrai — certains services de push en
     envoient pour maintenir la connexion, et Chrome exige alors qu'on
     affiche quand même quelque chose sous peine de couper
     l'abonnement. D'où le repli, plutôt qu'un `return`. */
  let m = { titre: "Ciné Hub", corps: "" };
  try {
    if (e.data) m = { ...m, ...e.data.json() };
  } catch {
    /* Ce n'était pas du JSON : on montre le titre seul plutôt que de
       laisser une notification vide, que le système compterait comme
       un abus. */
  }

  e.waitUntil(
    self.registration.showNotification(m.titre, {
      body: m.corps,
      icon: "icone-192.png",
      badge: "icone-192.png",
      /* Une seule notification de défi à la fois : la remplacer vaut
         mieux que d'en empiler trois pour la même chose. */
      tag: m.tag || "cinehub",
      data: { url: m.url || "." },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  /* ON RÉUTILISE UN ONGLET DÉJÀ OUVERT plutôt que d'en ouvrir un
     deuxième : le classeur installé n'a qu'une fenêtre, et en ouvrir
     une seconde perdrait ce qui était en cours d'écriture dans la
     première. */
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ("focus" in f) return f.focus();
      }
      return clients.openWindow(e.notification.data?.url || ".");
    })
  );
});
