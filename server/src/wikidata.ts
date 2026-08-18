/* ============================================================
   WHAT WIKIDATA KNOWS AND TMDB DOES NOT
   ============================================================

   The Programme screen holds an ORDER and the BONDS between film-makers
   that justify it. Until now a bond was only ever born of an empty form
   where two names are typed from memory, so a fresh binder shows a map
   with not one edge on it — and a run no step can justify.

   TMDB CANNOT HELP HERE, AND IT IS WORTH SAYING PLAINLY. It knows who
   worked on which film and nothing else: there is no "taught" in it, at
   all. "X studied under Y" is in Wikidata, as three properties, and
   Wikidata also carries a TMDB person id (P4985) — which is the hinge
   with the binder, since the binder only ever knows NAMES.

     P1066  student of      ?a is the STUDENT of ?b
     P802   student         ?a has ?b for a student
     P737   influenced by   ?a is influenced by ?b

   THE MEANING IS THE TRAP AND IT IS REVERSED ONE TIME IN TWO. This
   module does not turn any of it into a bond: it hands back the triple
   as it stands, `?a ?p ?b`, and `src/domain/hints.ts` does the turning,
   under test. The server has no business holding the client's
   vocabulary.

   WHY THE SERVER AND NOT THE BROWSER — two reasons, and either would do.
   `query.wikidata.org` asks for a descriptive User-Agent, which a
   browser will not let anyone set; and a relay that forwarded a SPARQL
   query as given would be exactly the open relay `relay.ts` refuses at
   the top of the file. So THE SERVER WRITES THE QUERY. The client sends
   nothing but numbers.
   ============================================================ */

const ENDPOINT = "https://query.wikidata.org/sparql";

/* WIKIMEDIA ASKS WHO IS CALLING, and answers 403 to whoever will not
   say. There is no key and no quota here — only this politeness, and it
   is the whole price of admission. */
const AGENT = "CineHub/1.0 (https://github.com/Maquecime/letterhubed; carnet de cinema)";

/** The three properties, and nothing else ever. */
export const LINEAGE_PROPS = ["P1066", "P802", "P737"] as const;

/** One triple, flattened. `prop` is read as `from ?prop to`. */
export interface RawLink {
  /** The TMDB id we asked about — the one end we are sure of. */
  seed: string;
  from: string;
  to: string;
  prop: string;
}

/* AT MOST FIFTY, AND THE BOUND IS NOT DECORATIVE. `VALUES` takes fifty
   ids without flinching; it is the URL and the courtesy to a free,
   shared endpoint that stop there. */
export const MAX_SEEDS = 50;

export function sparqlFor(ids: string[]): string {
  /* The ids are digits and nothing else — the route checks it before we
     are called, and we quote them all the same: a value that reaches a
     query unquoted is a value that can become syntax. */
  const values = ids.map((id) => `"${id}"`).join(" ");
  const props = LINEAGE_PROPS.map((p) => `wdt:${p}`).join(" ");
  /* THE SEED IS ON EITHER SIDE, and one direction would have missed
     half of it: someone in the binder is quite as likely to be named as
     the MASTER of a stranger as to be the stranger's pupil. */
  return `SELECT ?tmdb ?p ?a ?aLabel ?b ?bLabel WHERE {
  VALUES ?tmdb { ${values} }
  ?seed wdt:P4985 ?tmdb .
  VALUES ?p { ${props} }
  { ?seed ?p ?b . BIND(?seed AS ?a) }
  UNION
  { ?a ?p ?seed . BIND(?seed AS ?b) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}
LIMIT 500`;
}

interface Cell {
  value?: string;
}
interface Row {
  [name: string]: Cell | undefined;
}

/* A label the service could not find comes back as the Q-item itself.
   "Q76" is not a film-maker's name: it would land in the binder as a
   key, on the map as a node, and stay there. */
const NAMELESS = /^Q\d+$/;

/** The last segment of a property URI: `.../prop/direct/P1066` -> `P1066`. */
const propOf = (uri: string): string => uri.slice(uri.lastIndexOf("/") + 1);

export function readSparql(body: unknown): RawLink[] {
  const rows = (body as { results?: { bindings?: Row[] } })?.results?.bindings;
  if (!Array.isArray(rows)) return [];
  const out: RawLink[] = [];
  for (const row of rows) {
    const seed = row.tmdb?.value ?? "";
    const from = (row.aLabel?.value ?? "").trim();
    const to = (row.bLabel?.value ?? "").trim();
    const prop = propOf(row.p?.value ?? "");
    if (!seed || !from || !to) continue;
    if (NAMELESS.test(from) || NAMELESS.test(to)) continue;
    if (!(LINEAGE_PROPS as readonly string[]).includes(prop)) continue;
    out.push({ seed, from, to, prop });
  }
  return out;
}

/** Asks Wikidata about these TMDB ids. Throws if it will not answer. */
export async function lineageLinks(ids: string[]): Promise<RawLink[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(sparqlFor(ids))}&format=json`;
  const res = await fetch(url, {
    headers: { accept: "application/sparql-results+json", "user-agent": AGENT },
  });
  if (!res.ok) throw new Error(`Wikidata: ${res.status}`);
  return readSparql(await res.json());
}
