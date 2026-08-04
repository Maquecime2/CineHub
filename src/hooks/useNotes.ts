import { useState } from "react";
import { store, KEYS } from "../services/storage";
import type { Note } from "../types";

/** Le carnet : des pages libres, qui n'appartiennent à aucun film. */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  const save = (next: Note[]) => {
    setNotes(next);
    store.set(KEYS.notes, next);
  };

  return {
    notes,
    /** Appelé une fois au chargement, depuis App. */
    load: () => setNotes(store.get<Note[]>(KEYS.notes, [])),
    replaceAll: save,
    add: (n: Note) => save([n, ...notes]),
    update: (n: Note) => save(notes.map((x) => (x.id === n.id ? n : x))),
    remove: (id: string) => save(notes.filter((x) => x.id !== id)),
  };
}
