/* ============================================================
   LES MÉDIAS — un miroir, jamais l'original
   ============================================================

   Until now nothing binary left the machine it was made on. The
   synchronisation carries cards and documents, both of them JSON; the
   blobs — imported posters, screenshots, decoration objects — stayed in
   IndexedDB, which is why a card seen on a second computer showed
   "stayed on the other device" where its poster should have been.

   This module gives them a place to be copied to. A COPY, and the word
   matters: IndexedDB stays the original, the binder goes on working
   entirely offline, and a container that cannot be reached costs
   nothing but a poster that has not arrived yet.

   OPTIONAL FROM END TO END, like the push notifications and like the
   TMDB relay: with no connection string the module says so, the routes
   answer "no service", and the whole of the rest carries on.

   ------------------------------------------------------------
   THE ONE THING TO UNDERSTAND: TWO PREFIXES, TWO KINDS OF PROOF

     p/<person id>/<key>   private — a poster, a screenshot, a thumbnail
     decor/<decor id>      shareable — a decoration object

   For the private branch the PATH IS THE PROOF: a ticket is issued if
   and only if the prefix is the asker's own. It is the same guarantee as
   the `WHERE person_id = $1` that guards every query in `store.ts`, and
   it is the simplest one in the system.

   Decors could not live under it. A decor outlives the card that saw it
   made and MAY BE READ BY SOMEBODY ELSE; filed under a private prefix,
   sharing one would have meant issuing tickets on another person's
   private prefix — and that simple guarantee would have been gone for
   everything, posters included. So they are filed apart, and their right
   to be read is asked of the database (`canReadDecor`).

   Anything that falls in neither branch is refused. Not because we have
   thought of what else could be asked for, but because we have not.
   ============================================================ */
import {
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import type { Db } from "./db.ts";
import * as store from "./store.ts";

export interface AzureSettings {
  /** The account's name, as Azure spells it. */
  account: string;
  /** One of its access keys. It never leaves this process. */
  key: string;
  container: string;
  /** Where the blobs are, if it is not the public Azure endpoint. */
  endpoint?: string;
}

let settings: AzureSettings | null = null;
let credential: StorageSharedKeyCredential | null = null;

/**
 * Reads a connection string, of the shape Azure hands out:
 * `DefaultEndpointsProtocol=…;AccountName=…;AccountKey=…;EndpointSuffix=…`
 *
 * Returns `null` if it is unusable, rather than starting on half of it —
 * a server that starts on a guessed configuration runs for a month
 * before anybody notices.
 */
export function readConnectionString(
  raw: string | undefined,
  container: string | undefined
): AzureSettings | null {
  if (!raw || !container) return null;
  const parts = new Map<string, string>();
  for (const bit of raw.split(";")) {
    const at = bit.indexOf("=");
    if (at > 0) parts.set(bit.slice(0, at).trim(), bit.slice(at + 1).trim());
  }
  const account = parts.get("AccountName");
  const key = parts.get("AccountKey");
  if (!account || !key) return null;

  const scheme = parts.get("DefaultEndpointsProtocol") || "https";
  const suffix = parts.get("EndpointSuffix") || "core.windows.net";
  return {
    account,
    key,
    container,
    endpoint: parts.get("BlobEndpoint") || `${scheme}://${account}.blob.${suffix}`,
  };
}

export function configureMedia(s: AzureSettings | null): void {
  settings = s;
  credential = s ? new StorageSharedKeyCredential(s.account, s.key) : null;
}

export const mediaAvailable = (): boolean => settings !== null;

/* ------------------------------------------------------------
   LA FORME D'UN CHEMIN
   ------------------------------------------------------------
   Checked BEFORE it goes anywhere near a URL. A key comes from the
   client, and the client is somebody's browser: the shapes below are
   exactly what the binder makes (`still-<id>-<uid>`, `<id>-<stamp>`,
   `<key>-thumb`) and nothing else gets through. */

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const PRIVATE_PATH = new RegExp(`^p/(${UUID})/([A-Za-z0-9:_.-]{1,120})$`);
const DECOR_PATH = new RegExp(`^decor/(${UUID})$`);

export type Mode = "read" | "write";

/** What a path turns out to be, once read. */
export type Target =
  { kind: "private"; personId: string; key: string } | { kind: "decor"; decorId: string } | null;

export function readPath(path: string): Target {
  const mine = PRIVATE_PATH.exec(path);
  if (mine) return { kind: "private", personId: mine[1]!, key: mine[2]! };
  const decor = DECOR_PATH.exec(path);
  if (decor) return { kind: "decor", decorId: decor[1]! };
  return null;
}

/**
 * MAY THIS PERSON DO THIS TO THIS BLOB?
 *
 * The two branches do not answer the same way, and that is the whole
 * design: the private one compares a prefix, the shared one asks the
 * database. Neither ever asks Azure — a container is storage, it holds
 * no opinion about who somebody is.
 */
export async function allowed(
  db: Db,
  personId: string,
  path: string,
  mode: Mode
): Promise<boolean> {
  const target = readPath(path);
  if (!target) return false;
  if (target.kind === "private") return target.personId === personId;
  return mode === "write"
    ? store.ownsDecor(db, personId, target.decorId)
    : store.canReadDecor(db, personId, target.decorId);
}

/* ------------------------------------------------------------
   LE TICKET
   ------------------------------------------------------------
   A signature for ONE blob and ONE verb, valid a quarter of an hour.
   Not for the container, not for a prefix: for the blob named in it. A
   ticket that leaks is then worth one object for fifteen minutes, and
   the account key it was signed with never left this process. */

const LIFE_MS = 15 * 60 * 1000;
/* Clocks drift, and a ticket that starts in the future is refused by
   Azure with an error nobody can read. Five minutes of margin. */
const EARLY_MS = 5 * 60 * 1000;

export function ticketFor(path: string, mode: Mode): string | null {
  if (!settings || !credential) return null;
  const sas = generateBlobSASQueryParameters(
    {
      containerName: settings.container,
      blobName: path,
      /* `c` as well as `w`: writing a blob that does not exist yet is
         creating it, and Azure counts the two separately. */
      permissions: BlobSASPermissions.parse(mode === "write" ? "cw" : "r"),
      startsOn: new Date(Date.now() - EARLY_MS),
      expiresOn: new Date(Date.now() + LIFE_MS),
    },
    credential
  ).toString();
  return `${settings.endpoint}/${settings.container}/${encodeURI(path)}?${sas}`;
}

/** The container's address, for a client that wants to name a blob. */
export const containerAddress = (): string | null =>
  settings ? `${settings.endpoint}/${settings.container}` : null;
