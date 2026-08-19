/* ============================================================
   WHERE ONE IS UP TO, AND WHAT COMES NEXT
   ============================================================

   THIS IS THE ANSWER TO THE ONE QUESTION THE SCREEN COULD NOT ANSWER.
   A run drew a plan and never once drew the plan's STATE: one had to
   remember, film by film, what had been watched since. So the screen now
   opens on this — a count, a gauge, and the next station in full — and
   the map of filiations, which used to sit here, is one kind of evidence
   among several and folds away.

   IT IS DERIVED, SO IT CANNOT DRIFT. Nothing here is ticked by hand;
   `courseProgress` reads the screenings off the cards. Logging a
   screening from a film card — which is where one actually logs it —
   advances this band without anybody coming back to say so.

   NOTHING IN IT IS DRAGGABLE. The band is for READING where one stands;
   the rail below is for composing. Mixing the two put the one gesture
   that reorders a plan on the one element one goes to just to look.

   C'EST LA VEDETTE, ET NON PLUS UN BANDEAU. L'écran répond d'abord à
   « qu'est-ce que je regarde ce soir » — c'est le seul écran du produit
   qui le PEUT — et il y répondait en soixante-douze pixels d'affiche
   coincés entre deux formulaires. D'où trois ajouts, et pas un de plus :

   — L'AFFICHE EST CELLE DU RAIL (`POSTER_H`), pour que la vedette et les
     stations parlent de la même chose à la même taille.
   — LE LIEN EST LU EN CLAIR. « Pourquoi celui-là » a deux moitiés : la
     note de marge, qui est de vous, et la FILIATION, qui est le savoir.
     La seconde était enfermée dans le panneau d'une étape. Elle se dit
     par `bondLabel` et JAMAIS par `bond.note` — une note est une
     référence écrite pour la machine, et la règle est celle de
     `BondDetail`.
   — « OUVRIR LA FICHE » EST LE TROISIÈME GESTE, et il ne coche rien :
     `stepDone` reste DÉRIVÉ. Il mène là où l'on note une séance, ce qui
     fait avancer le plan sans que personne revienne le dire. C'est la
     doctrine du haut de ce fichier, et elle survit au bouton neuf.

   UN PARCOURS VIDE N'EST PAS UN TROU. Rendre `null` allait quand la
   bande était un accessoire ; en vedette, un parcours neuf ouvrirait sur
   rien entre les puces et le rail vide. `Guideline` le dit — une
   primitive, jamais une phrase écrite dans une vue. */
import { useTranslation } from "react-i18next";
import { CheckCheck, ExternalLink } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked } from "../../theme/styles";
import { Guideline } from "../ui";
import { PosterArt } from "../film/PosterArt";
import { initialsOf } from "../../domain/film";
import { primaryDirector } from "../../domain/lineageMap";
import { bondLabel } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import type { Progress } from "../../domain/course";
import { POSTER_H } from "./StepCard";

/** La largeur de l'affiche en vedette, au 2:3 de `POSTER_H`. */
const POSTER_W = Math.round((POSTER_H * 2) / 3);

interface ProgressBandProps {
  progress: Progress;
  /**
   * Le lien que l'étape suivante invoque, s'il en désigne un qu'on tient.
   * Absent est le cas NORMAL : une justification pendante est muette au
   * rendu, jamais nettoyée.
   */
  because?: Bond | null;
  /** Ouvrir l'étape suivante dans le panneau du bas. */
  onOpenStep: (stepId: string) => void;
  /** La vue rapide, sans quitter le plan. */
  onQuick: () => void;
  /** La fiche entière — c'est là qu'on note une séance. */
  onOpenFilm?: () => void;
}

