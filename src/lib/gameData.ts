import rawGameData from "@/data/gameData.generated.json";

// The five upgradeable categories we surface in the village stats view. These
// map onto the upgrade "tracks" the planner reasons about:
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

interface GameLevel {
  level: number;
  time: number; // seconds to reach this level from the previous one
  cost: number;
  th: number | null; // Town Hall required for this level
}

interface GameEntity {
  id: number;
  name: string;
  category: string;
  village: string;
  resource: string | null;
  isSuper?: boolean;
  levels: GameLevel[];
}

interface GameData {
  source: string;
  generatedAt: string;
  entities: Record<string, GameEntity>;
  idToName: Record<string, string>;
}

const gameData = rawGameData as unknown as GameData;

/** Numeric-ID -> entity name map (matches the in-game village-data export). */
export const idToName = gameData.idToName;

const KNOWN_CATEGORIES = new Set<string>(CATEGORY_ORDER);

export function getEntity(name: string): GameEntity | undefined {
  return gameData.entities[name];
}

function toCategory(name: string): Category | null {
  const entity = gameData.entities[name];
  return entity && KNOWN_CATEGORIES.has(entity.category)
    ? (entity.category as Category)
    : null;
}

/** Max level attainable at a given Town Hall, or null if not yet available. */
export function maxLevelAtTH(name: string, townHallLevel: number): number | null {
  const entity = gameData.entities[name];
  if (!entity) return null;
  let max: number | null = null;
  for (const lv of entity.levels) {
    if (lv.th !== null && lv.th <= townHallLevel) {
      max = Math.max(max ?? 0, lv.level);
    }
  }
  return max;
}

// In the source data each level row carries the time/cost to upgrade FROM that
// level to the next one (so level N's `time` is the N -> N+1 upgrade). To go
// from `fromLevel` to `toLevel` we therefore sum rows in [fromLevel, toLevel).

/** Total upgrade time (seconds) to go from `fromLevel` to `toLevel`. */
export function upgradeTime(
  name: string,
  fromLevel: number,
  toLevel: number
): number {
  const entity = gameData.entities[name];
  if (!entity) return 0;
  let total = 0;
  for (const lv of entity.levels) {
    if (lv.level >= fromLevel && lv.level < toLevel) total += lv.time;
  }
  return total;
}

/** Total upgrade cost to go from `fromLevel` to `toLevel`. */
export function upgradeCost(
  name: string,
  fromLevel: number,
  toLevel: number
): number {
  const entity = gameData.entities[name];
  if (!entity) return 0;
  let total = 0;
  for (const lv of entity.levels) {
    if (lv.level >= fromLevel && lv.level < toLevel) total += lv.cost;
  }
  return total;
}

/** A single upgradeable item, joined with its Town Hall caps. */
export interface StatRow {
  name: string;
  category: Category;
  level: number;
  /** Max level attainable at the player's current Town Hall. */
  thMax: number | null;
  /** Max level at the PREVIOUS Town Hall (what was already unlocked before). */
  prevThMax: number | null;
  /** Max level at the NEXT Town Hall (the upcoming goal). */
  nextThMax: number | null;
  /** Game-wide max level (from the CoC API). */
  gameMax: number;
  /** Levels remaining to reach the current TH cap (0 if maxed or unknown). */
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

export interface VillageStats {
  townHallLevel: number;
  groups: { category: Category; rows: StatRow[] }[];
}

/**
 * Join a player's items with their Town Hall caps and group by category.
 * Home village only; unknown names (super troops, hero equipment) and builder
 * base items are skipped.
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
    // Super troops have no independent upgrade level. The API only marks the
    // currently-boosted one via superTroopIsActive, so we rely on our own
    // rulebook flag (isSuper) to exclude all of them.
    if (item.superTroopIsActive !== undefined) continue;
    if (getEntity(item.name)?.isSuper) continue;
    const category = toCategory(item.name);
    if (!category) continue;

    const thMax = maxLevelAtTH(item.name, th);
    const prevThMax = th > 1 ? maxLevelAtTH(item.name, th - 1) : null;
    const nextThMax = maxLevelAtTH(item.name, th + 1);
    const remaining = thMax !== null ? Math.max(0, thMax - item.level) : 0;

    const row: StatRow = {
      name: item.name,
      category,
      level: item.level,
      thMax,
      prevThMax,
      nextThMax,
      gameMax: item.maxLevel,
      remaining,
    };

    const list = byCategory.get(category) ?? [];
    list.push(row);
    byCategory.set(category, list);
  }

  // Order items within a category by Supercell entity id, which follows the
  // in-game unlock / menu order (Barbarian, Archer, Giant, …) far better than
  // alphabetical.
  const idOf = (name: string) => gameData.entities[name]?.id ?? Number.MAX_SAFE_INTEGER;
  const groups = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map(
    (category) => ({
      category,
      rows: byCategory.get(category)!.sort((a, b) => idOf(a.name) - idOf(b.name)),
    })
  );

  return { townHallLevel: th, groups };
}
