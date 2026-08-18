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
   that reorders a plan on the one element one goes to just to look. */
import { useTranslation } from "react-i18next";
import { CheckCheck } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, inked } from "../../theme/styles";
import { PosterArt } from "../film/PosterArt";
import { initialsOf } from "../../domain/film";
import { primaryDirector } from "../../domain/lineageMap";
import type { Progress } from "../../domain/course";

interface ProgressBandProps {
  progress: Progress;
  /** Ouvrir l'étape suivante dans le panneau du bas. */
  onOpenStep: (stepId: string) => void;
  /** La vue rapide, sans quitter le plan. */
  onQuick: () => void;
}

export function ProgressBand({ progress, onOpenStep, onQuick }: ProgressBandProps) {
  const { t } = useTranslation();
  const { done, total, next } = progress;
  if (total === 0) return null;

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
              width: 72,
              height: 108,
              flexShrink: 0,
              padding: 0,
            }}
          >
            <PosterArt film={next.film} initials={initialsOf(next.film.title)} width={72} plain />
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
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={onQuick} style={inked(C.plum)}>
                {t("program.quickLook")}
              </button>
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
