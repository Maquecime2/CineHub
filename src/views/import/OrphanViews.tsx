/* ============================================================
   LES VUES D'ÉTAGÈRE RETROUVÉES
   ============================================================

   UN DOCUMENT DE VUE QUE L'INDEX NE NOMME PAS EST INVISIBLE À JAMAIS :
   le classeur n'affiche que ce que l'index liste, et rien ne mène au
   reste. L'état existait pour une raison précise, corrigée depuis —
   supprimer une vue effaçait la clé sans poser de pierre tombale, donc
   le document restait sur le serveur, et une machine neuve le
   redescendait sans que rien ne le liste.

   C'EST UN GESTE, PAS UNE RÈGLE. Les adopter d'office ferait revenir des
   vues supprimées exprès, ce qui est pire que de les avoir perdues. On
   les propose donc, on ne les rend pas.

   ET ON COCHE CE QU'ON REPREND. La même forme que le panneau de
   réparation au-dessus, et pour la même raison : la machine montre, l'œil
   décide. Ce qu'on ne coche pas reste où il est — on peut revenir, et
   ce qu'on reprend se supprime ensuite comme n'importe quelle vue.

   IL NE S'AFFICHE QUE S'IL A QUELQUE CHOSE À DIRE. Un classeur en bon
   état n'a pas à porter en permanence le souvenir d'un défaut.
   ============================================================ */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Confirmation } from "../../components/ui";
import type { ConfirmRequest } from "../../components/ui";
import { adoptViews, discardViews, orphanViews } from "../../services/shelfViews";
import { refetchDocuments } from "../../services/sync";
import { accountOpen, serverConfigured } from "../../services/server";

export function OrphanViews({ onRecovered }: { onRecovered: () => void }) {
  const { t } = useTranslation();
  /* Lu une fois : la liste ne bouge pas tant qu'on n'a rien repris, et
     la relire à chaque frappe ferait clignoter les cases. */
  const [round, again] = useState(0);
  const orphans = useMemo(() => orphanViews(), [round]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  /* ELLES PEUVENT N'ÊTRE PLUS QU'AU SERVEUR. Le scan ci-dessus lit le
     DISQUE : une vue supprimée ici, dont la suppression n'est jamais
     partie, n'existe plus que là-bas. Il faut alors la redemander — et
     ce bouton est proposé même quand le scan ne trouve rien, parce que
     c'est précisément le cas où il ne trouve rien. */
  const fetchBack = () =>
    setRequest({
      title: t("orphanViews.refetchTitle"),
      body: t("orphanViews.refetchBody"),
      action: t("orphanViews.refetch"),
      onConfirm: () => {
        setRequest(null);
        refetchDocuments("shelf-view:");
        location.reload();
      },
    });

  if (orphans.length === 0) {
    if (!serverConfigured() || !accountOpen()) return null;
    return (
      <div
        style={{
          marginTop: 26,
          padding: "14px 16px",
          background: C.card,
          border: `1px dashed ${C.line}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <Layers size={14} color={C.slate} />
          <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 18, color: C.ink }}>
            {t("orphanViews.none")}
          </div>
        </div>
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, margin: "4px 0 10px" }}>
          {t("orphanViews.noneBlurb")}
        </div>
        <button
          onClick={fetchBack}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            color: C.slate,
            borderBottom: `1px dotted ${C.line}`,
          }}
        >
          {t("orphanViews.refetch")}
        </button>
        <Confirmation request={request} onClose={() => setRequest(null)} />
      </div>
    );
  }

  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const take = () => {
    adoptViews([...chosen]);
    setChosen(new Set());
    again((n) => n + 1);
    onRecovered();
  };

  /* JETER SANS PASSER PAR LE MUR. Reprendre une vue pour la supprimer
     aussitôt était le seul chemin, et c'en est un de trop : on voit ici
     ce dont on ne veut pas, on doit pouvoir s'en défaire ici.

     Elles partent PAR LE MAGASIN, donc avec une pierre tombale : c'est
     ce qui les efface aussi du serveur, et c'est précisément ce qui
     manquait quand elles y sont restées. */
  const discard = () => {
    discardViews([...chosen]);
    setChosen(new Set());
    again((n) => n + 1);
  };

  return (
    <div
      style={{
        marginTop: 26,
        padding: "14px 16px",
        background: C.card,
        border: `1px dashed ${C.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Layers size={14} color={C.slate} />
        <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 18, color: C.ink }}>
          {t("orphanViews.title", { count: orphans.length })}
        </div>
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, margin: "4px 0 10px" }}>
        {t("orphanViews.blurb")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {orphans.map((v) => (
          <label
            key={v.id}
            style={{
              ...tap,
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: F.body,
              fontSize: 14,
              color: C.ink,
            }}
          >
            <input
              type="checkbox"
              checked={chosen.has(v.id)}
              onChange={() => toggle(v.id)}
              style={{ accentColor: C.burgundy }}
            />
            <span>{String(v.name || t("orphanViews.unnamed"))}</span>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
              {t(`views.${v.wall === "watched" ? "library" : "watchlist"}`)}
            </span>
          </label>
        ))}
      </div>

      <button
        disabled={chosen.size === 0}
        onClick={() =>
          setRequest({
            title: t("orphanViews.confirmTitle", { count: chosen.size }),
            body: t("orphanViews.confirmBody"),
            action: t("orphanViews.action"),
            onConfirm: () => {
              setRequest(null);
              take();
            },
          })
        }
        style={{
          all: "unset",
          ...tap,
          cursor: chosen.size === 0 ? "default" : "pointer",
          marginTop: 12,
          padding: "7px 12px",
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: C.card,
          background: chosen.size === 0 ? C.inkFaded : C.slate,
          opacity: chosen.size === 0 ? 0.5 : 1,
        }}
      >
        {t("orphanViews.action")}
      </button>

      <button
        disabled={chosen.size === 0}
        onClick={() =>
          setRequest({
            title: t("orphanViews.discardTitle", { count: chosen.size }),
            body: t("orphanViews.discardBody"),
            action: t("orphanViews.discard"),
            severe: true,
            onConfirm: () => {
              setRequest(null);
              discard();
            },
          })
        }
        style={{
          all: "unset",
          ...tap,
          cursor: chosen.size === 0 ? "default" : "pointer",
          marginLeft: 10,
          padding: "7px 12px",
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: C.burgundy,
          border: `1px solid ${C.burgundy}`,
          opacity: chosen.size === 0 ? 0.4 : 1,
        }}
      >
        {t("orphanViews.discard")}
      </button>

      <Confirmation request={request} onClose={() => setRequest(null)} />
    </div>
  );
}
