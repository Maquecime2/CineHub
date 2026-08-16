/* ============================================================
   SETTING THIS CARD ASIDE FROM SHARING
   ============================================================

   The tour had promised it for a long time — "you can set a card aside" —
   and there was no button at all. The route existed (`PUT
   /fiche/:id/hidden`), the column existed, sharing already respected it:
   what was missing was something to read it with, and something to click.

   WHY HERE AND NOT IN "WHAT WE DO WITH IT". Putting aside, filing at the
   bedside, deleting: those are gestures that move the card AT HOME.
   Setting aside from sharing moves nothing at home — the card stays on
   the wall, in the almanac, in the constellation. What changes is what
   OTHERS see, and that is why this button stands beside `Elsewhere` and
   `AddToList`, the two other blocks that speak only of the
   outside.

   IT ONLY APPEARS WHEN IT MEANS SOMETHING: with no server, no account,
   or when the collection is shown to nobody, there is nothing to set
   aside from anything.
   ============================================================ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, Eye } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import {
  hideCard,
  hiddenCards,
  mySharing,
  serverConfigured,
  type Sharing,
} from "../../services/server";
import type { Film } from "../../types";

export function HideFromSharing({ film, signedIn }: { film: Film; signedIn: boolean }) {
  const { t } = useTranslation();
  const [hiddenNow, setHiddenNow] = useState<boolean | null>(null);
  const [sharing, setPartage] = useState<Sharing | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!serverConfigured() || !signedIn) return;
    let alive = true;
    Promise.all([hiddenCards(), mySharing()])
      .then(([c, p]) => {
        if (!alive) return;
        setHiddenNow(c.ids.includes(film.id));
        setPartage(p.sharing);
      })
      /* A server breakdown does not make the card speak: the section
         disappears, the binder carries on. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn, film.id]);

  /* "Nobody" is not argued card by card: when nothing is shown,
     everything is already set aside, and offering to set more aside would
     be a box with no effect. */
  if (hiddenNow == null || sharing == null || sharing === "privee") return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const r = await hideCard(film.id, !hiddenNow);
      setHiddenNow(r.hidden);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-tour="detail-sharing" style={{ marginTop: 18 }}>
      <Label>{t("sharing.whatOthersSee")}</Label>
      <button
        onClick={toggle}
        disabled={busy}
        style={{
          all: "unset",
          ...tap,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.5 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
          fontFamily: F.mono,
          fontSize: 10,
          color: hiddenNow ? C.burgundy : C.inkFaded,
        }}
      >
        {hiddenNow ? <EyeOff size={12} /> : <Eye size={12} />}
        {hiddenNow ? t("sharing.hidden") : t("sharing.hide")}
      </button>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 5 }}>
        {hiddenNow
          ? "Personne ne la voit chez vous. Elle reste au mur, dans l'almanach et dans la constellation — c'est at dehors qui l'ignore."
          : t("sharing.shownNote")}
      </div>
    </div>
  );
}
