/* ============================================================
   THE QUIZZES — a bank, and evenings dealt out of it
   ============================================================

   A CHALLENGE ASKS THE BINDER HOW FAR ONE GOT; A QUIZ ASKS THE PERSON.

   THE SHAPE THAT DECIDES THIS SCREEN: NOBODY WRITES A QUIZ. An admin
   fills a bank — baskets of questions, each easy, middling or hard — and
   anybody deals an evening out of it in three clicks: some baskets, a
   level, a length. So there are two screens here and they barely touch.
   The composing form is for everybody; the bank is for whoever may fill
   it, and it is ABSENT rather than greyed out for everybody else.

   AND WHOEVER DEALT A QUIZ PLAYS IT LIKE ANYBODY ELSE. They did not
   write the questions, so there is no carve-out anywhere below: no
   preview of the answers, no rehearsal, a real score in the leaderboard.
   The version of this file that had an author had all three, and each
   one was a thing to remember not to leak.

   THE RIGHT ANSWERS ARE NOT HIDDEN BY THIS FILE. They are not in the
   reply until an attempt is closed. Nothing here could put that back.

   THIS VIEW SHOWS NOTHING WITHOUT AN ACCOUNT, and says so in one
   sentence rather than offer dead buttons.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Library, Plus, Puzzle } from "lucide-react";
import { C } from "../theme/tokens";
import { hollow, inked } from "../theme/styles";
import { Guideline, Label, Trouble, ViewHeading, Waiting } from "../components/ui";
import { quizBank } from "../hooks/useHall";
import { HallWindow } from "../components/layout/HallWindow";
import { iAmAdmin, serverConfigured, type Category, type Quiz } from "../services/server";
import { Bank } from "./quiz/Bank";
import { Composer } from "./quiz/Composer";
import { OneQuiz } from "./quiz/OneQuiz";

export function QuizView({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const [tendingBank, setTendingBank] = useState(false);
  const [composing, setComposing] = useState(false);
  /* NULL VEUT DIRE « ON N'A PAS ENCORE DEMANDÉ », et c'est ce qui
     distingue une soirée vide d'une soirée qu'on n'a pas pu lire. Les
     deux montraient le même écran, c'est-à-dire aucun. */
  const [loading, setLoading] = useState(true);
  const [souci, setSouci] = useState<string | null>(null);

  /* Servi de mémoire à l'entrée, redemandé après un geste : voir
     `hooks/useHall`. */
  const show = useCallback((d: { quizzes: Quiz[]; categories: Category[] }) => {
    setQuizzes(d.quizzes);
    setCategories(d.categories);
    setLoading(false);
  }, []);

  const reread = useCallback(async () => {
    if (!connected) return;
    show(await quizBank.refresh());
  }, [connected, show]);

  useEffect(() => {
    if (!connected) return;
    quizBank
      .load()
      .then(show)
      .catch((e: Error) => {
        setLoading(false);
        setSouci(e.message);
      });
  }, [connected, show]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline tight>{t("quizView.noServer")}</Guideline>
      </Page>
    );
  }

  /* LA VITRINE, ET NON UNE PHRASE. Les quatre guichets répondaient
     chacun « il faut un compte — le bouton au pied du rail », ce qui
     donne un itinéraire sans rien dire de ce qu'il y a derrière. Voir
     `HallWindow` pour ce qu'elle montre, et surtout pour ce qu'elle se
     refuse à montrer. */
  if (!connected) {
    return (
      <Page>
        <HallWindow />
      </Page>
    );
  }

  const mine = quizzes.filter((q) => q.mine);
  const given = quizzes.filter((q) => !q.mine);

  return (
    <Page>
      {/* THE ONE PLACE THE ROLE SHOWS, and it shows by being there or
          not. `iAmAdmin` is a hunch read from the remembered account; it
          decides what is drawn, never what is written — every route
          below asks the server again. */}
      {iAmAdmin() && (
        <div data-tour="quiz-bank" style={{ marginBottom: 26 }}>
          <button
            onClick={() => setTendingBank(!tendingBank)}
            style={tendingBank ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
          >
            <Library size={12} /> {t("quizView.tendBank")}
          </button>
          {tendingBank && <Bank categories={categories} onChange={reread} />}
        </div>
      )}

      {/* LA PORTE, ET NON LE FORMULAIRE. Voir `Composer` pour ce que
          l'ouverture permanente coûtait au premier regard. */}
      <button onClick={() => setComposing(true)} style={inked(C.plum)} data-tour="quiz-new">
        <Plus size={12} /> {t("quizView.newQuiz")}
      </button>

      {composing && (
        <Composer
          categories={categories}
          onDrawn={reread}
          onOpen={setOpened}
          onClose={() => setComposing(false)}
        />
      )}

      {souci && <Trouble>{souci}</Trouble>}

      <div data-tour="quiz-mine" style={{ marginTop: 34 }}>
        <Label>{t("quizView.yours")}</Label>
        {/* TROIS ÉTATS ET PAS DEUX : on attend, il n'y a rien, ou on
            n'a pas pu demander. Les deux derniers montraient la même
            phrase — « aucune soirée » — y compris quand le serveur
            avait refusé la requête. */}
        {loading && <Waiting lines={2} />}
        {!loading && mine.length === 0 && !souci && (
          <Guideline tight>{t("quizView.noneDealt")}</Guideline>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {mine.map((q) => (
            <OneQuiz
              key={q.id}
              quiz={q}
              opened={opened === q.id}
              onToggle={() => setOpened(opened === q.id ? null : q.id)}
              onChange={reread}
            />
          ))}
        </div>
      </div>

      <div data-tour="quiz-given" style={{ marginTop: 30 }}>
        <Label>{t("quizView.given")}</Label>
        {loading && <Waiting lines={2} />}
        {!loading && given.length === 0 && !souci && (
          <Guideline tight>{t("quizView.noneGiven")}</Guideline>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {given.map((q) => (
            <OneQuiz
              key={q.id}
              quiz={q}
              opened={opened === q.id}
              onToggle={() => setOpened(opened === q.id ? null : q.id)}
              onChange={reread}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}

/* The head of the view. Only the icon, the tint and the two sentences
   belong to the quiz; the rest is `ViewHeading`, shared with the lists
   and the counter. It stays a local name because three places call it. */
const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <ViewHeading
      icon={<Puzzle size={22} color={C.plum} />}
      title={t("quizView.heading")}
      blurb={t("quizView.subheading")}
    >
      {children}
    </ViewHeading>
  );
};
