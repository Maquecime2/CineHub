# ============================================================
#  LE SERVEUR — TypeScript joué directement, sans compilation
# ============================================================
#
#  Ce paquet ne se compile pas : Node efface les types au chargement
#  (`--experimental-strip-types`). Il n'y a donc pas d'étape de
#  construction ici, et pas de `dist/` — on copie les sources et on les
#  lance.
#
#  LA CONSÉQUENCE EST DANS `npm run boot`, ET ELLE EST SÉRIEUSE. Effacer
#  n'est pas transformer : une propriété de paramètre, un `enum`, un
#  `namespace` arrêtent le démarrage net, et ni `tsc` ni les tests ne le
#  voient. Le contrôle tourne donc À LA CONSTRUCTION DE L'IMAGE, pour que
#  l'image ne parte jamais avec un serveur qui ne démarre pas.
# ============================================================
FROM node:24-alpine

WORKDIR /app

# Les dépendances d'abord : elles changent moins souvent que le code, et
# cette couche se garde d'une construction à l'autre.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
COPY sql ./sql
COPY scripts ./scripts

# LE GARDE-FOU, ICI ET PAS AILLEURS. Il charge chaque module par Node
# lui-même : c'est la seule chose qui reproduise le démarrage réel.
RUN npm run boot

ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "--experimental-strip-types", "src/index.ts"]
