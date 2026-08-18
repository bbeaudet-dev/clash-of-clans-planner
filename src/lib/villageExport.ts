import { getEntity, idToName, maxLevelAtTH } from "./gameData";

// Parses the in-game "Download village data" JSON export. Focus: the home
// village base (buildings + traps), which the official API does NOT expose.
// The export is keyed by Supercell numeric IDs, decoded here via idToName.

const TOWN_HALL_ID = 1000001;

interface RawEntry {
  data: number;
  lvl?: number;
  cnt?: number;
  timer?: number;
  weapon?: number;
  gear_up?: number;
}

interface RawExport {
  tag?: string;
  timestamp?: number;
  buildings?: RawEntry[];
  traps?: RawEntry[];
  helpers?: RawEntry[];
}

export interface LevelCount {
  level: number;
  count: number;
}

export interface BuildingRow {
  id: number;
  name: string;
  category: string;
  cap: number | null;
  /** Max level attainable at the PREVIOUS Town Hall (null if new this TH). */
  prevCap: number | null;
  total: number;
  /** Count of instances already at the TH cap. */
  maxedCount: number;
  /** Instance counts by level, highest level first. */
  byLevel: LevelCount[];
}

export interface BuildingProgress {
  /** New levels this Town Hall added, summed across all instances. */
  bandTotal: number;
  /** New-band levels already completed. */
  doneInBand: number;
  /** Levels owed from before (instances below the previous TH cap). */
  catchUp: number;
  /** Total levels remaining to reach the current TH cap. */
  remaining: number;
}

/**
 * Split a building type's progress into the current TH's "new levels" band and
 * any "catch-up" levels still owed from the previous TH (when the player rushed
 * ahead before finishing the last TH's upgrades).
 */
export function buildingProgress(row: BuildingRow): BuildingProgress {
  if (row.cap === null) {
    return { bandTotal: 0, doneInBand: 0, catchUp: 0, remaining: 0 };
  }
  const cap = row.cap;
  const prev = row.prevCap ?? 0;
  const band = Math.max(0, cap - prev);
  let bandTotal = 0;
  let doneInBand = 0;
  let catchUp = 0;
  for (const l of row.byLevel) {
    bandTotal += band * l.count;
    catchUp += Math.max(0, prev - l.level) * l.count;
    doneInBand += Math.min(band, Math.max(0, l.level - prev)) * l.count;
  }
  return {
    bandTotal,
    doneInBand,
    catchUp,
    remaining: catchUp + (bandTotal - doneInBand),
  };
}

export interface InProgressUpgrade {
  name: string;
  level: number; // level the instance is currently at (upgrading from)
  secondsLeft: number;
  finishesAt: number | null; // unix seconds, if the export had a timestamp
}

export interface VillageExport {
  tag: string | null;
  townHallLevel: number;
  timestamp: number | null;
  groups: { category: string; rows: BuildingRow[] }[];
  inProgress: InProgressUpgrade[];
}

// Town Hall, Walls, Builder Huts, B.O.B, and Helper Hut are lumped into a single
// "village" section since their individual buildings aren't upgrade-planning
// concerns on their own.
const VILLAGE_MISC = new Set([
  "town hall",
  "wall",
  "worker",
  "worker2",
  "helper",
]);

function displayCategory(category: string): string {
  return VILLAGE_MISC.has(category) ? "village" : category;
}

// Helpers present in the export but not (yet) in the rulebook data. They have no
// upgrade levels, so we show them as a complete single-level helper.
const HELPER_FALLBACK_NAMES: Record<number, string> = {
  93000003: "Prospector",
};

// Display order and labels for base categories (roughly in-game order).
export const BASE_CATEGORY_ORDER = [
  "defense",
  "trap",
  "resource",
  "army",
  "helper",
  "village",
] as const;

export const BASE_CATEGORY_LABELS: Record<string, string> = {
  defense: "Defenses",
  trap: "Traps",
  resource: "Resource Buildings",
  army: "Army Buildings",
  helper: "Helpers",
  village: "Village",
};

/** Total upgrade levels remaining across all instances of a building type. */
export function rowLevelsToGo(row: BuildingRow): number {
  return buildingProgress(row).remaining;
}

function isVillageExport(value: unknown): value is RawExport {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as RawExport).buildings)
  );
}

