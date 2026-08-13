/* ============================================================
   WHAT THE BINDER MAKES OF A NOTIFICATION
   ============================================================

   This file is loaded BY the service worker the plugin builds
   (`workbox.importScripts`). It is not the service worker itself: that
   one is generated at build time, with the list of precached files, and
   there is no writing into it by hand without replacing it entirely.

   It holds two gestures, and wants no third: show what came in, and open
   the binder when somebody touches it.
   ============================================================ */
/* `self` is already known to ESLint in a worker context; only `clients`
   needs declaring. */
/* global clients */

self.addEventListener("push", (e) => {
  /* An empty message really does arrive — some push services send them
     to keep the connection alive, and Chrome then insists something be
     shown all the same, on pain of cutting the subscription off. Hence
     the fallback, rather than a `return`.

     THE KEYS ARE THE SERVER'S: `server/src/push.ts` sends `title` and
     `body`. The two spellings change together or not at all — renaming
     one side alone silences every notification, silently. */
  let m = { title: "Ciné Hub", body: "" };
  try {
    if (e.data) m = { ...m, ...e.data.json() };
  } catch {
    /* That was not JSON: we show the title alone rather than leave an
       empty notification, which the system would count as an abuse. */
  }

  e.waitUntil(
    self.registration.showNotification(m.title, {
      body: m.body,
      icon: "icone-192.png",
      badge: "icone-192.png",
      /* One challenge notification at a time: replacing it is better
         than stacking three for the same thing. */
      tag: m.tag || "cinehub",
      data: { url: m.url || "." },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  /* WE REUSE A TAB THAT IS ALREADY OPEN rather than open a second one:
     the installed binder has one window, and opening a second would lose
     whatever was being written in the first. */
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ("focus" in w) return w.focus();
      }
      return clients.openWindow(e.notification.data?.url || ".");
    })
  );
});
