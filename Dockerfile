# ============================================================
#  LE CLASSEUR — des fichiers statiques, servis par Caddy
# ============================================================
#
#  LES VARIABLES `VITE_*` SONT CUITES DANS LE PAQUET, et c'est la seule
#  chose à comprendre ici. Vite les remplace à la construction : elles ne
#  se lisent pas au démarrage du conteneur, elles sont écrites dans le
#  JavaScript livré. Changer l'adresse du serveur ou celle de la mesure
#  demande donc de RECONSTRUIRE l'image, pas de la relancer.
#
#  D'où leur passage en `ARG` plutôt qu'en `ENV` : un argument de
#  construction dit exactement cela — il vaut pendant qu'on fabrique, et
#  plus après.
# ============================================================
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_SERVEUR=""
ARG VITE_UMAMI=""
ARG VITE_UMAMI_ID=""
ENV VITE_SERVEUR=$VITE_SERVEUR
ENV VITE_UMAMI=$VITE_UMAMI
ENV VITE_UMAMI_ID=$VITE_UMAMI_ID

RUN npm run build

# ------------------------------------------------------------
#  Caddy sert le résultat, et rien d'autre.
# ------------------------------------------------------------
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
