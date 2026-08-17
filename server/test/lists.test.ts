import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE LISTS, AND THE CHALLENGES DRAWN FROM THEM

   Two things are tried here, and the second one counts more.

   THE ASYMMETRY: co-building is a right to write, not shared ownership.
   A member adds films; they do not rename, do not publish, do not
   erase.

   PROGRESS IS COMPUTED FROM THE SCREENING LOG — the very one that never
   leaves a shared collection. It must not leave any further here
   either: a number, for people who asked to take part, and nothing
   else.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const createList = async (cookie: string, body: Record<string, unknown> = {}) =>
  (
    await app.inject({
      method: "POST",
      url: "/lists",
      headers: { cookie },
      payload: { title: "Les mois de Varda", ...body },
    })
  ).json().id as string;

const addWork = (cookie: string, list: string, tmdbId: string, title = "Cléo") =>
  app.inject({
    method: "POST",
    url: `/lists/${list}/works`,
    headers: { cookie },
    payload: { tmdbId, title },
  });

const readTheList = (cookie: string, list: string) =>
  app.inject({ method: "GET", url: `/lists/${list}`, headers: { cookie } });

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a list", () => {
  it("is closed by default, and invisible to others", async () => {
    const me = await count("mine");
    const other = await count("other");
    const id = await createList(me.cookie);

    expect((await readTheList(me.cookie, id)).json().list.is_public).toBe(false);
    /* The same 404 as "does not exist": telling them apart would tell a
       stranger that this identifier designates something. */
    const refused = await readTheList(other.cookie, id);
    const ghost = await readTheList(other.cookie, "00000000-0000-4000-8000-000000000000");
    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toEqual(ghost.json());
  });

  it("holds works and not cards, and never the same one twice", async () => {
    /* A list of cards would be a list of somebody's own copies: it
       would mean nothing at somebody else's, and would empty itself the
       day its author erased a card. */
    const me = await count("mine");
    const id = await createList(me.cookie);
    expect((await addWork(me.cookie, id, "550")).json().fresh).toBe(true);
    expect((await addWork(me.cookie, id, "550")).json().fresh).toBe(false);

    const r = await readTheList(me.cookie, id);
    expect(r.json().works).toHaveLength(1);
    expect(r.json().works[0]).toMatchObject({ tmdb_id: "550", by: "mine" });
  });

  it("refuses what is not a work identifier", async () => {
    const me = await count("mine");
    const id = await createList(me.cookie);
    const r = await app.inject({
      method: "POST",
      url: `/lists/${id}/works`,
      headers: { cookie: me.cookie },
      payload: { tmdbId: "Cléo de 5 à 7" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("a mistyped address answers 404, and not a breakdown", async () => {
    const me = await count("mine");
    expect((await readTheList(me.cookie, "pas-un-uuid")).statusCode).toBe(404);
  });
});

describe("co-building", () => {
  it("lets you write, and not administer", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const id = await createList(me.cookie);
    await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });

    expect((await addWork(ami.cookie, id, "550")).statusCode).toBe(200);
    /* Without that asymmetry, a list built by six hands has nobody left
       to answer for it. */
    const rename = await app.inject({
      method: "PUT",
      url: `/lists/${id}`,
      headers: { cookie: ami.cookie },
      payload: { title: "à me maintenant" },
    });
    const effacer = await app.inject({
      method: "DELETE",
      url: `/lists/${id}`,
      headers: { cookie: ami.cookie },
    });
    expect(rename.statusCode).toBe(403);
    expect(effacer.statusCode).toBe(403);
  });

  it("one does not invite somebody one has silenced", async () => {
    const me = await count("mine");
    await count("genant");
    const id = await createList(me.cookie);
    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const r = await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/genant`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  it("leaving asks nobody's permission", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const id = await createList(me.cookie);
    await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });

    const parti = await app.inject({
      method: "DELETE",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: ami.cookie },
    });
    expect(parti.statusCode).toBe(200);
    expect((await readTheList(ami.cookie, id)).statusCode).toBe(404);
  });

  it("a visitor to a public list does not read who holds it", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const passant = await count("passant");
    const id = await createList(me.cookie, { is_public: true });
    await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });

    expect((await readTheList(passant.cookie, id)).json().members).toEqual([]);
    expect((await readTheList(ami.cookie, id)).json().members).toEqual(["ami"]);
  });
});

/* ============================================================
   CE QU'UNE LISTE PARTAGÉE RAPPORTE
   ============================================================

   `list_shared` était déclaré dans les deux barèmes depuis toujours et
   crédité par personne. Ces quatre cas sont ce qui empêche la ligne de
   redevenir soit morte, soit une ferme à points : la référence composite
   fait qu'une même personne ne paie qu'une fois, et la route interdit
   déjà de s'inviter soi-même.
   ============================================================ */
describe("what a shared list is worth", () => {
  const member = (cookie: string, list: string, pseudo: string) =>
    app.inject({ method: "PUT", url: `/lists/${list}/members/${pseudo}`, headers: { cookie } });

  const paid = async (personId: string) =>
    (
      await db.query<{ merit: number }>(
        `SELECT merit FROM merit_event WHERE person_id = $1 AND kind = 'list_shared'`,
        [personId]
      )
    ).map((r) => r.merit);

  it("pays the owner when the list reaches somebody", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const id = await createList(me.cookie);
    await member(me.cookie, id, "ami");

    expect(await paid(me.person.id)).toEqual([5]);
    /* Celui qu'on invite ne gagne rien : c'est la liste qui a atteint
       quelqu'un, pas quelqu'un qui a fait quelque chose. */
    expect(await paid(ami.person.id)).toEqual([]);
  });

  it("does not pay twice for the same person coming and going", async () => {
    const me = await count("mine");
    await count("ami");
    const id = await createList(me.cookie);
    await member(me.cookie, id, "ami");
    await app.inject({
      method: "DELETE",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });
    await member(me.cookie, id, "ami");

    /* La référence porte la liste ET la personne : retirer et remettre
       n'est pas une façon d'enrichir un ami. */
    expect(await paid(me.person.id)).toEqual([5]);
  });

  it("pays again for a DIFFERENT person", async () => {
    const me = await count("mine");
    await count("ami");
    await count("autre");
    const id = await createList(me.cookie);
    await member(me.cookie, id, "ami");
    await member(me.cookie, id, "autre");

    expect(await paid(me.person.id)).toEqual([5, 5]);
  });

  it("never pays somebody for inviting themselves", async () => {
    const me = await count("mine");
    const id = await createList(me.cookie);
    const own = await member(me.cookie, id, "mine");

    expect(own.statusCode).toBe(400);
    expect(await paid(me.person.id)).toEqual([]);
  });
});

describe("a challenge", () => {
  const vu = (date: string) => ({ watches: [{ date }] });

  async function testChallenge() {
    const me = await count("mine");
    const list = await createList(me.cookie);
    await addWork(me.cookie, list, "550");
    await addWork(me.cookie, list, "551");
    const id = (
      await app.inject({
        method: "POST",
        url: "/challenges",
        headers: { cookie: me.cookie },
        payload: { listId: list, title: "Mars", starts_on: "2026-03-01", ends_on: "2026-03-31" },
      })
    ).json().id as string;
    return { me, list, id };
  }

  it("counts what was seen DURING the period, and nothing else", async () => {
    const { me, id } = await testChallenge();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Cléo", ...vu("2026-03-12") } },
          /* Seen, but last year: a monthly challenge that counted films
             seen three years ago would be won by signing up. */
          { id: "b", tmdbId: "551", updatedAt: 1, data: { title: "Autre", ...vu("2025-01-04") } },
        ],
      },
    });

    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.json().progress).toEqual([{ pseudo: "mine", done: 1 }]);
    expect(r.json().challenge.works).toBe(2);
  });

  it("counts the old cards too, from before the log", async () => {
    const { me, id } = await testChallenge();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          {
            id: "a",
            tmdbId: "550",
            updatedAt: 1,
            data: { title: "Cléo", watchedAt: "2026-03-09" },
          },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.json().progress[0].done).toBe(1);
  });

  it("does not fall over on a malformed log", async () => {
    /* `watches` comes through clients of every era:
       `jsonb_array_elements` on something that is not an array would
       bring the WHOLE query down, and everybody's progress with it. */
    const { me, id } = await testChallenge();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Cléo", watches: "autrefois" } },
          { id: "b", tmdbId: "551", updatedAt: 1, data: { title: "Autre", ...vu("2026-03-02") } },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().progress[0].done).toBe(1);
  });

  it("measures only those who asked to be in it", async () => {
    const { me, list, id } = await testChallenge();
    const other = await count("other");
    await app.inject({
      method: "PUT",
      url: `/lists/${list}/members/other`,
      headers: { cookie: me.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: other.cookie },
      payload: {
        cards: [
          { id: "x", tmdbId: "550", updatedAt: 1, data: { title: "Cléo", ...vu("2026-03-12") } },
        ],
      },
    });

    /* A member of the list, but not signed up to the challenge: their
       log is counted nowhere. */
    let r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: other.cookie },
    });
    expect(r.json().progress.map((a: { pseudo: string }) => a.pseudo)).toEqual(["mine"]);

    await app.inject({
      method: "PUT",
      url: `/challenges/${id}/participation`,
      headers: { cookie: other.cookie },
    });
    r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: other.cookie },
    });
    expect(r.json().progress).toContainEqual({ pseudo: "other", done: 1 });
  });

  it("never returns the log itself, only a number", async () => {
    const { me, id } = await testChallenge();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          {
            id: "a",
            tmdbId: "550",
            updatedAt: 1,
            data: { title: "Cléo", notes: "SECRET", ...vu("2026-03-12") },
          },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    const text = JSON.stringify(r.json());
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("2026-03-12");
  });

  it("whoever starts it takes part in it", async () => {
    const { id } = await testChallenge();
    const list = (await app.inject({ method: "GET", url: `/challenges/${id}` })).statusCode;
    expect(list).toBe(401);
  });

  it("is not built on a stranger's public list", async () => {
    /* Otherwise anybody starts a challenge on somebody's list, and they
       would see it appear without having wanted it. */
    const isOwner = await count("proprio");
    const passant = await count("passant");
    const list = await createList(isOwner.cookie, { is_public: true });

    const r = await app.inject({
      method: "POST",
      url: "/challenges",
      headers: { cookie: passant.cookie },
      payload: { listId: list, title: "Mars", starts_on: "2026-03-01", ends_on: "2026-03-31" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("refuses an end before its beginning", async () => {
    const me = await count("mine");
    const list = await createList(me.cookie);
    const r = await app.inject({
      method: "POST",
      url: "/challenges",
      headers: { cookie: me.cookie },
      payload: {
        listId: list,
        title: "À l'envers",
        starts_on: "2026-03-31",
        ends_on: "2026-03-01",
      },
    });
    expect(r.statusCode).toBe(400);
  });

  it("can always be left, even when the list has closed again", async () => {
    const { me, list, id } = await testChallenge();
    const other = await count("other");
    await app.inject({
      method: "PUT",
      url: `/lists/${list}/members/other`,
      headers: { cookie: me.cookie },
    });
    await app.inject({
      method: "PUT",
      url: `/challenges/${id}/participation`,
      headers: { cookie: other.cookie },
    });
    /* They are sent out of the list: they can no longer read it, and
       would find themselves measured by a count they cannot leave. */
    await app.inject({
      method: "DELETE",
      url: `/lists/${list}/members/other`,
      headers: { cookie: me.cookie },
    });

    const parti = await app.inject({
      method: "DELETE",
      url: `/challenges/${id}/participation`,
      headers: { cookie: other.cookie },
    });
    expect(parti.statusCode).toBe(200);
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.json().progress.map((a: { pseudo: string }) => a.pseudo)).toEqual(["mine"]);
  });

  it("is erased with its list", async () => {
    const { me, list, id } = await testChallenge();
    await app.inject({
      method: "DELETE",
      url: `/lists/${list}`,
      headers: { cookie: me.cookie },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(404);
  });
});

/* ============================================================
   ON DÉFIE QUELQU'UN
   ============================================================

   Faire entrer une personne précise dans un défi demandait jusqu'ici de
   lui donner le droit d'ÉCRIRE dans la liste, ou de rendre la liste
   publique et d'attendre. Ces cas tiennent les quatre choses qui
   distinguent une invitation d'une porte ouverte : qui a le droit
   d'inviter, le silence sur un blocage, le droit de partir quoi qu'il
   arrive, et le fait que l'auteur ne se paie pas en recrutant.
   ============================================================ */
describe("challenging somebody directly", () => {
  const period = { starts_on: "2024-01-01", ends_on: "2024-12-31" };

  const aChallenge = async (cookie: string, list: string) =>
    (
      await app.inject({
        method: "POST",
        url: "/challenges",
        headers: { cookie },
        payload: { listId: list, title: "Le mois Varda", ...period },
      })
    ).json().id as string;

  const put = (cookie: string, id: string, pseudo: string) =>
    app.inject({
      method: "PUT",
      url: `/challenges/${id}/participants/${pseudo}`,
      headers: { cookie },
    });

  const drop = (cookie: string, id: string, pseudo: string) =>
    app.inject({
      method: "DELETE",
      url: `/challenges/${id}/participants/${pseudo}`,
      headers: { cookie },
    });

  const inside = async (id: string) =>
    (await store.progressOf(db, id)).map((p: { pseudo: string }) => p.pseudo).sort();

  it("puts somebody in without giving them the right to write in the list", async () => {
    const me = await count("mine");
    await count("ami");
    const list = await createList(me.cookie);
    const id = await aChallenge(me.cookie, list);

    expect((await put(me.cookie, id, "ami")).statusCode).toBe(200);
    expect(await inside(id)).toEqual(["ami", "mine"]);
    /* Et c'est tout ce qu'on lui a donné : la liste reste la nôtre. */
    const rights = await store.rightsOnList(db, list, (await store.findByPseudo(db, "ami"))!.id);
    expect(rights?.write).toBe(false);
  });

  it("refuses a co-writer of the list: writing works is not engaging people", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    await count("autre");
    const list = await createList(me.cookie);
    await app.inject({
      method: "PUT",
      url: `/lists/${list}/members/ami`,
      headers: { cookie: me.cookie },
    });
    const id = await aChallenge(me.cookie, list);

    expect((await put(ami.cookie, id, "autre")).statusCode).toBe(403);
  });

  it("answers 404 across a block — the same silence as a challenge that does not exist", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const list = await createList(me.cookie);
    const id = await aChallenge(me.cookie, list);
    await store.block(db, ami.person.id, me.person.id);

    expect((await put(me.cookie, id, "ami")).statusCode).toBe(404);
    expect(await inside(id)).toEqual(["mine"]);
  });

  it("lets whoever was put in walk away, and the author remove them", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const list = await createList(me.cookie);
    const id = await aChallenge(me.cookie, list);

    await put(me.cookie, id, "ami");
    expect((await drop(ami.cookie, id, "ami")).statusCode).toBe(200);
    expect(await inside(id)).toEqual(["mine"]);

    await put(me.cookie, id, "ami");
    expect((await drop(me.cookie, id, "ami")).statusCode).toBe(200);
    expect(await inside(id)).toEqual(["mine"]);
  });

  it("refuses to let one participant remove another", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    await count("autre");
    const list = await createList(me.cookie);
    const id = await aChallenge(me.cookie, list);
    await put(me.cookie, id, "ami");
    await put(me.cookie, id, "autre");

    expect((await drop(ami.cookie, id, "autre")).statusCode).toBe(403);
  });

  /* LA LIGNE QUI COMPTE : recruter ne se paie pas. */
  it("pays the author NOTHING for the people they put in themselves", async () => {
    const me = await count("mine");
    await count("ami");
    const list = await createList(me.cookie);
    const id = await aChallenge(me.cookie, list);
    await put(me.cookie, id, "ami");

    const paid = await db.query<{ kind: string }>(
      "SELECT kind FROM merit_event WHERE person_id = $1 AND kind = 'challenge_joined'",
      [me.person.id]
    );
    /* L'auto-inscription paie l'auteur parce que quelqu'un a CHOISI de
       venir. Payer pour les gens qu'on ajoute soi-même, ce serait se
       verser quatre points par ami. */
    expect(paid).toEqual([]);
  });
});

/* ============================================================
   LA PORTE UNIQUE DES DROITS SUR UN DÉFI

   Sept routes demandaient `rightsOnList(challenge.list_id, …)`, et
   c'était le vrai coût des natures de défi : tant qu'un défi est une
   liste plus une période, la confidentialité de la liste EST celle du
   défi. Un défi sans liste fait disparaître la source, et six endroits
   auraient inventé le même repli pendant que le septième en inventait
   un autre.

   CE QUI EST ÉPROUVÉ ICI EST QUE RIEN N'A BOUGÉ. `rightsOnChallenge`
   rend exactement ce que rendait `rightsOnList` tant qu'il y a une
   liste — la première version ajoutait l'auteur du défi à
   `administer`, ce qui aurait ÉLARGI un droit sur tous les défis
   existants. Élargir une permission est une décision, pas un effet de
   bord de déménagement.
   ============================================================ */
describe("the rights over a challenge", () => {
  it("answers exactly what the list answered, and widens nothing", async () => {
    const owner = await count("proprio");
    const member = await count("membre");
    const stranger = await count("passante");
    const list = await createList(owner.cookie);
    await app.inject({
      method: "PUT",
      url: `/lists/${list}/members/membre`,
      headers: { cookie: owner.cookie },
    });
    /* LE DÉFI EST MONTÉ PAR LE MEMBRE, et c'est le cas qui sépare les
       deux règles : il l'a créé, mais la liste n'est pas la sienne. */
    const id = (
      await app.inject({
        method: "POST",
        url: "/challenges",
        headers: { cookie: member.cookie },
        payload: { listId: list, title: "Mars", starts_on: "2026-03-01", ends_on: "2026-03-31" },
      })
    ).json().id as string;

    const asOwner = await store.rightsOnChallenge(db, id, owner.person.id);
    expect(asOwner).toMatchObject({ read: true, write: true, administer: true });

    const asMember = await store.rightsOnChallenge(db, id, member.person.id);
    /* Il écrit dans la liste, donc il écrit ici — mais il n'ADMINISTRE
       pas, bien qu'il ait monté ce défi. C'est la règle d'avant, et la
       déplacer ne devait pas la changer. */
    expect(asMember).toMatchObject({ read: true, write: true, administer: false });

    const asStranger = await store.rightsOnChallenge(db, id, stranger.person.id);
    expect(asStranger).toMatchObject({ read: false, write: false, administer: false });

    expect(await store.rightsOnChallenge(db, id, null)).toMatchObject({ read: false });
  });

  it("says nothing at all about a challenge that does not exist", async () => {
    const me = await count("quelquun");
    expect(
      await store.rightsOnChallenge(db, "00000000-0000-0000-0000-000000000000", me.person.id)
    ).toBeNull();
  });

  it("opens a public list's challenge to anybody who can read the list", async () => {
    const owner = await count("ouverte");
    const passer = await count("lectrice");
    const list = await createList(owner.cookie, { is_public: true });
    const id = (
      await app.inject({
        method: "POST",
        url: "/challenges",
        headers: { cookie: owner.cookie },
        payload: { listId: list, title: "Mars", starts_on: "2026-03-01", ends_on: "2026-03-31" },
      })
    ).json().id as string;
    expect(await store.rightsOnChallenge(db, id, passer.person.id)).toMatchObject({
      read: true,
      write: false,
      administer: false,
    });
  });
});
