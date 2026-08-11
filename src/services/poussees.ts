/* ============================================================
   LES NOTIFICATIONS, VUES DU CLASSEUR
   ============================================================

   FACULTATIVES DE BOUT EN BOUT, comme le serveur lui-même. Il faut un
   serveur, des clés posées dessus, un service worker enregistré, et la
   permission du système : quatre conditions, dont trois échappent
   complètement à l'application. Chacune manquante rend simplement
   `possible: false`, et le réglage ne s'affiche pas — plutôt qu'un
   interrupteur qui ne fait rien.

   LA PERMISSION NE SE DEMANDE QU'AU CLIC, jamais à l'ouverture. Une
   application qui réclame le droit de sonner avant qu'on ait rien fait
   se le voit refuser pour toujours — le refus est définitif dans la
   plupart des navigateurs, et il n'y a pas de seconde chance.
   ============================================================ */
import { ADRESSE, serveurConfigure } from "./serveur";

export interface EtatPoussees {
  /** Le serveur en envoie, et ce navigateur sait en recevoir. */
  possible: boolean;
  /** Cet appareil est-il abonné ? */
  abonne: boolean;
  /** La permission a été refusée : on ne peut plus rien demander. */
  refusee: boolean;
}

const supporte = (): boolean =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof window !== "undefined" &&
  "PushManager" in window &&
  "Notification" in window;

/** La clé publique du serveur, une fois lue. `null` s'il n'en a pas. */
async function cleDuServeur(): Promise<string | null> {
  if (!serveurConfigure()) return null;
  try {
    const r = await fetch(`${ADRESSE}/poussees`, { credentials: "include" });
    if (!r.ok) return null;
    const { possible, cle } = (await r.json()) as { possible: boolean; cle: string | null };
    return possible ? cle : null;
  } catch {
    return null;
  }
}

export async function etatDesPoussees(): Promise<EtatPoussees> {
  const eteint = { possible: false, abonne: false, refusee: false };
  if (!supporte() || !(await cleDuServeur())) return eteint;
  const sw = await navigator.serviceWorker.getRegistration();
  if (!sw) return eteint;
  return {
    possible: true,
    abonne: (await sw.pushManager.getSubscription()) !== null,
    refusee: Notification.permission === "denied",
  };
}

/** Rend `false` si la permission a été refusée — l'appelant le dit. */
export async function sAbonner(): Promise<boolean> {
  const cle = await cleDuServeur();
  const sw = await navigator.serviceWorker.getRegistration();
  if (!cle || !sw) return false;

  if ((await Notification.requestPermission()) !== "granted") return false;

  /* `userVisibleOnly` est obligatoire et n'est pas une formalité : on
     s'engage à ce que chaque message poussé produise une notification
     visible. Un push silencieux serait un canal de suivi, et les
     navigateurs le refusent — à raison. */
  const abo = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: enOctets(cle),
  });

  const brut = abo.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  const r = await fetch(`${ADRESSE}/poussees`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      point: abo.endpoint,
      p256dh: brut.keys?.p256dh,
      secret: brut.keys?.auth,
    }),
  });
  if (!r.ok) {
    /* Le serveur n'a pas voulu de cet abonnement : le garder côté
       navigateur laisserait un appareil qui croit être abonné et que
       personne n'appellera jamais. */
    await abo.unsubscribe();
    return false;
  }
  return true;
}

export async function seDesabonner(): Promise<void> {
  const sw = await navigator.serviceWorker.getRegistration();
  const abo = await sw?.pushManager.getSubscription();
  if (!abo) return;
  /* On prévient le serveur AVANT de se désabonner : après, on n'a plus
     l'adresse à lui donner, et sa ligne resterait à pousser dans le
     vide jusqu'au premier 410. */
  await fetch(`${ADRESSE}/poussees`, {
    method: "DELETE",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ point: abo.endpoint }),
  }).catch(() => {});
  await abo.unsubscribe();
}

/* La clé VAPID voyage en base64url et `subscribe` veut des octets. La
   conversion est bête ; l'oublier donne une erreur qui ne dit rien. */
function enOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const brut = atob(base64);
  /* Le tampon est nommé explicitement : `Uint8Array.from` rend un
     tableau sur `ArrayBufferLike`, que `subscribe` n'accepte pas — il
     veut un tampon non partagé, et le dire ici évite un `as` qui
     masquerait une vraie erreur un jour. */
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}
