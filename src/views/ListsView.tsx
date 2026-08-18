/* ============================================================
   THE LISTS AND THE CHALLENGES
   ============================================================

   A LIST CONTAINS WORKS, NOT CARDS. A list of cards would be the list of
   somebody's own copies: it would mean nothing at somebody else's, and
   would empty itself the day its author erased a card. So we file films
   in it by their TMDB identifier.

   A CHALLENGE IS A LIST PLUS A PERIOD, and the progress is COMPUTED:
   nobody ticks "seen", the binder already knows. That is also why one
   must ask to take part — we do not measure the log of people who asked
   for nothing.

   THIS VIEW SHOWS NOTHING WITHOUT AN ACCOUNT, and says so in one
   sentence rather than offer dead buttons.

   ------------------------------------------------------------
   CE FICHIER NE TENAIT PAS UNE VUE, IL EN TENAIT DEUX
   ------------------------------------------------------------

   Mille lignes, et deux objets qui n'ont ni le même rythme ni le même
   public : une LISTE est un savoir, permanent, écrit à plusieurs ; un
   DÉFI est une intention, qui se solde. Empilés dans la même colonne,
   avec un accordéon par liste et deux formulaires de création pour un
   seul objet, ils donnaient l'écran le plus boutonneux du produit.

   Il reste l'ENTRÉE, et rien d'autre : c'est ce que l'union `View` de
   `FolderTabs` nomme, et ce que le filet importe — exactement comme
   `QuizView` devant `src/views/quiz/`. Ce qu'il tient encore est l'état
   partagé par les deux moitiés, parce qu'un geste sur l'une redemande
   l'autre : lancer un défi depuis une liste fait paraître une carte au
   tableau.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";
import { C } from "../theme/tokens";
import { FilmQuickView } from "../components/film/FilmQuickView";
import { normalize } from "../domain/search";
import type { Film } from "../types";
import { Guideline, ViewHeading } from "../components/ui";
import { Shelf } from "./lists/Shelf";
import { Board } from "./lists/Board";
import { ListLayer } from "./lists/ListLayer";
import { createList, serverConfigured, type Challenge, type List } from "../services/server";
import { refreshLists, loadLists } from "../hooks/useMyLists";
import { challenges as challengeBoard } from "../hooks/useHall";
import { HallWindow } from "../components/layout/HallWindow";

export function ListsView({
  connected,
  me,
  films,
  onUpdateFilm,
  onOpen,
  onOpenPerson,
}: {
  connected: boolean;
  /** Mon pseudonyme — le tableau de marque en a besoin pour distinguer
      mes tampons de ceux des autres. `null` sans compte. */
  me: string | null;
  /* LE CLASSEUR, POUR CHERCHER DEDANS. Remplir une liste ne demandait
     que TMDB, donc ranger un film qu'on possède déjà obligeait à le
     retaper et à le retrouver parmi des homonymes — alors qu'il est là,
     avec son affiche et son réalisateur. */
  films: Film[];
  onUpdateFilm: (film: Film) => void;
  onOpen: (id: string) => void;
  onOpenPerson: (name: string) => void;
}) {
  const { t } = useTranslation();
  /* La vue rapide est tenue ICI et non dans le sélecteur : c'est une
     couche, et elle survit à la fermeture de la liste qui l'a ouverte. */
  const [quick, setQuick] = useState<Film | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  /* « PAS ENCORE » N'EST PAS « AUCUN ». Cette vue partait de deux
     tableaux vides et affichait donc ses phrases de vide PENDANT que la
     requête était en vol : sur une connexion lente, on lisait « vous
     n'avez aucune liste » alors qu'on en a douze. */
  const [settled, setSettled] = useState(false);
  /* LA LISTE OUVERTE, PAR SON IDENTIFIANT ET NON PAR SA VALEUR. Tenir
     l'objet ferait lire à la couche une copie figée à l'ouverture :
     publier une liste, ou lui ajouter une œuvre, n'y changerait rien
     tant qu'on ne la referme pas. */
  const [opened, setOpened] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  /* CE QUI A RATÉ EN OUVRANT LA PAGE. Distinct de `settled` : « on a
     fini de demander » et « on a obtenu quelque chose » sont deux
     phrases différentes, et les confondre annonçait « aucune liste » à
     quelqu'un dont la requête venait d'être refusée. */
  const [trouble, setTrouble] = useState<string | null>(null);

  /* THROUGH THE SHARED STORE, NOT AROUND IT. This view held its own
     copy of "my lists" and the badges on the wall held another: a list
     opened here did not appear under a poster until something else
     happened to refresh them, and one that was erased here went on being
     offered. Two sources of truth for one question is one too many —
     `refreshLists` reads the server and tells everybody. */
  /* `null` est la réponse d'un serveur qui se tait, pas une liste de
     listes : à l'écran, c'est la même chose qu'aucune. */
  const show = useCallback((l: List[] | null, d: Challenge[]) => {
    setLists(l ?? []);
    setChallenges(d);
    setSettled(true);
  }, []);

  const reread = useCallback(async () => {
    if (!connected) return;
    const [l, d] = await Promise.all([refreshLists(), challengeBoard.refresh()]);
    show(l, d);
  }, [connected, show]);

  /* Servi de mémoire à l'entrée, redemandé après un geste : voir
     `hooks/useHall`. */
  useEffect(() => {
    if (!connected) return;
    Promise.all([loadLists(), challengeBoard.load()])
      .then(([l, d]) => show(l, d))
      /* `settled` passait à vrai même en cas d'échec, donc l'écran
         annonçait « aucune liste » à quelqu'un dont la requête venait
         d'être refusée. On distingue les deux maintenant. */
      .catch((e: Error) => {
        setSettled(true);
        setTrouble(e.message);
      });
  }, [connected, show]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline tight>{t("listsView.noServer")}</Guideline>
      </Page>
    );
  }

  /* LA VITRINE, ET NON UNE PHRASE. Les quatre guichets répondaient
     chacun « il faut un compte — le bouton au pied du rail », ce qui
     donne un itinéraire sans rien dire de ce qu'il y a derrière. */
  if (!connected) {
    return (
      <Page>
        <HallWindow />
      </Page>
    );
  }

  const openOne = async () => {
    const name = title.trim();
    if (!name) return;
    const { id } = await createList({ title: name });
    setTitle("");
    await reread();
    setOpened(id);
  };

  /* RELU DANS LA LISTE FRAÎCHE À CHAQUE RENDU, et non tenu en état. Une
     liste supprimée depuis sa propre couche laisserait `opened` pointer
     sur un identifiant mort : la couche disparaît alors d'elle-même
     plutôt que de rester devant quelque chose que le serveur ne connaît
     plus. C'est aussi ce qui fait qu'un rangement met à jour le compte
     lu dans son en-tête. */
  const open = lists.find((l) => l.id === opened) ?? null;

  return (
    <Page>
      <Shelf
        lists={lists}
        settled={settled}
        trouble={trouble}
        title={title}
        onTitle={setTitle}
        onOpenOne={setOpened}
        onCreate={openOne}
      />

      <Board
        challenges={challenges}
        lists={lists}
        films={films}
        me={me}
        settled={settled}
        onChange={reread}
      />

      {open && (
        <ListLayer
          list={open}
          films={films}
          onChange={reread}
          onLook={setQuick}
          onClose={() => setOpened(null)}
        />
      )}

      {/* LA MÊME COUCHE QU'AILLEURS. Décider qu'un film a sa place dans
          une liste sur un titre et une année seulement était le défaut
          que la vue rapide a été écrite pour retirer — aux filiations,
          au générique, à la reco. Il restait ici. */}
      {quick && (
        <FilmQuickView
          film={quick}
          inBinder={films.some((f) => f.id === quick.id)}
          onEnrich={onUpdateFilm}
          onOpenPerson={(name) => onOpenPerson(normalize(name))}
          onOpenFilm={
            films.some((f) => f.id === quick.id)
              ? () => {
                  setQuick(null);
                  onOpen(quick.id);
                }
              : undefined
          }
          onClose={() => setQuick(null)}
        />
      )}
    </Page>
  );
}

/* The head of the view — see `ViewHeading`, shared with the quiz and the
   counter. Only the icon, the tint and the two sentences belong here. */
const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <ViewHeading
      icon={<ListChecks size={22} color={C.moss} />}
      title={t("listsView.heading")}
      blurb={t("listsView.subheading")}
    >
      {children}
    </ViewHeading>
  );
};
