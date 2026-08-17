/* ============================================================
   LAYING A BOND DOWN
   ============================================================

   THE CONTRADICTION IS REFUSED IN THE OPEN. `normalizeBonds` turns one
   away at the door on read, which is right for a file coming off a disk
   — but a form that swallowed a click and wrote nothing would be the
   exact bug the motifs had before the gatherings were rewritten: you
   believe you have done something, and you have done nothing. So the
   check runs BEFORE the write and says which bond is in the way.

   THE NAMES AUTOCOMPLETE AND ARE STILL FREE. `census` gives the
   spellings the collection actually holds, so one types against an
   existing key by default. But "Jean-Luc Godard" and "Godard" are two
   different people to `normalize` and NO FUZZY MATCHING is attempted:
   guessing that two names are one person is how a map quietly merges
   two film-makers nobody asked it to merge.

   IT IS A LAYER, SO IT GOES THROUGH `Layer` — `[data-enters]` carries a
   transform during the view's entrance and would anchor a `fixed` panel
   to the column instead of the window. `useDialog` traps the focus and
   gives it back; the `role` and `aria-modal` are written here, since the
   hook lays neither. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked, underlineInput } from "../../theme/styles";
import { Layer } from "../ui/Layer";
import { Trouble } from "../ui";
import { useDialog } from "../../hooks/useDialog";
import { BONDS, bondLabel, contradicts, hasBond, makeBond } from "../../domain/bonds";
import type { Bond, BondKind } from "../../domain/bonds";
import { census } from "../../domain/people";
import type { Film } from "../../types";

interface BondFormProps {
  films: Film[];
  bonds: Bond[];
  /** Le cinéaste déjà connu, quand on ouvre depuis une entrée de la file. */
  from?: string;
  /**
   * L'autre bout, quand on l'a désigné aussi — une étape sous les yeux
   * et un nœud choisi sur la carte. Il ne reste alors qu'une nature à
   * demander, et pas un nom à retaper.
   */
  to?: string;
  onSave: (bond: Bond) => void;
  onClose: () => void;
}

export function BondForm({ films, bonds, from = "", to = "", onSave, onClose }: BondFormProps) {
  const { t } = useTranslation();
  const ref = useDialog(onClose);
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [kind, setKind] = useState<BondKind>("master");
  const [note, setNote] = useState("");
  const [trouble, setTrouble] = useState("");

  /* Les orthographes que la collection tient vraiment. Une seule liste
     pour les deux champs : c'est le même annuaire. */
  const names = useMemo(
    () =>
      census(films)
        .filter((p) => p.roles.includes("réalisation"))
        .map((p) => p.name),
    [films]
  );

  const submit = () => {
    const bond = makeBond({ kind, fromName: a, toName: b, note });
    if (!bond) return setTrouble(t("lineage.selfBond"));
    if (hasBond(bonds, bond)) return setTrouble(t("lineage.alreadyBond"));
    const against = contradicts(bonds, bond);
    if (against)
      return setTrouble(
        t("lineage.contradiction", { existing: bondLabel(against, against.from, t) })
      );
    onSave(bond);
    onClose();
  };

  return (
    <Layer>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: alpha(C.ink, 0.35),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={t("lineage.addBond")}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            padding: "18px 20px",
            width: "min(420px, 100%)",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 10.5,
              letterSpacing: 1,
              color: C.inkFaded,
              marginBottom: 14,
            }}
          >
            {t("lineage.addBond")}
          </div>

          <datalist id="lineage-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
              {t("lineage.bondFrom")}
            </span>
            {/* LE FOYER VA AU CHAMP QUI RESTE À REMPLIR. Ouvert depuis
                une étape, le premier nom est déjà là : y poser le
                curseur ferait retaper ce qu'on venait de désigner. */}
            <input
              autoFocus={!from}
              list="lineage-names"
              value={a}
              onChange={(e) => setA(e.target.value)}
              style={underlineInput}
            />
          </label>

          <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
            <legend style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, padding: 0 }}>
              {t("lineage.bondKind")}
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {BONDS.map((def) => (
                <button
                  key={def.id}
                  onClick={() => setKind(def.id)}
                  aria-pressed={kind === def.id}
                  style={{
                    ...(kind === def.id ? inked(C.ink) : { ...inked(C.ink), ...hollow }),
                  }}
                >
                  {t(def.label, { name: "…" })}
                </button>
              ))}
            </div>
          </fieldset>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
              {t("lineage.bondTo")}
            </span>
            <input
              autoFocus={!!from && !to}
              list="lineage-names"
              value={b}
              onChange={(e) => setB(e.target.value)}
              style={underlineInput}
            />
          </label>

          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
              {t("lineage.bondNote")}
            </span>
            <input value={note} onChange={(e) => setNote(e.target.value)} style={underlineInput} />
          </label>

          {trouble && <Trouble>{trouble}</Trouble>}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={submit} style={inked(C.plum)}>
              {t("lineage.bondSave")}
            </button>
            <button onClick={onClose} style={{ ...bare, ...inked(C.ink), ...hollow }}>
              {t("lineage.close")}
            </button>
          </div>
        </div>
      </div>
    </Layer>
  );
}
