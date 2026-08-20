import { useState } from "react";
import { store, KEYS } from "../services/storage";
import { saveSoon, dropSoon } from "../services/saving";
import type { Note } from "../types";

/** The notebook: loose pages, belonging to no film. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  const save = (next: Note[]) => {
    setNotes(next);
    /* UNE ÉCRITURE IMMÉDIATE ANNULE CELLE QUI ATTENDAIT. Créer ou
       supprimer une page réécrit le carnet ENTIER ; laisser partir la
       frappe d'avant trois cents millisecondes plus tard remettrait la
       page qu'on vient d'effacer. */
    dropSoon(KEYS.notes);
    store.set(KEYS.notes, next);
  };

  /* ÉCRIRE DANS UNE PAGE RÉÉCRIT TOUT LE CARNET, et le faisait à chaque
     touche. Le geste est groupé comme celui d'une critique — et pour la
     même raison : ce qu'on TAPE se corrige lettre par lettre, ce qu'on
     CLIQUE est déjà une validation.

     `add` et `remove` restent immédiats : créer une page vient d'un
     bouton, en supprimer une aussi. */
  const saveText = (next: Note[]) => {
    setNotes(next);
    saveSoon(KEYS.notes, () => {
      store.set(KEYS.notes, next);
    });
  };

  return {
    notes,
    /** Called once at load time, from App. */
    load: () => setNotes(store.get<Note[]>(KEYS.notes, [])),
    replaceAll: save,
    add: (n: Note) => save([n, ...notes]),
    update: (n: Note) => saveText(notes.map((x) => (x.id === n.id ? n : x))),
    remove: (id: string) => save(notes.filter((x) => x.id !== id)),
  };
}
