/* ============================================================
   UNE LISTE OUVERTE
   ============================================================

   C'ÉTAIT UN ACCORDÉON, ET L'ACCORDÉON ÉTAIT LE PROBLÈME. Tout ce qu'une
   liste sait faire — ses œuvres, ses membres, l'invitation, la
   publication, la suppression, le lancement d'un défi — tenait SOUS un
   en-tête, dans la largeur de la colonne de vue. Douze commandes en
   file, et la place manquait pour montrer une seule affiche.

   PAR-DESSUS, LA PLACE EST CELLE DE LA FENÊTRE. C'est ce qui rend une
   grille d'affiches tenable, et c'est le raisonnement de `FilmQuickView`
   mot pour mot. La coquille est `Sheet`, qui tient `Layer` et
   `useDialog` pour tout le monde : la colonne de vue est un contexte
   d'empilement et porte une transformation pendant son animation
   d'entrée, donc un `position: fixed` rendu dedans s'ancrerait sur
   elle.

   ET LE FORMULAIRE DE DÉFI N'EST PLUS ICI. Il y était ENFOUI — il
   fallait déplier une liste pour le trouver — et il n'était que la
   moitié d'une porte, l'autre étant un second formulaire tout en bas de
   la page pour les défis sans liste. Les deux ont fermé au profit de
   `NewChallenge`, où l'on choisit la liste parmi celles où l'on peut
   écrire. Une liste reste donc défiable, en un geste de plus et un
   écran de moins.

   CE QU'ON FAIT UNE FOIS N'EST PAS DANS LE FLUX. Inviter, publier,
   supprimer sont trois gestes de propriétaire ; ils vivent au PIED de la
   couche, sous un pli, et non entre les affiches et le formulaire de
   défi. Le retrait d'une œuvre suit la même règle : plus une croix
   permanente par ligne, mais une commande qui paraît sur la vignette
   visée — le badge de classement de `FilmPolaroid` fait exactement cela.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Trash2, UserPlus, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, chip, inked, underlineInput } from "../../theme/styles";
import { Guideline, Trouble } from "../../components/ui";
import { Sheet } from "../../components/ui/Sheet";
import { Confirmation, type ConfirmRequest } from "../../components/ui/Confirmation";
import { posterUrl } from "../../tmdb";
import { tiltOf } from "../../domain/seeded";
import { FillFromTmdb } from "./FillFromTmdb";
import {
  deleteList,
  editList,
  inviteToList,
  readList,
  removeFromList,
  removeFromListMembers,
  type List,
  type ListWork,
} from "../../services/server";
import type { Film } from "../../types";

/* Le pas des vignettes du projet — celui des filiations et de la bande
   de photogrammes — et non celui du mur de fiches, qui est à 210 : on
   parcourt ici une liste, on n'y contemple pas une collection. */
const STEP = 150;

/* ------------------------------------------------------------
   UNE ŒUVRE
   ------------------------------------------------------------ */

