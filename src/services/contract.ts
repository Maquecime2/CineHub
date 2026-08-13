/* ============================================================
   THE CONTRACT — the field names both halves agree on
   ============================================================

   THIS FILE EXISTS BECAUSE OF A BUG NOBODY COULD SEE. The English pass
   renamed the server's reply from `{ who }` to `{ person }` and left the
   binder reading `r.who`. Signing up then created the account, laid down
   the passkey, opened the session — and the screen fell over on
   `undefined.id` while reading the answer. The account existed and was
   unreachable, which is about the worst shape a failure can take.

   Neither control caught it, and neither could have. `npm test` mocks
   the server, so the mock repeated the mistake. `npm run typecheck`
   validated `call<{ who: Person }>` — a type written BY HAND about
   somebody else's JSON. TypeScript checks that the code agrees with what
   we declared; it has no way to know we declared a falsehood.

   So the name is written ONCE, here, as a function rather than a type.
   A function survives compilation — the server's tests can therefore
   call it on a real reply and see it work or fail. The binder reads
   through it, the tests check it, and the two can no longer drift apart
   in silence.

   NO IMPORT, EVER. This file is read from both packages, which do not
   share a `node_modules`. It must stay pure types and pure functions.
   ============================================================ */

export interface Person {
  id: string;
  pseudo: string;
}

/** What the server answers when it says who somebody is. */
export interface PersonReply {
  person: Person;
}

/**
 * The person in a reply from `/me`, `/auth/signup/verify`,
 * `/auth/signin/verify` or `/dev/session` — the four routes that name
 * somebody, and the four that used to disagree.
 */
export const readPerson = (body: PersonReply): Person => body.person;
