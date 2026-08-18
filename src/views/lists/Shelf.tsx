/* ============================================================
   LE MUR DES LISTES
   ============================================================

   UNE LISTE ÉTAIT UNE LIGNE DE TITRE, et c'est tout ce qu'elle a jamais
   été. On dépliait un accordéon pour en voir le contenu, lequel arrivait
   en lignes de texte lui aussi : dans une VIDÉOTHÈQUE, le domaine entier
   se lisait sans une seule image.

   La cause était en base et elle est levée (`006_list_poster.sql`) : une
   œuvre garde le chemin de son affiche. Ce fichier en tire la
   conséquence — une liste est une CARTE, et ce qu'on y lit d'abord est
   ce qu'elle contient.

   L'ÉVENTAIL VIT DANS `Fan.tsx` et non ici : il a trois appelants — ce
   mur, le premier pas de l'assistant de défi, et la carte d'un défi bâti
   sur une liste. Écrit trois fois, il aurait divergé trois fois.

   LE DÉSORDRE EST SEMÉ, jamais tiré au sort (`domain/seeded`) : un mur
   qui gigote à chaque rendu n'est pas un mur.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { ListPlus, Plus, Users } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { inked, tap, underlineInput } from "../../theme/styles";
import { Guideline, Label, Trouble, Waiting } from "../../components/ui";
import { tiltOf } from "../../domain/seeded";
import { Fan } from "./Fan";
import type { List } from "../../services/server";

/* ------------------------------------------------------------
   UNE CARTE
   ------------------------------------------------------------ */

function ListCard({ list, onOpen }: { list: List; onOpen: () => void }) {
  const { t } = useTranslation();
  const shared = !list.mienne || list.isMember;

  return (
    <button
      onClick={onOpen}
      /* UNE SEULE COMMANDE PAR CARTE, et c'est tout le progrès du lot :
         inviter, publier, supprimer, lancer un défi étaient quatre
         boutons posés à côté du titre, dans la colonne, pour des gestes
         qu'on fait une fois. Ils vivent dans la couche que ce bouton
         ouvre. */
      style={{
        all: "unset",
        ...tap,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        cursor: "pointer",
        boxSizing: "border-box",
        width: "100%",
        padding: 11,
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 3px 9px rgba(30,20,10,0.12)",
        transform: `rotate(${Number(tiltOf(list.id)) / 14}deg)`,
      }}
    >
      <Fan posters={list.posters ?? []} seed={list.id} height={78} />
      <span
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontSize: 19,
          color: C.ink,
          lineHeight: 1.15,
        }}
      >
        {list.title}
      </span>
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {t("listsView.worksCount", { count: list.works })}
        {list.is_public ? ` · ${t("listsView.public")}` : ""}
        {list.mienne ? "" : ` · ${t("listsView.at", { pseudo: list.owner })}`}
        {shared && <Users size={11} aria-hidden />}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------
   LE MUR
   ------------------------------------------------------------ */

export function Shelf({
  lists,
  settled,
  trouble,
  title,
  onTitle,
  onOpenOne,
  onCreate,
}: {
  lists: List[];
  settled: boolean;
  trouble: string | null;
  title: string;
  onTitle: (v: string) => void;
  onOpenOne: (id: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div style={{ marginBottom: 34 }}>
      <div data-tour="lists-new" style={{ maxWidth: 460, marginBottom: 20 }}>
        <Label>{t("listsView.newList")}</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            placeholder={t("listsView.newListPlaceholder")}
            style={{ ...underlineInput, fontFamily: F.hand, fontSize: 17 }}
          />
          <button onClick={onCreate} style={inked(C.ink)}>
            <Plus size={12} /> {t("listsView.open")}
          </button>
        </div>
      </div>

      <div data-tour="lists-mine">
        <Label>{t("listsView.yours")}</Label>
        {!settled && <Waiting label={t("listsView.loading")} />}
        {trouble && <Trouble>{trouble}</Trouble>}
        {settled && !trouble && lists.length === 0 && (
          <Guideline tight>{t("listsView.none")}</Guideline>
        )}
        <div
          style={{
            display: "grid",
            /* Le pas des cartes, et non celui du mur de fiches : une
               carte de liste n'est pas une affiche, elle en tient quatre
               en recouvrement. */
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 14,
            alignItems: "start",
            marginTop: 10,
          }}
        >
          {lists.map((l) => (
            <ListCard key={l.id} list={l} onOpen={() => onOpenOne(l.id)} />
          ))}
        </div>
        {settled && !trouble && lists.length > 0 && (
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 15,
              color: C.inkFaded,
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ListPlus size={13} aria-hidden />
            {t("listsView.fillNote")}
          </div>
        )}
      </div>
    </div>
  );
}
