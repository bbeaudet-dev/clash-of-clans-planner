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
  total: number;
  /** Count of instances already at the TH cap. */
  maxedCount: number;
  /** Instance counts by level, highest level first. */
  byLevel: LevelCount[];
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

// Display order and labels for base categories.
export const BASE_CATEGORY_ORDER = [
  "defense",
  "trap",
  "resource",
  "army",
  "village",
] as const;

export const BASE_CATEGORY_LABELS: Record<string, string> = {
  defense: "Defenses",
  trap: "Traps",
  resource: "Resource Buildings",
  army: "Army Buildings",
  village: "Village",
};

/** Total upgrade levels remaining across all instances of a building type. */
export function rowLevelsToGo(row: BuildingRow): number {
  if (row.cap === null) return 0;
  const cap = row.cap;
  return row.byLevel.reduce(
    (sum, l) => sum + l.count * Math.max(0, cap - l.level),
    0
  );
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

  for (const [id, levels] of byId) {
    const name = idToName[String(id)] ?? `#${id}`;
    const entity = getEntity(name);
    const category = displayCategory(entity?.category ?? "other");
    const cap = maxLevelAtTH(name, th);

    const byLevel: LevelCount[] = [...levels.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.level - a.level);
    const total = byLevel.reduce((s, l) => s + l.count, 0);
    const maxedCount =
      cap === null ? 0 : byLevel.filter((l) => l.level >= cap).reduce((s, l) => s + l.count, 0);

    const row: BuildingRow = { id, name, category, cap, total, maxedCount, byLevel };
    const list = rowsByCategory.get(category) ?? [];
    list.push(row);
    rowsByCategory.set(category, list);
  }

  const knownOrder = BASE_CATEGORY_ORDER as readonly string[];
  const categories = [...rowsByCategory.keys()].sort((a, b) => {
    const ia = knownOrder.indexOf(a);
    const ib = knownOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const groups = categories.map((category) => ({
    category,
    rows: rowsByCategory.get(category)!.sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return {
    tag: raw.tag ?? null,
    townHallLevel: th,
    timestamp,
    groups,
    inProgress: inProgress.sort((a, b) => a.secondsLeft - b.secondsLeft),
  };
}
