/* ============================================================
   MOISSONNER LES FILIATIONS DU CLASSEUR
   ============================================================

   UNE FEUILLE ET NON UNE VUE. Une vue coûterait une entrée dans l'union
   `View`, une place dans `GROUPS` et un tour dans `TOURS`, pour un geste
   qu'on fait deux fois par an et qui ne parle que du Programme. C'est le
   raisonnement de `NewChallenge` et de `ListLayer`, et `Sheet` en tient
   déjà la coquille — voile, boîte, titre, croix, `Layer`, `useDialog`.

   ON MOISSONNE SUR DEMANDE, JAMAIS À L'OUVERTURE. Balayer deux cents
   cinéastes est une requête TMDB par nom : la lancer parce que quelqu'un
   a ouvert une feuille pour voir ce qu'elle contient serait la dépenser
   sans qu'on l'ait demandé.

   ET UN SEUL CINÉASTE EST LE DÉFAUT, LE BALAYAGE L'EXCEPTION. Le premier
   jet n'offrait que le second : un clic, et la carte se couvrait de
   dizaines de liens qu'on n'avait pas demandés, à reprendre un par un.
   Une filiation se cherche en pensant à QUELQU'UN — « qui a formé
   Scorsese » — pas en interrogeant deux cents noms pour voir. Le
   balayage reste offert, sous son vrai nom et avec son compte écrit
   dessus, pour qu'il ne soit plus jamais le geste par défaut.

   LA PORTE RESTE LA PORTE, MÊME EN MASSE. « Poser les liens cochés »
   n'écrit rien en direct : chaque piste repasse par `makeBond` ->
   `hasBond` -> `contradicts`, et le compte de ce qui a été REFUSÉ se dit.
   Un bouton qui annonce huit liens et en pose six, sans un mot, est le
   clic avalé que ce projet a déjà payé une fois.

   ET LA PORTE SE REFERME ENTRE DEUX PISTES : le tableau des liens posés
   grandit à mesure, donc deux pistes cochées qui se contredisent ne
   peuvent pas entrer ensemble. Comparées au seul état de départ, elles
   passaient toutes les deux et `normalizeBonds` en jetait une à la
   relecture suivante — un lien qui disparaît tout seul.

   LE CADRAN COMPTE LES FILIATIONS ET NON LES PISTES : deux propriétés de
   Wikidata énoncent la même chose des deux bouts, et `usefulHints`
   dédoublonne par `bondId` — annoncer le brut ferait fondre le chiffre
   entre l'annonce et la liste.
   ============================================================ */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked, underlineInput } from "../../theme/styles";
import { Label, NoKey, Nothing, Trouble } from "../ui";
import { useSay } from "../ui/Feedback";
import { Sheet } from "../ui/Sheet";
import { bondLabel, contradicts, hasBond, makeBond } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import { binderHints, hintId, usefulHints } from "../../domain/hints";
import { hintSays } from "./hintSays";
import type { Hint } from "../../domain/hints";
import { census } from "../../domain/people";
import { normalize } from "../../domain/search";
import { hintsFor } from "../../services/lineageHints";
import { crossHintsFor } from "../../services/tmdbHints";
import { useTmdbKey } from "../../services/tmdbKey";
import type { Film } from "../../types";

interface HintHarvestProps {
  films: Film[];
  bonds: Bond[];
  /** Reçoit les liens à ajouter, déjà passés par la porte. */
  onLay: (bonds: Bond[]) => void;
  onClose: () => void;
}

