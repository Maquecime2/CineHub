/* ============================================================
   LE CARNET — un tiroir, et non plus un onglet
   ============================================================

   Des pages libres, qui n'appartiennent à aucun film. C'était une vue
   entière du rail, à côté de la vidéothèque et du générique : une
   pastille permanente pour une fonction annexe, dans un rail qui en
   comptait déjà douze.

   RIEN N'EST REPRIS AU PASSAGE, et c'est la seule chose qui comptait. On
   écrit, on relit, on efface exactement comme avant ; la recherche
   transverse lit toujours ces pages (`domain/everywhere`), la
   sauvegarde les emporte toujours, et la synchro les envoie toujours
   sous la clé `notebook-notes`. Ce qui disparaît est une pastille, pas
   un carnet.

   IL PASSE PAR `<Layer>`, obligatoirement. Un `position: fixed` rendu
   dans la colonne de vue s'ancre sur elle et non sur la fenêtre —
   `[data-enters]` est un contexte d'empilement transformé — et le tiroir
   se serait ouvert hors écran depuis le bas d'un long mur. C'est écrit
   dans CLAUDE.md, et ça a déjà mordu.

   ET SES MOTS SONT AU CATALOGUE. La vue qu'il remplace était en français
   dans le texte, jusqu'au bouton et à la date, alors que son onglet,
   lui, était traduit : sous une peau anglaise, le rail disait
   « Notebook » et la page « Le carnet ».
   ============================================================ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, ruledTextarea, tap } from "../../theme/styles";
import { tiltOf } from "../../domain/seeded";
import { uid } from "../../domain/film";
import { StampCorner } from "../atmosphere";
import { Layer } from "../ui/Layer";
import { Confirmation, type ConfirmRequest } from "../ui/Confirmation";
import { useDialog } from "../../hooks/useDialog";
import type { Note } from "../../types";

export function NotebookDrawer({
  notes,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: {
  notes: Note[];
  onAdd: (n: Note) => void;
  onUpdate: (n: Note) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  /* Le focus entre dans le tiroir, y tourne, et revient au bouton qui
     l'a ouvert. `Escape` est déjà géré plus bas, d'où l'appel sans
     rappel : deux gestionnaires pour une touche en font un de trop. */
  const box = useDialog();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const create = () => {
    if (!body.trim() && !title.trim()) return;
    onAdd({
      id: uid(),
      title: title.trim() || t("notebook.untitled"),
      body,
      createdAt: Date.now(),
    });
    setTitle("");
    setBody("");
  };

  // Échap ferme, comme partout ailleurs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Layer>
      <>
        <div
          onClick={onClose}
          data-veil
          style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }}
        />
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={t("notebook.title")}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(520px, 94vw)",
            zIndex: 60,
            background: C.paper,
            borderLeft: `1px solid ${C.line}`,
            boxShadow: "-6px 0 24px rgba(0,0,0,0.28)",
            overflowY: "auto",
            padding: "26px 26px 40px",
            animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
          }}
        >
          <StampCorner text={t("notebook.stamp")} />

          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 30,
                color: C.ink,
              }}
            >
              {t("notebook.title")}
            </div>
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginLeft: "auto",
                display: "flex",
              }}
            >
              <X size={16} color={C.inkFaded} />
            </button>
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 18,
              color: C.inkFaded,
              margin: "2px 0 22px",
            }}
          >
            {t("notebook.subtitle")}
          </div>

          <div
            data-tour="notebook-new"
            style={{
              background: C.card,
              padding: 20,
              boxShadow: "3px 5px 12px rgba(30,20,10,0.22)",
              transform: "rotate(-0.6deg)",
            }}
          >
            <input
              style={{
                ...underlineInput,
                fontFamily: F.title,
                fontStyle: "italic",
                fontSize: 19,
                fontWeight: 700,
              }}
              placeholder={t("notebook.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              style={{ ...ruledTextarea, minHeight: 90, marginTop: 8 }}
              placeholder={t("notebook.bodyPlaceholder")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              onClick={create}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginTop: 14,
                background: C.pine,
                color: C.card,
                padding: "8px 16px",
                fontFamily: F.mono,
                fontSize: 11,
              }}
            >
              + {t("notebook.add")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 30 }}>
            {notes.length === 0 && (
              <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded }}>
                {t("notebook.empty")}
              </div>
            )}
            {[...notes]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: C.card,
                    padding: 18,
                    boxShadow: "2px 4px 10px rgba(30,20,10,0.2)",
                    transform: `rotate(${Number(tiltOf(n.id)) / 3}deg)`,
                    position: "relative",
                  }}
                >
                  <button
                    /* UNE PAGE ÉCRITE NE S'EFFACE PAS SUR UN CLIC. Le
                       bouton est une petite croix au coin d'une page,
                       à quelques pixels du champ dans lequel on tape :
                       c'est exactement le geste qu'on fait de travers.
                       Et il n'y a rien à annuler derrière — le carnet
                       n'a pas de corbeille. */
                    onClick={() =>
                      setRequest({
                        title: t("notebook.confirmTitle"),
                        body: n.title?.trim()
                          ? t("notebook.confirmNamed", { title: n.title.trim() })
                          : t("notebook.confirmBlank"),
                        action: t("common.delete"),
                        severe: true,
                        onConfirm: () => onDelete(n.id),
                      })
                    }
                    aria-label={t("common.delete")}
                    style={{
                      all: "unset",
                      ...tap,
                      position: "absolute",
                      top: 12,
                      right: 14,
                      cursor: "pointer",
                      color: C.inkFaded,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                  <input
                    style={{
                      ...underlineInput,
                      fontFamily: F.title,
                      fontStyle: "italic",
                      fontWeight: 700,
                      fontSize: 18,
                      border: "none",
                    }}
                    value={n.title}
                    onChange={(e) => onUpdate({ ...n, title: e.target.value })}
                  />
                  <textarea
                    style={{ ...ruledTextarea, minHeight: 50, border: "none" }}
                    value={n.body}
                    onChange={(e) => onUpdate({ ...n, body: e.target.value })}
                  />
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 9.5,
                      color: C.inkFaded,
                      marginTop: 6,
                    }}
                  >
                    {new Date(n.createdAt).toLocaleDateString(i18n.language, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
        <Confirmation request={request} onClose={() => setRequest(null)} />
      </>
    </Layer>
  );
}
