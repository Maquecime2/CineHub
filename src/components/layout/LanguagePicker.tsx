/* ============================================================
   THE LANGUAGE PICKER — two cards, and each speaks for itself
   ============================================================

   The same shape as the skin picker next door, and deliberately: they are
   the same kind of decision — how the binder presents itself — taken from
   the same corner of the rail.

   EACH CARD IS WRITTEN IN THE LANGUAGE IT OFFERS. "English" written in
   French would be a small absurdity: somebody looking for their own
   language finds it by reading it, not by reading a translation of its
   name. */
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { LANGUAGES, type Language } from "../../i18n/language";
import { useEscape } from "../../hooks/useEscape";
import { useDialog } from "../../hooks/useDialog";

const PANEL: CSSProperties = {
  position: "fixed",
  right: 40,
  top: 90,
  zIndex: 60,
  width: 280,
  padding: "14px 16px",
  background: C.card,
  border: `1px solid ${C.line}`,
  boxShadow: "2px 8px 24px rgba(20,14,8,0.4)",
};

export function LanguagePicker({
  language,
  onPick,
  onClose,
}: {
  language: Language;
  onPick: (lang: Language) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEscape(onClose);
  const box = useDialog();
  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div ref={box} role="dialog" aria-modal="true" aria-label={t("language.title")} style={PANEL}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>
            {t("language.title").toUpperCase()}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label={t("language.close")}
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
            <X size={13} />
          </button>
        </div>

        {LANGUAGES.map((lang) => {
          const on = lang === language;
          return (
            <button
              key={lang}
              onClick={() => onPick(lang)}
              aria-pressed={on}
              lang={lang}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                boxSizing: "border-box",
                display: "block",
                width: "100%",
                marginBottom: 8,
                padding: "10px 12px",
                background: C.paper,
                border: on ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                borderRadius: "var(--tag-radius)",
              }}
            >
              <div style={{ fontFamily: F.title, fontSize: 17, color: C.ink }}>
                {t(`language.${lang}`)}
              </div>
              <div style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded, marginTop: 2 }}>
                {t(`language.${lang}Note`)}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