/** Parse a village-data export string or object into structured base data. */
export function parseVillageExport(input: string | unknown): VillageExport {
  const raw: unknown = typeof input === "string" ? JSON.parse(input) : input;
  if (!isVillageExport(raw)) {
    throw new Error(
      "That doesn't look like a village-data export (no buildings found)."
    );
  }

  const timestamp = typeof raw.timestamp === "number" ? raw.timestamp : null;

  const th =
    raw.buildings?.find((b) => b.data === TOWN_HALL_ID)?.lvl ?? 0;

  const entries = [...(raw.buildings ?? []), ...(raw.traps ?? [])];

  // Inventory counts come from entries carrying `cnt`. Singletons like the Town
  // Hall have no `cnt`, so we add those only when an ID has no counted entries.
  const countedIds = new Set(
    entries.filter((e) => typeof e.cnt === "number").map((e) => e.data)
  );

  const byId = new Map<number, Map<number, number>>();
  const inProgress: InProgressUpgrade[] = [];

  const add = (id: number, level: number, count: number) => {
    const levels = byId.get(id) ?? new Map<number, number>();
    levels.set(level, (levels.get(level) ?? 0) + count);
    byId.set(id, levels);
  };

  for (const e of entries) {
    if (typeof e.lvl !== "number") continue; // skip module-only entries
    if (typeof e.cnt === "number") {
      add(e.data, e.lvl, e.cnt);
    } else if (!countedIds.has(e.data)) {
      add(e.data, e.lvl, 1); // singleton (e.g. Town Hall)
    }
    if (typeof e.timer === "number" && e.timer > 0) {
      const name = idToName[String(e.data)] ?? `#${e.data}`;
      inProgress.push({
        name,
        level: e.lvl,
        secondsLeft: e.timer,
        finishesAt: timestamp !== null ? timestamp + e.timer : null,
      });
    }
  }

  const rowsByCategory = new Map<string, BuildingRow[]>();

  const pushRow = (
    id: number,
    levels: Map<number, number>,
    category: string,
    nameOverride?: string,
    capOverride?: number
  ) => {
    const name = nameOverride ?? idToName[String(id)] ?? `#${id}`;
    const cap = capOverride ?? maxLevelAtTH(name, th);
    const prevCap = capOverride ?? (th > 1 ? maxLevelAtTH(name, th - 1) : null);

    const byLevel: LevelCount[] = [...levels.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.level - a.level);
    const total = byLevel.reduce((s, l) => s + l.count, 0);
    const maxedCount =
      cap === null
        ? 0
        : byLevel.filter((l) => l.level >= cap).reduce((s, l) => s + l.count, 0);

    const row: BuildingRow = { id, name, category, cap, prevCap, total, maxedCount, byLevel };
    const list = rowsByCategory.get(category) ?? [];
    list.push(row);
    rowsByCategory.set(category, list);
  };

  for (const [id, levels] of byId) {
    const entity = getEntity(idToName[String(id)] ?? "");
    pushRow(id, levels, displayCategory(entity?.category ?? "other"));
  }

  // Helper Hut helpers (Builder's Apprentice, Lab Assistant, Alchemist, …) come
  // in their own array and each is a singleton. Ones not in the rulebook get a
  // fallback name and their cap pinned to their current level, so single-level
  // helpers like Prospector read as 1/1 (maxed).
  for (const h of raw.helpers ?? []) {
    if (typeof h.lvl !== "number") continue;
    const known = String(h.data) in idToName;
    const fallback = HELPER_FALLBACK_NAMES[h.data];
    if (!known && !fallback) continue;
    pushRow(
      h.data,
      new Map([[h.lvl, 1]]),
      "helper",
      known ? undefined : fallback,
      known ? undefined : h.lvl
    );
  }

  const knownOrder = BASE_CATEGORY_ORDER as readonly string[];
  const categories = [...rowsByCategory.keys()].sort((a, b) => {
    const ia = knownOrder.indexOf(a);
    const ib = knownOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Within a section, order by Supercell entity id, which tracks in-game
  // unlock / menu order (Barbarian, Archer, Giant, …) far better than A-Z.
  const groups = categories.map((category) => ({
    category,
    rows: rowsByCategory.get(category)!.sort((a, b) => a.id - b.id),
  }));

  return {
    tag: raw.tag ?? null,
    townHallLevel: th,
    timestamp,
    groups,
    inProgress: inProgress.sort((a, b) => a.secondsLeft - b.secondsLeft),
  };
}
