import { getMaxLevel, getType } from "coc-info";

// The five upgradeable categories we surface in Phase 1. These map onto the
// upgrade "tracks" the planner will reason about later:
//   - Builder track: heroes (+ buildings/defenses/traps, added later)
//   - Laboratory track: troops, spells, siege machines
//   - Pets track: pets
export type Category = "hero" | "pet" | "troop" | "siege" | "spell";

export const CATEGORY_ORDER: Category[] = [
  "hero",
  "pet",
  "spell",
  "troop",
  "siege",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  hero: "Heroes",
  pet: "Pets",
  spell: "Spells",
  troop: "Troops",
  siege: "Siege Machines",
};

/** A single upgradeable item, joined with its Town Hall cap. */
export interface StatRow {
  name: string;
  category: Category;
  level: number;
  /** Max level attainable at the player's current Town Hall (from coc-info). */
  thMax: number | null;
  /** Game-wide max level (from the CoC API). */
  gameMax: number;
  /** Levels remaining to reach the TH cap (0 if maxed or unknown). */
  remaining: number;
}

/** Shape of the items the CoC API returns inside troops[]/heroes[]/spells[]. */
export interface ApiPlayerItem {
  name: string;
  level: number;
  maxLevel: number;
  village?: "home" | "builderBase";
  superTroopIsActive?: boolean;
}

export interface ApiPlayer {
  name: string;
  tag: string;
  townHallLevel: number;
  troops?: ApiPlayerItem[];
  heroes?: ApiPlayerItem[];
  spells?: ApiPlayerItem[];
  heroEquipment?: ApiPlayerItem[];
}

const KNOWN_CATEGORIES = new Set<string>(CATEGORY_ORDER);

function toCategory(name: string): Category | null {
  const type = getType(name);
  return type && KNOWN_CATEGORIES.has(type) ? (type as Category) : null;
}

export interface VillageStats {
  townHallLevel: number;
  groups: { category: Category; rows: StatRow[] }[];
}

/**
 * Join a player's items with their Town Hall caps and group by category.
 * Home village only; unknown names (e.g. super troops, hero equipment) and
 * builder base items are skipped for Phase 1.
 */
export function buildVillageStats(player: ApiPlayer): VillageStats {
  const th = player.townHallLevel;
  const items: ApiPlayerItem[] = [
    ...(player.heroes ?? []),
    ...(player.spells ?? []),
    ...(player.troops ?? []),
  ];

  const byCategory = new Map<Category, StatRow[]>();

  for (const item of items) {
    if (item.village && item.village !== "home") continue;
    if (item.superTroopIsActive) continue; // temporary super-troop state
    const category = toCategory(item.name);
    if (!category) continue;

    const thMax = getMaxLevel(item.name, th);
    const remaining = thMax !== null ? Math.max(0, thMax - item.level) : 0;

    const row: StatRow = {
      name: item.name,
      category,
      level: item.level,
      thMax,
      gameMax: item.maxLevel,
      remaining,
    };

    const list = byCategory.get(category) ?? [];
    list.push(row);
    byCategory.set(category, list);
  }

  const groups = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map(
    (category) => ({
      category,
      rows: byCategory
        .get(category)!
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  );

  return { townHallLevel: th, groups };
}
