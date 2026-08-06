/* ============================================================
   LE VOCABULAIRE, SUR LE DISQUE
   ============================================================

   Seulement ce qui vous appartient : vos motifs, et la liste de ceux du
   catalogue que vous avez écartés. Le catalogue lui-même n'est pas
   recopié ici — le recopier figerait à jamais la version du jour où vous
   avez ouvert l'application pour la première fois.
   ============================================================ */
import { store } from "./storage";
import { FAMILLES, poserVocabulaire } from "../domain/motifs";
import type { Motif, VocabulaireStocké } from "../domain/motifs";

export const MOTIFS_KEY = "motifs";

const FAMILLES_CONNUES = new Set(FAMILLES.map((f) => f.id));

/** Ce qui sort du disque : on ne fait confiance à rien de sa forme. */
export const normalizeVocabulaire = (raw: unknown): VocabulaireStocké => {
  const brut = (raw || {}) as Partial<VocabulaireStocké>;
  const perso = (Array.isArray(brut.perso) ? brut.perso : [])
    .filter((m): m is Motif => !!m && typeof m === "object" && !!m.id && !!m.label)
    .map((m) => ({
      id: String(m.id),
      label: String(m.label).trim(),
      // une famille inconnue — renommée depuis — ne doit pas rendre le motif invisible
      famille: FAMILLES_CONNUES.has(m.famille) ? m.famille : ("récit" as const),
      ...(m.spoiler ? { spoiler: true as const } : {}),
    }))
    .filter((m) => !!m.label);
  const masqués = (Array.isArray(brut.masqués) ? brut.masqués : []).map(String);
  return { perso, masqués };
};

export const loadVocabulaire = (): VocabulaireStocké => {
  const v = normalizeVocabulaire(store.get(MOTIFS_KEY, {}));
  // le registre du domaine est posé ici : c'est le seul chemin de lecture
  poserVocabulaire(v);
  return v;
};

export const saveVocabulaire = (v: VocabulaireStocké): boolean => {
  poserVocabulaire(v);
  return store.set(MOTIFS_KEY, v);
};