export function ProgressBand({
  progress,
  because,
  onOpenStep,
  onQuick,
  onOpenFilm,
}: ProgressBandProps) {
  const { t } = useTranslation();
  const { done, total, next } = progress;
  if (total === 0) return <Guideline>{t("program.emptyRun")}</Guideline>;

  const share = Math.round((done / total) * 100);
  const director = next ? primaryDirector(next.film) : null;

  return (
    <section
      data-tour="program-progress"
      aria-label={t("program.whereAmI")}
      style={{
        marginBottom: 20,
        padding: "14px 16px",
        border: `1px solid ${C.line}`,
        background: alpha(C.plum, 0.05),
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.4, color: C.inkFaded }}>
          {t("program.whereAmI")}
        </span>
        {/* LE COMPTE EST DIT EN TOUTES LETTRES, la jauge n'en est que le
            dessin : une barre seule ne se lit pas au lecteur d'écran, et
            un pourcentage seul ne dit pas combien de films restent. */}
        <span style={{ fontFamily: F.title, fontSize: 20, color: C.ink }}>
          {t("program.progressCount", { done, total })}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t("program.progressCount", { done, total })}
        style={{
          height: 5,
          marginTop: 8,
          background: alpha(C.ink, 0.12),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${share}%`,
            height: "100%",
            background: C.plum,
            transition: "width var(--motion-slow) var(--motion-ease)",
          }}
        />
      </div>

      {next ? (
        <div style={{ display: "flex", gap: 14, marginTop: 14, alignItems: "flex-start" }}>
          <button
            onClick={() => onOpenStep(next.step.id)}
            aria-label={t("program.openStep", { title: next.film.title })}
            /* `plain` REND L'AFFICHE EN `position: absolute; inset: 0` —
             « la boîte fixe déjà les dimensions ». Sans `position:
             relative` ET sans hauteur ici, elle s'échappe jusqu'au
             premier ancêtre positionné et remplit la page. La hauteur
             est celle du 2:3, comme `StepCard` la pose. */
            style={{
              ...bare,
              display: "block",
              position: "relative",
              width: POSTER_W,
              height: POSTER_H,
              flexShrink: 0,
              padding: 0,
            }}
          >
            <PosterArt
              film={next.film}
              initials={initialsOf(next.film.title)}
              width={POSTER_W}
              plain
            />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.plum }}>
              {t("program.upNext")}
            </div>
            <div style={{ fontFamily: F.title, fontSize: 22, color: C.ink, lineHeight: 1.15 }}>
              {next.film.title}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 2 }}>
              {[director?.name, next.film.year].filter(Boolean).join(" · ")}
            </div>
            {/* LE POURQUOI EST ICI ET PAS AILLEURS. C'est la seule phrase
                qui répond à « pourquoi celui-là maintenant », et elle
                était enfermée dans un panneau qu'il fallait aller ouvrir. */}
            {next.step.why.trim() && (
              <div
                style={{
                  fontFamily: "var(--f-hand)",
                  fontSize: 17,
                  color: alpha(C.ink, 0.7),
                  marginTop: 6,
                }}
              >
                {next.step.why}
              </div>
            )}
            {/* LA FILIATION QUI JUSTIFIE CETTE PLACE, lue DEPUIS le
                cinéaste de la fiche : « a pour maître X » et « a pour
                élève X » sont la même ligne des deux bouts, et c'est le
                bon bout qu'on veut ici. La donnée reste une clé, l'écran
                la traduit. */}
            {because && director && (
              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 13,
                  color: C.inkFaded,
                  marginTop: 6,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                <span aria-hidden style={{ fontFamily: F.mono, fontSize: 11, color: C.plum }}>
                  &#8627;
                </span>
                <span>
                  <strong style={{ fontWeight: 600, color: C.ink }}>{director.name}</strong>{" "}
                  {bondLabel(because, director.key, t)}
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={onQuick} style={inked(C.plum)}>
                {t("program.quickLook")}
              </button>
              {/* IL NE COCHE RIEN : il mène là où l'on note une séance,
                  et c'est la séance qui solde l'étape. */}
              {onOpenFilm && (
                <button onClick={onOpenFilm} style={{ ...inked(C.ink), ...hollow }}>
                  <ExternalLink size={12} />
                  {t("program.openFilm")}
                </button>
              )}
              <button
                onClick={() => onOpenStep(next.step.id)}
                style={{ ...bare, fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}
              >
                {t("program.whyLabel")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* LE PARCOURS EST FINI, ET ON LE DIT. Un bandeau qui se contente
           de montrer « 8 / 8 » laisse chercher ce qui vient ensuite. */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            fontFamily: "var(--f-hand)",
            fontSize: 18,
            color: C.ink,
          }}
        >
          <CheckCheck size={16} color={C.plum} />
          {t("program.runWalked")}
        </div>
      )}
    </section>
  );
}