export function HintHarvest({ films, bonds, onLay, onClose }: HintHarvestProps) {
  const { t } = useTranslation();
  const say = useSay();
  const apiKey = useTmdbKey();
  const [found, setFound] = useState<Hint[] | null>(null);
  /* La troisième source, tenue à part : le classeur s'intercale ENTRE
     elle et Wikidata, donc les fondre en un tableau ferait passer le
     croisement devant lui. */
  const [crossed, setCrossed] = useState<Hint[] | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState(false);
  /* LES ÉCARTÉES, ET RIEN N'EST ÉCARTÉ AU DÉPART : on vient ici pour
     poser des liens, pas pour en refuser. */
  const [off, setOff] = useState<Set<string>>(new Set());
  /* Le cinéaste visé. Vide, il n'y a rien à chercher — et le balayage
     est à côté, jamais au bout de ce champ. */
  const [who, setWho] = useState("");

  /* La même liste que la datalist de `BondForm` — le même annuaire, et
     un second recensement dériverait du premier. */
  const directors = useMemo(
    () =>
      census(films)
        .filter((p) => p.roles.includes("réalisation"))
        .map((p) => p.name),
    [films]
  );

  /* CE QUE VOS FICHES SAVENT EST LÀ AVANT QU'ON DEMANDE QUOI QUE CE
     SOIT — aucun appel, aucun quota. Le réseau ne fait que compléter, et
     `usefulHints` dédoublonne les deux sources par `bondId`. */
  const mine = useMemo(() => binderHints(films), [films]);
  const forWho = useMemo(() => {
    const key = normalize(who.trim());
    if (!key) return mine;
    return mine.filter((h) => normalize(h.fromName) === key || normalize(h.toName) === key);
  }, [mine, who]);

  /* L'ORDRE EST LE MÊME QUE DANS `useLineageHints`, ET IL EST ÉCRIT AUX
     DEUX ENDROITS : Wikidata, qui ÉNONCE ; le classeur, gratuit et qui
     tient l'information de VOS fiches ; le croisement des génériques,
     qui dit la même chose pour des films qu'on ne possède pas.
     `usefulHints` dédoublonne par `bondId`, premier arrivé gagne.

     CETTE FEUILLE NE PASSE PAS PAR LE HOOK, et c'est le piège du
     chantier : une source ajoutée là-bas et oubliée ici n'apparaîtrait
     jamais dans la moisson, en silence. */
  const leads = useMemo(
    () => usefulHints([...(found ?? []), ...forWho, ...(crossed ?? [])], bonds),
    [found, forWho, crossed, bonds]
  );

  const run = async (names: string[]) => {
    if (busy || !apiKey || !names.length) return;
    setBusy(true);
    setTrouble(false);
    setDone(0);
    /* DEUX PASSAGES PAR NOM, ET LA BARRE DOIT LE DIRE. Chaque cinéaste
       est demandé à Wikidata ET à TMDB : compter une fois par nom
       ferait atteindre le bout à mi-chemin, puis attendre en silence
       devant une barre pleine — ce qui se lit comme une panne. Le `+1`
       est la requête au relais, qui vient après. */
    setTotal(names.length * 2 + 1);
    setOff(new Set());
    /* UN SEUL COMPTEUR POUR LES DEUX, tenu ici. Chaque moitié compte
       depuis un, et laisser l'une écrire `setDone` ferait reculer la
       barre chaque fois que l'autre parle. */
    let seen = 0;
    const tick = () => setDone((seen += 1));
    try {
      /* LES DEUX MOITIÉS DE RÉSEAU PARTENT ENSEMBLE, et `allSettled`
         plutôt que `all` : elles ne savent pas la même chose. Wikidata
         muette ne doit pas emporter le croisement des génériques, ni
         l'inverse.

         L'ÉCHEC D'UNE SEULE SE DIT QUAND MÊME. Cette feuille montre
         `Trouble` À CÔTÉ de ce qu'elle a trouvé, jamais à la place :
         taire la moitié manquante ferait croire que le classeur ne
         connaît que ça. */
      const [wiki, cross] = await Promise.allSettled([
        hintsFor(names, apiKey, tick),
        crossHintsFor(names, apiKey, tick),
      ]);
      setFound(wiki.status === "fulfilled" ? wiki.value : []);
      setCrossed(cross.status === "fulfilled" ? cross.value : []);
      if (wiki.status === "rejected" || cross.status === "rejected") setTrouble(true);
    } catch {
      /* « On n'a pas pu demander » n'est pas « il n'y a rien », et cette
         feuille est le seul endroit qui puisse le dire. */
      setTrouble(true);
    } finally {
      setBusy(false);
    }
  };

  const lay = () => {
    const laid: Bond[] = [];
    let refused = 0;
    for (const hint of leads) {
      if (off.has(hintId(hint))) continue;
      const bond = makeBond({
        kind: hint.kind,
        fromName: hint.fromName,
        toName: hint.toName,
        note: hint.note,
      });
      const against = [...bonds, ...laid];
      if (!bond || hasBond(against, bond) || contradicts(against, bond)) {
        refused += 1;
        continue;
      }
      laid.push(bond);
    }
    if (laid.length) onLay(laid);
    say(
      refused
        ? t("program.harvestLaidSome", { count: laid.length, refused })
        : t("program.harvestLaid", { count: laid.length })
    );
    onClose();
  };

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const picked = leads.filter((h) => !off.has(hintId(h))).length;

  return (
    <Sheet title={t("program.harvest")} width={560} onClose={onClose}>
      <div style={{ fontFamily: F.hand, fontSize: 17, color: alpha(C.ink, 0.8), marginBottom: 14 }}>
        {t("program.harvestBlurb", { count: directors.length })}
      </div>

      {!apiKey ? (
        <NoKey what={t("program.harvestNoKey")} />
      ) : (
        <>
          {found === null && !trouble && (
            <>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                  {t("program.harvestWho")}
                </span>
                <input
                  list="harvest-names"
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run([who.trim()])}
                  style={underlineInput}
                />
              </label>
              <datalist id="harvest-names">
                {directors.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => run([who.trim()])}
                  disabled={busy || !who.trim()}
                  style={inked(C.plum)}
                >
                  {busy ? t("program.harvestProgress", { done, total }) : t("program.harvestOne")}
                </button>
                {/* LE COMPTE EST SUR LE BOUTON : c'est la seule chose qui
                    dise ce qu'on s'apprête à dépenser, et ce que la carte
                    va recevoir. */}
                <button
                  onClick={() => run(directors)}
                  disabled={busy || !directors.length}
                  style={{ ...bare, ...inked(C.ink), ...hollow }}
                >
                  {t("program.harvestAll", { count: directors.length })}
                </button>
              </div>
            </>
          )}

          {trouble && (
            <Trouble
              onRetry={() => run(who.trim() ? [who.trim()] : directors)}
              retryLabel={t("program.hintsAgain")}
            >
              {t("program.hintsTrouble")}
            </Trouble>
          )}

          {leads.length === 0 && found !== null && <Nothing what={t("program.harvestNone")} />}

          {leads.length > 0 && (
            <>
              <Label>{t("program.harvestFound", { count: leads.length })}</Label>
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                {leads.map((hint) => {
                  const id = hintId(hint);
                  const bond = makeBond({
                    kind: hint.kind,
                    fromName: hint.fromName,
                    toName: hint.toName,
                  })!;
                  return (
                    <li
                      key={id}
                      style={{ borderBottom: `1px solid ${alpha(C.line, 0.6)}`, padding: "6px 0" }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          cursor: "pointer",
                        }}
                      >
                        <input type="checkbox" checked={!off.has(id)} onChange={() => toggle(id)} />
                        <span style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink }}>
                          {hint.fromName}
                          <span style={{ color: C.inkFaded }}> — </span>
                          {bondLabel(bond, bond.from, t)}
                          <span style={{ color: alpha(C.ink, 0.55), fontSize: 12 }}>
                            {" "}
                            {hintSays(hint, t)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                <button onClick={lay} disabled={!picked} style={inked(C.plum)}>
                  {t("program.harvestLay", { count: picked })}
                </button>
                <button onClick={onClose} style={{ ...bare, ...inked(C.ink), ...hollow }}>
                  {t("program.close")}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
