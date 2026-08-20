/* ============================================================
   CHERCHER SUR L'ÉTAGÈRE — dire COMBIEN, et mener JUSQUE-LÀ

   Sur l'étagère, chercher ne filtre pas : ça TERNIT. La décision est
   juste et on n'y touche pas — retirer les fiches qui ne répondent pas
   démonterait le rangement à chaque lettre tapée, et rendrait les lignes
   absurdes.

   Mais elle s'arrêtait là. On tapait un titre, quatre cents boîtiers
   pâlissaient, et RIEN ne disait combien on avait trouvé ni où c'était.
   Une recherche sans résultat se lisait exactement comme une recherche
   réussie hors de l'écran : tout ternit, rien ne répond. C'est-à-dire
   comme une panne.

   Trois choses, donc, et aucune ne touche au ternissement : le compte,
   annoncé ; le compte PAR RAYON, que le bandeau de chaque ligne porte
   déjà (`domain/shelfReading`) ; et de quoi aller au suivant.

   ON NE TIENT AUCUNE LISTE. Le prochain boîtier se cherche dans le
   DOCUMENT, par `data-shelf-item` — l'attribut que le glissement pose
   déjà pour savoir ce qu'il vise. C'est le seul endroit où l'ordre à
   l'écran est vrai : une liste tenue à côté aurait doublé le rangement
   et se serait décalée au premier déplacement.

   ─────────────────────────────────────────────────────────────
   ET CE QUI MANQUAIT ENCORE

   UN TOUR À SENS UNIQUE N'EST PAS UN TOUR. Sur douze trouvés, revenir
   sur celui qu'on venait de dépasser demandait onze pas. « Revenir au
   précédent » entre donc — et la POSITION avec lui, dans le même geste :
   on ne recule pas dans une file dont on ignore où l'on est. Les deux
   n'ont de sens qu'ensemble, et c'est pourquoi ils arrivent ensemble.

   LA POSITION S'ÉCRIT À LA MAIN, ET C'EST LE RESPECT D'UNE RÈGLE ÉCRITE
   JUSTE EN DESSOUS. Ce fichier tient son rang dans un `ref` parce qu'un
   état redessinerait la colonne de vue à chaque saut, et il a raison. On
   écrit donc dans le nœud sans passer par React — ce que fait tout
   `ShelfBoard`, pour la même raison. Zéro rendu.

   UN FILM MIS DE CÔTÉ ÉTAIT TROUVÉ ET INJOIGNABLE. Le tiroir des mis de
   côté rend son contenu en `visibility: hidden` tant qu'il est fermé :
   le boîtier était COMPTÉ, visé, et `scrollIntoView` ne faisait rien. Un
   clic avalé, en silence, exactement le défaut que les motifs ont mis un
   chantier à perdre. On OUVRE donc, on ne cache pas : l'exclure du
   compte serait mentir dans l'autre sens, puisque le film est bel et
   bien trouvé — il est seulement rangé ailleurs.

   MAIS ON N'OUVRE QUE CE QUI CACHE. Le premier jet révélait le tiroir à
   CHAQUE saut, « au cas où » : chercher un film posé sur une planche
   faisait donc surgir un panneau qui n'avait rien à montrer, à chaque
   clic. C'est un défaut de plus, pas la correction d'un défaut. La
   question se POSE (`setAside`), et elle a une réponse exacte : le
   contenu du tiroir fermé est rendu, donc le nœud existe et se laisse
   interroger avant qu'on dérange quoi que ce soit.

   L'ARITHMÉTIQUE EST PARTIE DANS LE DOMAINE (`domain/shelfJump`). Le
   tour, les deux sens, l'anneau et la remise à zéro s'y testent sans
   DOM ; ne reste ici que ce qu'un module pur ne peut pas faire — lire
   l'ordre réel à l'écran, et faire défiler.
   ============================================================ */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { nextMatch, sameSearch } from "../../domain/shelfJump";

/* Un défilement est un DÉPLACEMENT et non une décoration : il a lieu
   quoi qu'il arrive, comme le défilement automatique du glissement s'en
   explique déjà. C'est sa DOUCEUR qui est une animation, et elle seule
   se retire. */
const gently = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? ("auto" as const)
    : ("smooth" as const);

/** Le nœud d'un boîtier, où qu'il soit dans la page. */
const nodeOf = (id: string) =>
  document.querySelector<HTMLElement>("[data-shelf-item=" + JSON.stringify(id) + "]");

/**
 * CE BOÎTIER DORT-IL DANS LE TIROIR ?
 *
 * La question a une réponse exacte et il faut la POSER : le contenu du
 * tiroir fermé est rendu, donc le nœud existe et se laisse interroger.
 * Le premier jet ouvrait le tiroir à chaque saut « au cas où », et un
 * panneau qui surgit sans raison à chaque clic est un défaut de plus,
 * pas la correction d'un défaut. On ne révèle que ce qui était caché.
 */
const setAside = (node: HTMLElement | null): boolean => !!node?.closest("[data-set-aside]");

/**
 * Mener l'œil jusqu'à un boîtier.
 *
 * Rend `false` quand le nœud n'est pas là — c'est ce qui permet à
 * l'appelant de réessayer après le rendu qu'il vient de déclencher.
 */
