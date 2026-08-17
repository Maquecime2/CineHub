/* ------------------------------------------------------------
   THE BANK — the reserved half
   ------------------------------------------------------------ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { inked, underlineInput } from "../../theme/styles";
import { Guideline, Label } from "../../components/ui";
import { createCategory, type Category } from "../../services/server";
import { OneCategory } from "./OneCategory";

export function Bank({
  categories,
  onChange,
}: {
  categories: Category[];
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const make = async () => {
    const name = label.trim();
    if (!name) return;
    setTrouble(null);
    try {
      const { id } = await createCategory({ label: name });
      setLabel("");
      await onChange();
      setOpened(id);
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  return (
    <div style={{ border: `1px solid ${C.ink}`, padding: 13, marginTop: 12 }}>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
        {t("quizView.bankNote")}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10 }}>
        <div style={{ maxWidth: 300, flex: 1 }}>
          <Label>{t("quizView.newCategory")}</Label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && make()}
            placeholder={t("quizView.newCategoryPlaceholder")}
            style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16 }}
          />
        </div>
        <button onClick={make} style={inked(C.ink)}>
          <Plus size={12} /> {t("quizView.addCategory")}
        </button>
      </div>
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          {trouble}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {categories.length === 0 && <Guideline tight>{t("quizView.noCategories")}</Guideline>}
        {categories.map((c) => (
          <OneCategory
            key={c.id}
            category={c}
            opened={opened === c.id}
            onToggle={() => setOpened(opened === c.id ? null : c.id)}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
