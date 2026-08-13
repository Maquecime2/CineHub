import { BookOpen, Palette, Clapperboard, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LinkType } from "../../types";

/** The four kinds of linkable work, with their pictogram. */
export const LINK_TYPES: { key: LinkType; icon: LucideIcon }[] = [
  { key: "book", icon: BookOpen },
  { key: "painting", icon: Palette },
  { key: "film", icon: Clapperboard },
  { key: "other", icon: Sparkles },
];

/** A work's type, falling back on `other` if the key is unknown. */
export const linkTypeOf = (key: string) =>
  LINK_TYPES.find((t) => t.key === key) ?? (LINK_TYPES[3] as (typeof LINK_TYPES)[number]);
