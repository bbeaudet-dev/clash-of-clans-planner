import rawGameData from "@/data/gameData.generated.json";

// The five upgradeable categories we surface in the village stats view. These
// map onto the upgrade "tracks" the planner reasons about:
//   - Builder track: heroes (+ buildings/defenses/traps, added later)
//   - Laboratory track: troops, spells, siege machines
//   - Pets track: pets
export type Category =
  | "hero"
  | "equipment"
  | "pet"
  | "troop"
  | "siege"
  | "spell"
  | "guardian";

export const CATEGORY_ORDER: Category[] = [
  "hero",
  "equipment",
  "pet",
  "spell",
  "troop",
  "siege",
  "guardian",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  hero: "Heroes",
  equipment: "Hero Equipment",
  pet: "Pets",
  spell: "Spells",
  troop: "Troops",
  siege: "Siege Machines",
  guardian: "Guardians",
};

// Town Hall level at which each army category first becomes available. Used to
// decide when to start showing a section (categories appear as they unlock).
export const CATEGORY_UNLOCK_TH: Record<Category, number> = {
  hero: 7, // Barbarian King
  equipment: 8, // Blacksmith
  spell: 5, // Spell Factory
  troop: 1, // Barracks
  siege: 12, // Workshop
  pet: 14, // Pet House
  guardian: 18, // Guardians
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
  /** Owning hero (hero equipment only). */
  hero?: string;
  /** Rarity, e.g. "Common" | "Epic" (hero equipment only). */
  rarity?: string;
  levels: GameLevel[];
}

/** One building (with its quantity) newly granted at a given Town Hall level. */
export interface TownHallUnlock {
  id: number;
  name: string;
  quantity: number;
}

interface GameData {
  source: string;
  generatedAt: string;
  entities: Record<string, GameEntity>;
  idToName: Record<string, string>;
  /** Buildings newly unlocked at each Town Hall level, keyed by TH level. */
  townHallUnlocks: Record<string, TownHallUnlock[]>;
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

/**
 * Buildings newly unlocked at exactly `townHallLevel` (verbatim from the game's
 * Town Hall `unlocks` data): each entry is a building name/id and how many new
 * copies that TH grants.
 */
export function newBuildingsAtTH(townHallLevel: number): TownHallUnlock[] {
  return gameData.townHallUnlocks[String(townHallLevel)] ?? [];
}

/**
 * Total number of copies of a building available at a given Town Hall (summing
 * every unlock up to and including `townHallLevel`). 0 if never unlocked yet.
 */
export function buildingCountAtTH(name: string, townHallLevel: number): number {
  let count = 0;
  for (let th = 1; th <= townHallLevel; th++) {
    for (const u of newBuildingsAtTH(th)) {
      if (u.name === name) count += u.quantity;
    }
  }
  return count;
}

/**
 * The full building roster available at a Town Hall: building name -> total
 * count. Reusable for rosters, un-built tracking, and "what's new this TH".
 */
export function buildingRosterAtTH(townHallLevel: number): Map<string, number> {
  const roster = new Map<string, number>();
  for (let th = 1; th <= townHallLevel; th++) {
    for (const u of newBuildingsAtTH(th)) {
      roster.set(u.name, (roster.get(u.name) ?? 0) + u.quantity);
    }
  }
  return roster;
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
 * Home village only; unknown names (super troops) and builder-base items are
 * skipped. Hero equipment is included but keyed off the API's own max level
 * (it's ore-upgraded and instant, not Town-Hall-capped like the rest).
 */
export function buildVillageStats(player: ApiPlayer): VillageStats {
  const th = player.townHallLevel;
  const items: ApiPlayerItem[] = [
    ...(player.heroes ?? []),
    ...(player.spells ?? []),
    ...(player.troops ?? []),
    ...(player.heroEquipment ?? []),
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

    let thMax: number | null;
    let prevThMax: number | null;
    let nextThMax: number | null;
    if (category === "equipment") {
      // No Town Hall band for equipment: treat the API max as its cap.
      thMax = item.maxLevel;
      prevThMax = null;
      nextThMax = null;
    } else {
      thMax = maxLevelAtTH(item.name, th);
      prevThMax = th > 1 ? maxLevelAtTH(item.name, th - 1) : null;
      nextThMax = maxLevelAtTH(item.name, th + 1);
    }
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
