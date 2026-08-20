import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { InkUnderline } from "../../components/atmosphere";
import { Confetti } from "../../components/atmosphere/Confetti";
import { Halftone, Stamp } from "../../components/atmosphere/hall";
import { tierOf, type Gain } from "../../domain/points";
import { mediaTicket } from "../../services/server";

/* ============================================================
   LE RIDEAU — le premier temps d'une fin de partie

   CE QUI ÉTAIT LÀ AVANT DISAIT QU'ON AVAIT FINI ET RIEN D'AUTRE.
   Une phrase grise — « C'est fait. On ne le rejoue pas. » — puis
   immédiatement le chiffre, puis la liste des questions ratées. Trois
   informations, toutes exactes, et aucune ne félicitait. On lisait un
   constat d'huissier là où l'on venait de jouer vingt questions de
   cinéma pendant un quart d'heure.

   IL Y A DONC DEUX TEMPS MAINTENANT, ET CELUI-CI EST LE PREMIER. Le
   rideau dit le mot, le chiffre et ce que ça a payé ; `Correction`
   garde le détail question par question et vient DESSOUS. Les fondre
   remettrait la fête au milieu des réponses manquées, ce qui est
   exactement ce dont on sort.

   LE MOT EST UN TAMPON, ET LE PALIER VIENT DU BARÈME. `tierOf`
   (`domain/points`) lit les deux seuils qui existaient déjà —
   `quiz_flawless` à score plein, `CHALLENGE_HALF` à la moitié. Un mot,
   jamais une couleur : le vert et le rouge disparaissent sous cinq des
   dix-sept peaux, et c'est la règle du verdict, écrite dans
   `Correction` avant d'être écrite ici.

   `Halftone` UNE FOIS, PAS PAR LIGNE. C'est un effet cher, et cet
   écran est un MOMENT — donc il y a droit, une fois, sur le carton.

   L'IMAGE DU PALIER EST UNE DÉCORATION, ET SON ABSENCE EST LE CAS
   NORMAL. Elle vit dans le stock commun (`bank/cheer/<palier>`), qu'un
   admin remplit quand il en a envie et qui est VIDE le jour de la
   livraison. Le rideau est donc écrit pour marcher sans elle : le
   tampon, le chiffre et les confettis suffisent, et l'image vient en
   plus si elle est là. C'est le seul endroit de ce fichier où un
   `.catch(() => {})` est le bon choix — sur un chargement de page il
   resterait un défaut.

   ELLE S'AFFICHE DANS UNE BALISE `img`, DONC IL N'Y A RIEN À ASSAINIR.
   Le navigateur l'isole lui-même : ni script, ni accès au document qui
   l'affiche. C'est l'exception écrite de `sanitizeSvg`, et elle vaut
   ici pour la raison exacte qui la fait valoir pour les objets gagnés.
   ============================================================ */
