/* Le peu qui est réellement partagé entre les pièces du quizz. Il est
   court exprès : `SIZES` et `holds` n'ont que le compositeur pour
   appelant, `dealable` que la banque, et les y remonter aurait inventé
   un partage que rien ne demande. */

/** The three levels. The server agrees, and says so. */
export const LEVELS = ["easy", "normal", "hard"] as const;

/** What each level is worth. The same table as `quiz_points` in SQL. */
export const POINTS: Record<string, number> = { easy: 1, normal: 2, hard: 3 };