function Work({ work, onRemove }: { work: ListWork; onRemove: () => void }) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const poster = work.poster_path ? posterUrl(work.poster_path) : "";

  return (
    <div
      onMouseEnter={() => setArmed(true)}
      onMouseLeave={() => setArmed(false)}
      style={{ position: "relative" }}
    >
      <div
        style={{
          aspectRatio: "2 / 3",
          background: C.paperDark,
          border: `1px solid ${C.line}`,
          boxShadow: "1px 2px 6px rgba(30,20,10,0.16)",
          transform: `rotate(${Number(tiltOf(work.tmdb_id)) / 16}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            aria-hidden
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          /* L'ÉMULSION DE REMPLACEMENT, ET AUCUN MOT D'EXCUSE. Une œuvre
             rangée avant que la colonne d'affiche existe n'a rien fait
             de mal : elle se comblera au prochain rangement. */
          <span
            aria-hidden
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontSize: 13,
              color: C.inkFaded,
              padding: 8,
              textAlign: "center",
            }}
          >
            {work.title || work.tmdb_id}
          </span>
        )}
      </div>

      <div style={{ marginTop: 5 }}>
        <div style={{ fontFamily: F.title, fontSize: 14, color: C.ink, lineHeight: 1.2 }}>
          {work.title || `TMDB ${work.tmdb_id}`}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
          {work.year || ""}
          {/* Qui l'a mise là : dans une liste écrite à six mains, c'est
              la seule chose qu'on veut savoir d'une entrée. */}
          {work.by ? `${work.year ? " · " : ""}${work.by}` : ""}
        </div>
      </div>

      {/* LE RETRAIT PARAÎT, IL N'HABITE PAS LÀ. Trente croix bordeaux
          alignées faisaient de la lecture d'une liste la lecture d'un
          formulaire de suppression. Elle reste atteignable au clavier :
          c'est le focus, et non le seul survol, qui l'arme. */}
      <button
        onClick={onRemove}
        onFocus={() => setArmed(true)}
        onBlur={() => setArmed(false)}
        title={t("listsView.removeWork")}
        aria-label={t("listsView.removeWorkOf", { title: work.title || work.tmdb_id })}
        style={{
          ...bare,
          position: "absolute",
          top: 4,
          right: 4,
          color: C.burgundy,
          background: alpha(C.paper, 0.9),
          border: `1px solid ${C.line}`,
          padding: 3,
          opacity: armed ? 1 : 0,
          transition: "opacity var(--motion-fast) var(--motion-ease)",
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------
   LA COUCHE
   ------------------------------------------------------------ */

export function ListLayer({
  list,
  films,
  onChange,
  onLook,
  onClose,
}: {
  list: List;
  films: Film[];
  onChange: () => Promise<void>;
  onLook: (film: Film) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [works, setWorks] = useState<ListWork[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [invite, setInvitee] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  /* LE PLI. Trois gestes de propriétaire qu'on fait une fois chacun, et
     qui prenaient le tiers de l'écran en permanence. */
  const [keeping, setKeeping] = useState(false);
  const reread = useCallback(async () => {
    const r = await readList(list.id);
    setWorks(r.works);
    setMembers(r.members);
  }, [list.id]);

  useEffect(() => {
    reread().catch(() => setTrouble(t("lists.filingFailed")));
  }, [reread, t]);

  const sendInvite = async () => {
    const name = invite.trim().toLowerCase();
    if (!name) return;
    setTrouble(null);
    try {
      await inviteToList(list.id, name);
      setInvitee("");
      await reread();
    } catch {
      /* Le serveur répond la même chose pour « n'existe pas » et « vous
         vous êtes bloqués » : on reprend ce silence. */
      setTrouble(t("listsView.nobodyToInvite", { pseudo: name }));
    }
  };

  return (
    <Sheet
      title={list.title}
      aside={
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {t("listsView.worksCount", { count: list.works })}
          {list.is_public ? ` · ${t("listsView.public")}` : ""}
          {list.mienne ? "" : ` · ${t("listsView.at", { pseudo: list.owner })}`}
        </span>
      }
      width={920}
      onClose={onClose}
    >
      {works.length === 0 ? (
        <Guideline tight>{t("lists.searchNote")}</Guideline>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${STEP}px, 1fr))`,
            gap: 14,
            alignItems: "start",
            marginTop: 14,
          }}
        >
          {works.map((o) => (
            <Work
              key={o.tmdb_id}
              work={o}
              onRemove={() => void removeFromList(list.id, o.tmdb_id).then(reread)}
            />
          ))}
        </div>
      )}

      <FillFromTmdb list={list} works={works} films={films} onLook={onLook} onFiled={reread} />

      {/* ------------------------------------------------------
              LE PLI DU PROPRIÉTAIRE
              ------------------------------------------------------
              Co-écrire est un droit d'écrire, pas une propriété : seul
              le propriétaire invite, publie et supprime. */}
      {list.mienne && (
        <div style={{ marginTop: 22, paddingTop: 12, borderTop: `1px dashed ${C.line}` }}>
          <button
            onClick={() => setKeeping(!keeping)}
            aria-expanded={keeping}
            style={{
              ...bare,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            <ChevronDown
              size={12}
              aria-hidden
              style={{
                transform: keeping ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform var(--motion-fast) var(--motion-ease)",
              }}
            />
            {t("listsView.keeping")}
          </button>

          {keeping && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input
                  value={invite}
                  onChange={(e) => setInvitee(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  placeholder={t("listsView.inviteSomebody")}
                  autoCapitalize="none"
                  spellCheck={false}
                  style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                />
                <button onClick={sendInvite} style={inked(C.pine)}>
                  <UserPlus size={12} /> {t("listsView.invite")}
                </button>
              </div>

              {members.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {members.map((m) => (
                    <span key={m} style={chip}>
                      {m}
                      <button
                        onClick={() => void removeFromListMembers(list.id, m).then(reread)}
                        title={t("listsView.removeMember", { pseudo: m })}
                        style={{ ...bare, color: C.burgundy }}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                <label style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                  <input
                    type="checkbox"
                    checked={list.is_public}
                    onChange={(e) =>
                      void editList(list.id, { is_public: e.target.checked }).then(onChange)
                    }
                  />{" "}
                  {t("listsView.publicNote")}
                </label>
                <span style={{ flex: 1 }} />
                <button
                  /* UNE LISTE EST PARTAGÉE : la supprimer ne retire
                         pas seulement la sienne, elle la retire à ceux
                         qu'on y a invités. Et il n'y a rien à annuler
                         derrière. */
                  onClick={() =>
                    setRequest({
                      title: t("listsView.confirmListTitle"),
                      body: t("listsView.confirmListBody", { title: list.title }),
                      action: t("common.delete"),
                      severe: true,
                      onConfirm: () =>
                        void deleteList(list.id)
                          .then(onChange)
                          .then(() => onClose()),
                    })
                  }
                  title={t("listsView.deleteList")}
                  style={{ ...bare, color: C.burgundy }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Trouble>{trouble}</Trouble>
      {/* La confirmation se demande PAR-DESSUS la feuille, comme
          l'abandon d'une partie de quizz par-dessus la partie. */}
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </Sheet>
  );
}
