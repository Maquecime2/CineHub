/* ============================================================
   LA BASE — une seule façon de poser une question
   ============================================================

   Pas d'ORM. Le schéma est un fichier SQL qu'on lit (`sql/001_socle.sql`)
   et les requêtes sont du SQL écrit à la main, avec des paramètres
   numérotés. Deux raisons, et aucune n'est l'esthétique.

   D'abord : ce serveur n'a rien de compliqué à demander. Une douzaine de
   requêtes, toutes courtes. Un ORM apporterait un langage de plus à
   connaître, un générateur de code à faire tourner, et sa propre
   surface d'attaque — celle qu'on a justement écartée en le retirant.

   Ensuite : les paramètres numérotés ne se concatènent pas. Une valeur
   passée en `$1` ne peut pas devenir de la syntaxe, jamais, quelle que
   soit la chaîne. C'est la seule défense qui tienne contre l'injection,
   et elle est ici la façon NORMALE d'écrire — pas une précaution qu'on
   pense à prendre.

   L'interface est minuscule exprès : le vrai Postgres l'implémente en
   production, et un Postgres compilé en WebAssembly l'implémente dans
   les tests. Les mêmes requêtes tournent des deux côtés — les tests
   éprouvent donc le SQL réel, contraintes comprises, et non une
   imitation. */
export interface Base {
  requete<T = Record<string, unknown>>(texte: string, valeurs?: unknown[]): Promise<T[]>;
  /* UNE REQUÊTE PRÉPARÉE NE PORTE QU'UNE COMMANDE, et c'est une règle du
     protocole et non une limite de bibliothèque : le socle, qui en
     compte une vingtaine, ne peut donc pas passer par `requete`. D'où
     cette seconde porte, réservée aux scripts — sans paramètres, donc
     sans valeur venue du dehors, donc sans injection possible. */
  executer(script: string): Promise<void>;
  fermer(): Promise<void>;
}

/** Une seule ligne, ou rien. Le cas le plus fréquent. */
export async function une<T = Record<string, unknown>>(
  base: Base,
  texte: string,
  valeurs?: unknown[]
): Promise<T | null> {
  const lignes = await base.requete<T>(texte, valeurs);
  return lignes[0] ?? null;
}

/* ------------------------------------------------------------
   POSTGRES, LE VRAI
   ------------------------------------------------------------ */
export async function ouvrirPostgres(url: string): Promise<Base> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    /* Le serveur est petit et les requêtes sont brèves : dix connexions
       suffisent, et un hébergeur géré facture les connexions ouvertes. */
    max: 10,
    onnotice: () => {},
  });
  return {
    requete: async <T>(texte: string, valeurs: unknown[] = []) =>
      sql.unsafe(texte, valeurs as never[]) as unknown as Promise<T[]>,
    executer: async (script: string) => {
      /* `simple()` passe par le protocole simple, le seul qui accepte
         plusieurs commandes d'un coup. Il n'accepte AUCUN paramètre en
         échange — ce qui est exactement ce qu'on veut ici. */
      await sql.unsafe(script).simple();
    },
    fermer: () => sql.end(),
  };
}

/* ------------------------------------------------------------
   LE SOCLE, POSÉ
   ------------------------------------------------------------
   Une seule migration pour l'instant, et un fichier qu'on relit plutôt
   qu'une pile d'incréments illisibles. Quand il y en aura une seconde,
   c'est ici qu'on tiendra la liste — et le jour où elles seront
   nombreuses, la table qui dit lesquelles sont posées. */
export async function poserLeSocle(base: Base, sqlDuSocle: string): Promise<void> {
  await base.executer(sqlDuSocle);
}