export function Curtain({
  score,
  weight,
  gains,
  seed,
}: {
  score: number;
  weight: number;
  gains: readonly Gain[];
  /* L'IDENTIFIANT DE LA PARTIE, ET NON UN COMPTEUR. Les confettis sont
     semés dessus : la même partie fait toujours tomber les mêmes
     morceaux au même endroit, y compris à travers les relectures du
     serveur qui suivent la fin. Semé sur le score, deux parties à onze
     points auraient été identiques ; semé sur rien, la chute se
     rejouait à chaque rendu de React. */
  seed: string;
}) {
  const { t } = useTranslation();
  const tier = tierOf(score, weight);
  /* TROIS ÉTATS ET NON DEUX : on demande, on a une adresse, on renonce.
     Le troisième compte — un ticket signé revient valide même quand le
     blob n'existe pas (le stock commun se lit sans condition), donc
     c'est la balise elle-même qui découvre l'absence, et `onError` est
     le seul endroit qui puisse le dire. */
  const [cheer, setCheer] = useState<string | null>(null);

  useEffect(() => {
    let dropped = false;
    /* LE `try` ENGLOBE L'APPEL LUI-MÊME, ET PAS SEULEMENT SA PROMESSE.
       Un `.catch()` accroché derrière ne rattrape que le refus du
       serveur ; il ne rattrape pas un service qui lève AVANT de rendre
       une promesse — et c'est exactement ce qui vient d'emporter tout
       l'écran de fin, corps du document vide compris. Le même défaut
       avait déjà coûté la partie entière au sélecteur de personnes, et
       c'est le `try` de `PeoplePicker` qui l'y avait réglé. Une image
       de félicitations n'a pas le droit de faire tomber le score. */
    void (async () => {
      try {
        const url = await mediaTicket(`bank/cheer/${tier}`);
        if (!dropped) setCheer(url);
      } catch {
        /* Une décoration absente est une décoration absente. */
      }
    })();
    return () => {
      dropped = true;
    };
  }, [tier]);
  /* L'ENCRE S'ACCORDE AU MOT, ELLE NE LE REMPLACE PAS. Deux teintes et
     non quatre : le tampon porte déjà les quatre paliers en toutes
     lettres, et une nuance de plus par palier serait une échelle de
     couleurs que personne ne peut lire. */
  const warm = tier === "perfect" || tier === "held";

  return (
    <div
      style={{
        position: "relative",
        marginTop: 12,
        padding: "18px 18px 16px",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 4px 12px rgba(30,20,10,0.18)",
        /* LA MÊME ENTRÉE QUE TOUT CE QUI ARRIVE PAR-DESSUS. `sheetIn`
           existe déjà et les durées viennent des jetons, donc
           `prefers-reduced-motion` la coupe sans qu'on s'en occupe. */
        animation: "sheetIn var(--motion-slow) var(--motion-ease) both",
        overflow: "hidden",
      }}
    >
      <Halftone size={5} />
      <Confetti seed={seed} />

      <div style={{ position: "relative" }}>
        <Stamp
          text={t(`quizView.tier.${tier}`)}
          ink={warm ? C.moss : C.burgundy}
          tilt={warm ? -7 : 4}
        />
      </div>

      {cheer && (
        <div style={{ position: "relative", marginTop: 12 }}>
          <img
            src={cheer}
            alt=""
            /* `alt` VIDE ET `aria-hidden` : l'image commente le palier,
               elle ne le dit pas. Le tampon juste au-dessus porte le
               mot, et `useSay` l'a déjà annoncé — décrire l'image ici
               ferait entendre la même chose trois fois. */
            aria-hidden="true"
            onError={() => setCheer(null)}
            style={{
              display: "block",
              width: "100%",
              maxHeight: 200,
              objectFit: "cover",
              border: `1px solid ${C.line}`,
            }}
          />
        </div>
      )}

      <div
        style={{
          position: "relative",
          marginTop: 10,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span style={{ fontFamily: F.title, fontSize: 42, lineHeight: 1, color: C.ink }}>
          {score}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded }}>
          {t("quizView.outOf", { weight })}
        </span>
      </div>
      <InkUnderline width={170} />

      {/* LES GAINS SONT DÉTAILLÉS, ET ILS VIENNENT DU SERVEUR. « quiz :
          +18, sans faute : +15 » dit ce qu'on a bien fait ; « +33 » dit
          qu'on a joué. Une partie close deux fois ne paie qu'une, et
          c'est ce tableau-là — pas le barème — qui le montre. */}
      {gains.length > 0 && (
        <div
          style={{
            position: "relative",
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {gains.map((g) => (
            <div
              key={g.kind}
              style={{
                display: "flex",
                gap: 8,
                fontFamily: F.mono,
                fontSize: 10.5,
                color: C.inkFaded,
              }}
            >
              <span>{t(`points.${g.kind}`)}</span>
              <span style={{ flex: 1, borderBottom: `1px dotted ${C.line}` }} />
              <span style={{ color: C.ochre }}>+{g.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
