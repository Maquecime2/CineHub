import { BookOpen, Palette, Clapperboard, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LinkType } from "../../types";

/** The four kinds of linkable work, with their pictogram. */
export const LINK_TYPES: { key: LinkType; label: string; icon: LucideIcon }[] = [
  { key: "book", label: "Livre", icon: BookOpen },
  { key: "painting", label: "Peinture", icon: Palette },
  { key: "film", label: "Film", icon: Clapperboard },
  { key: "other", label: "Autre œuvre", icon: Sparkles },
];

/** A work's type, falling back on "Autre œuvre" if the key is unknown. */
export const linkTypeOf = (key: string) =>
  LINK_TYPES.find((t) => t.key === key) ?? (LINK_TYPES[3] as (typeof LINK_TYPES)[number]);
