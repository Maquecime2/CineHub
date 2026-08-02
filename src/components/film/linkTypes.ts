import { BookOpen, Palette, Clapperboard, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LinkType } from "../../types";

/** Les quatre natures d'œuvre reliables, avec leur pictogramme. */
export const LINK_TYPES: { key: LinkType; label: string; icon: LucideIcon }[] = [
  { key: "book", label: "Livre", icon: BookOpen },
  { key: "painting", label: "Peinture", icon: Palette },
  { key: "film", label: "Film", icon: Clapperboard },
  { key: "other", label: "Autre œuvre", icon: Sparkles },
];

/** Le type d'une œuvre, avec repli sur « Autre œuvre » si la clé est inconnue. */
export const linkTypeOf = (key: string) =>
  LINK_TYPES.find((t) => t.key === key) ?? (LINK_TYPES[3] as (typeof LINK_TYPES)[number]);