const show = (id: string): boolean => {
  const node = nodeOf(id);
  if (!node) return false;
  node.scrollIntoView({ behavior: gently(), block: "center", inline: "center" });
  /* On retire la marque avant de la reposer : rejouer une animation CSS
     demande que l'attribut parte et revienne, sinon un second clic sur le
     même boîtier ne montrerait rien. */
  node.removeAttribute("data-found-flash");
  void node.offsetWidth;
  node.setAttribute("data-found-flash", "");
  return true;
};

export function ShelfFind({
  matching,
  onReveal,
}: {
  matching: Set<string> | null;
  /* CE QUI PEUT CACHER UN TROUVÉ, la vue seule le sait : le tiroir des
     mis de côté est son état, pas le nôtre. */
  onReveal?: () => void;
}) {
  const { t } = useTranslation();
  /* Où l'on en est dans le tour : l'index de celui qu'on MONTRE, `-1`
     pour aucun. Un `ref` et non un état — voir la tête du fichier. */
  const at = useRef(-1);
  /* La recherche à laquelle ce rang appartient. Sans elle, on tapait une
     requête neuve et « aller au suivant » partait au septième résultat
     d'un ensemble qu'on venait tout juste de composer. */
  const of = useRef<Set<string> | null>(null);
  const spot = useRef<HTMLSpanElement | null>(null);
  /* LE SAUT PEUT AVOIR À ATTENDRE UN RENDU. Ouvrir le tiroir est un
     changement d'état de la VUE : le boîtier n'est monté qu'à la frame
     suivante, et défiler tout de suite viserait un nœud absent. On ne
     repasse donc ici que si le premier essai a échoué. */
  const due = useRef<string | null>(null);

  useEffect(() => {
    const id = due.current;
    if (!id) return;
    due.current = null;
    show(id);
  });

  const jump = (dir: 1 | -1) => {
    if (!matching) return;
    /* L'ORDRE À L'ÉCRAN, LU DANS LE DOCUMENT. C'est le seul endroit où il
       soit vrai, et le contenu du tiroir fermé y figure : il est rendu,
       simplement invisible. */
    const ids = [...document.querySelectorAll<HTMLElement>("[data-shelf-item]")].map(
      (node) => node.dataset.shelfItem || ""
    );

    if (!sameSearch(of.current, matching)) {
      of.current = matching;
      at.current = -1;
    }

    const hit = nextMatch(ids, matching, at.current, dir);
    if (!hit) return;
    at.current = hit.index;

    if (spot.current) {
      spot.current.textContent = t("shelf.find.at", {
        at: hit.index + 1,
        count: matching.size,
      });
    }

    /* CE QUI EST DE CÔTÉ SE RÉVÈLE, ET RIEN D'AUTRE. On n'ouvre le
       tiroir que si le boîtier visé y dort vraiment : le découvrir à
       chaque saut ferait surgir un panneau sans raison sous les yeux de
       quelqu'un qui cherche un film posé sur une planche. */
    if (setAside(nodeOf(hit.id))) onReveal?.();
    if (!show(hit.id)) due.current = hit.id;
  };

  /* On ne cherche rien : il n'y a rien à annoncer, et une ligne vide en
     permanence à côté du champ serait un mot de plus à ignorer. LE
     RETOUR EST APRÈS LES CROCHETS, et il le faut — posé avant, il les
     rendrait conditionnels. */
  if (!matching) return null;

  const count = matching.size;

  return (
    <div
      data-tour="shelf-find"
      style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 22 }}
    >
      {/* IL S'ANNONCE, parce qu'un compte qui change en silence pendant
          qu'on tape ne se lit pas au clavier. */}
      <span
        role="status"
        aria-live="polite"
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          letterSpacing: 0.5,
          color: count > 0 ? C.ink : C.inkFaded,
        }}
      >
        {count > 0 ? t("shelf.find.count", { count }) : t("shelf.find.none")}
      </span>
      {count > 0 && (
        <>
          <Step label={t("shelf.find.previous")} onClick={() => jump(-1)} />
          <Step label={t("shelf.find.next")} onClick={() => jump(1)} />
          {/* OÙ L'ON EN EST. Vide tant qu'on n'a pas sauté : « 0 sur 12 »
              affirmerait qu'on est quelque part, et on n'y est pas
              encore. `aria-hidden` — le compte voisin parle déjà, et deux
              voix diraient la même chose deux fois. */}
          <span
            ref={spot}
            aria-hidden
            style={{
              fontFamily: F.mono,
              fontSize: 9,
              letterSpacing: 0.5,
              color: C.inkFaded,
            }}
          />
        </>
      )}
    </div>
  );
}

/* UN PAS DANS LE TOUR. Les deux boutons ne diffèrent que par leur mot et
   leur sens : les écrire deux fois aurait laissé leurs styles diverger,
   ce que ce projet vient de payer sur sept coquilles de modale. */
const Step = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      all: "unset",
      ...tap,
      cursor: "pointer",
      fontFamily: F.mono,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: C.inkFaded,
      borderBottom: `1px dashed ${C.line}`,
    }}
  >
    {label}
  </button>
);
