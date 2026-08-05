# Votre propre relais pour Letterboxd

## Pourquoi il en faut un

Letterboxd ne renvoie aucun en-tête `Access-Control-Allow-Origin`, ni sur son
flux RSS ni sur ses pages. Le navigateur va donc chercher la réponse, la
reçoit, et **refuse de la donner à la page** : c'est une règle du navigateur,
aucune astuce côté application ne la contourne.

Le relais sert aux **deux** relevés de la page d'import : les séances, qui
viennent du flux RSS, et la watchlist, qui n'a pas de flux et se lit dans les
pages `/{pseudo}/watchlist/page/N/`. Le Worker ci-dessous accepte n'importe
quel chemin de `letterboxd.com` : il couvre les deux sans un mot de plus.

Il faut donc quelqu'un qui lise le flux à notre place et nous le repasse en
autorisant la lecture. Deux cas :

- **En local** (`npm run dev`), c'est déjà réglé : le serveur Vite relaie
  lui-même (`server.proxy` dans `vite.config.ts`). Vous n'avez rien à faire, et
  le réglage « relais » de la page d'import ne sert pas.
- **En ligne**, CineHub est un GitHub Pages **statique** : il n'y a aucun
  serveur à nous pour faire ce travail. L'application passe donc par un relais
  public, réglé par défaut. Il marche, mais il appartient à quelqu'un d'autre —
  il peut ralentir, brider ou disparaître.

Ce document explique comment déployer le vôtre, en une dizaine de minutes et
gratuitement. Vous n'en avez besoin que si le relais par défaut vous lâche ou
si vous préférez ne dépendre de personne.

## Un Cloudflare Worker

Le palier gratuit couvre 100 000 requêtes par jour, très largement de quoi
relever un flux RSS.

1. Créez un compte sur [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Dans le tableau de bord : **Workers & Pages → Create → Start with Hello
   World → Deploy**.
3. **Edit code**, remplacez tout par ceci, puis **Deploy** :

```js
/* Relais pour le flux RSS de Letterboxd, et rien d'autre.

   Le garde-fou sur le domaine n'est pas une précaution de principe : un
   relais qui accepte n'importe quelle adresse devient l'outil de
   n'importe qui, sous votre compte et à vos frais. */
export default {
  async fetch(request) {
    const cible = new URL(request.url).searchParams.get("url");
    if (!cible) return new Response("url manquante", { status: 400 });

    let dest;
    try {
      dest = new URL(cible);
    } catch {
      return new Response("url invalide", { status: 400 });
    }
    if (dest.protocol !== "https:" || dest.hostname !== "letterboxd.com")
      return new Response("ce relais ne dessert que letterboxd.com", { status: 403 });

    const amont = await fetch(dest.toString(), {
      headers: { "user-agent": "CineHub" },
    });
    return new Response(amont.body, {
      status: amont.status,
      headers: {
        "content-type": amont.headers.get("content-type") || "application/rss+xml",
        "access-control-allow-origin": "*",
        // le flux ne bouge pas d'une minute à l'autre
        "cache-control": "public, max-age=600",
      },
    });
  },
};
```

4. Cloudflare vous donne une adresse du genre
   `https://mon-relais.mon-compte.workers.dev`.
5. Dans CineHub, page **Archives**, bloc « OU RELEVER VOTRE FLUX », dépliez
   **relais** et collez :

```
https://mon-relais.mon-compte.workers.dev/?url={url}
```

`{url}` est remplacé par l'adresse du flux, déjà encodée. Le réglage est retenu
d'une fois sur l'autre.

## Vérifier qu'il marche

Ouvrez directement dans un onglet :

```
https://mon-relais.mon-compte.workers.dev/?url=https%3A%2F%2Fletterboxd.com%2Fdave%2Frss%2F
```

Vous devez voir du XML. Une erreur 403 sur une autre adresse que
`letterboxd.com` est le comportement attendu — c'est le garde-fou qui fait son
travail.
