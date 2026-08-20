/* ============================================================
   INVITER QUELQU'UN SANS SAVOIR ÉPELER SON PSEUDONYME
   ============================================================

   ON INVITAIT EN TAPANT UN PSEUDO EXACT, PARTOUT — les membres d'une
   liste, les joueurs d'un quizz, les participants d'un défi. Trois
   écrans, le même champ nu, et la même façon d'échouer : une lettre de
   travers et le serveur répond « personne ». Or on invite presque
   toujours des gens qu'on suit ou qui nous suivent, c'est-à-dire des
   gens que le serveur sait déjà nommer.

   C'EST UNE SUGGESTION, PAS UN ANNUAIRE, ET SURTOUT PAS UN REMPLACEMENT
   DU CHAMP. Le champ libre RESTE, et c'est la règle qui décide de tout ce
   fichier : quelqu'un qui n'est dans aucune des deux listes doit rester
   invitable. Un sélecteur qui aurait remplacé la saisie aurait fermé la
   porte aux gens qu'on connaît hors de l'application — ce qui est
   exactement le cas de la première personne qu'on invite.

   IL RESTE DANS LA COLONNE DE VUE. `position: absolute` sous son champ,
   et non un `Layer` : c'est l'exception assumée de la doctrine pour un
   menu ancré à son déclencheur, parce que le sortir de la colonne
   romprait l'ancrage. Voir le budget de `z-index` dans `CLAUDE.md`.

   UN ÉCHEC DÉGRADE VERS LE CHAMP LIBRE, EN SILENCE, SANS `Trouble` — et
   c'est le seul `catch` avalé légitime du chantier. Ce n'est pas un
   chargement de page : c'est un confort posé par-dessus un champ qui
   marche déjà. Annoncer « on n'a pas pu lire vos abonnements » à
   quelqu'un qui allait taper trois lettres serait une alarme pour rien.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, tap } from "../../theme/styles";
import { myFollowers, mySubscriptions, type Profile } from "../../services/server";

/** Ce qu'on montre au plus : au-delà, ce n'est plus une suggestion. */
const SHOWN = 8;

export function PeoplePicker({
  value,
  onChange,
  onPick,
  placeholder,
  /** Déjà dedans : on ne propose pas d'inviter deux fois. */
  already = [],
}: {
  value: string;
  onChange: (v: string) => void;
  /** Ce que fait le choix d'un nom. Le champ est vidé par l'appelant. */
  onPick: (pseudo: string) => void;
  placeholder: string;
  already?: readonly string[];
}) {
  const { t } = useTranslation();
  const [people, setPeople] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  /* LES DEUX SENS DU LIEN, ET UNE SEULE LISTE À L'ÉCRAN. Qui je suis et
     qui me suit se recouvrent largement ; les montrer séparément aurait
     demandé à quelqu'un de choisir un onglet pour inviter une personne. */
  useEffect(() => {
    let alive = true;
    /* LE `try` ENGLOBE L'APPEL LUI-MÊME, ET PAS SEULEMENT SA PROMESSE.
       Un `.catch()` posé sur `Promise.all(...)` ne rattrape que les
       rejets : si l'un des deux appels lève AVANT de rendre une promesse,
       l'exception traverse l'effet et emporte tout l'écran qui héberge ce
       champ. C'est exactement ce qui est arrivé — la partie entière
       tombait pour un menu de suggestions. Un confort qui casse son hôte
       n'est pas un confort. */
    void (async () => {
      try {
        const [a, b] = await Promise.all([mySubscriptions(), myFollowers()]);
        if (!alive) return;
        const seen = new Map<string, Profile>();
        for (const p of [...a.subscriptions, ...b.followers]) seen.set(p.pseudo, p);
        setPeople([...seen.values()].sort((x, y) => x.pseudo.localeCompare(y.pseudo)));
      } catch {
        /* En silence : voir l'en-tête. Le champ libre marche toujours. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Cliquer ailleurs referme. Le voile d'une modale ferait cela tout
     seul, mais un menu ancré n'en a pas — et ne doit pas en avoir. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const typed = value.trim().toLowerCase();
  const offered = people
    .filter((p) => !already.includes(p.pseudo))
    .filter((p) => !typed || p.pseudo.includes(typed))
    .slice(0, SHOWN);

  return (
    <div ref={box} style={{ position: "relative", flex: 1, maxWidth: 220 }}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        /* ENTRÉE CHOISIT UN NOM, exactement comme un clic dans la liste.
           C'est pourquoi il n'y a pas d'`onSubmit` séparé : « le nom
           tapé » et « le nom cliqué » sont le même geste, et leur donner
           deux chemins aurait donné deux façons d'échouer — dont une que
           personne n'aurait éprouvée. */
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            setOpen(false);
            if (typed) onPick(typed);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && offered.length > 0}
        aria-controls="people-picker-list"
        autoComplete="off"
        style={{
          width: "100%",
          border: "none",
          borderBottom: `1px solid ${C.line}`,
          background: "transparent",
          color: C.ink,
          padding: "3px 0",
          fontFamily: F.hand,
          fontSize: 16,
        }}
      />
      {open && offered.length > 0 && (
        <ul
          id="people-picker-list"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 10,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: `2px 5px 14px ${alpha(C.ink, 0.22)}`,
            maxHeight: 210,
            overflowY: "auto",
          }}
        >
          {offered.map((p) => (
            <li key={p.pseudo}>
              <button
                onClick={() => {
                  onPick(p.pseudo);
                  setOpen(false);
                }}
                style={{
                  ...bare,
                  ...tap,
                  display: "flex",
                  width: "100%",
                  alignItems: "baseline",
                  gap: 7,
                  padding: "5px 6px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink, flex: 1 }}>
                  {p.pseudo}
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                  {t("peoplePicker.films", { count: p.films })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
