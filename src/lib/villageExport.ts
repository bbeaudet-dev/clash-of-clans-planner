import {
  buildingRosterAtTH,
  getEntity,
  idToName,
  maxLevelAtTH,
} from "./gameData";

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
  // Army arrays: levels come from the API, but the export carries their live
  // upgrade timers (heroes/siege use builders, troops/spells use the lab).
  units?: RawEntry[];
  siege_machines?: RawEntry[];
  heroes?: RawEntry[];
  spells?: RawEntry[];
  pets?: RawEntry[];
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
  /** Copies this TH grants that haven't been placed yet (built from scratch). */
  toBuild?: number;
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
  "village",
  "helper",
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

  const byId = new Map<number, Map<number, number>>();
  const inProgress: InProgressUpgrade[] = [];

  const add = (id: number, level: number, count: number) => {
    const levels = byId.get(id) ?? new Map<number, number>();
    levels.set(level, (levels.get(level) ?? 0) + count);
    byId.set(id, levels);
  };

  // Every entry with a level is `cnt` instances (default 1). The export splits
  // instances of the same building into separate entries when one is in a
  // special state — upgrading (`timer`), or geared/weaponed (`gear_up`/`weapon`)
  // — and those split entries omit `cnt`. Counting them as 1 (rather than
  // dropping them) keeps the inventory total correct.
  for (const e of entries) {
    if (typeof e.lvl !== "number") continue; // skip module-only entries
    add(e.data, e.lvl, e.cnt ?? 1);
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

  // Army upgrades (heroes, troops, spells, siege, pets) each live in their own
  // array and may carry a live upgrade timer. We surface those timers so the
  // planner uses the real remaining time (not the full step) and lists them in
  // "Currently upgrading". Their levels come from the API, so we only read
  // timers here — not counts.
  const armyArrays = [
    raw.heroes,
    raw.units,
    raw.siege_machines,
    raw.spells,
    raw.pets,
  ];
  for (const arr of armyArrays) {
    for (const e of arr ?? []) {
      if (typeof e.lvl !== "number") continue;
      if (typeof e.timer !== "number" || e.timer <= 0) continue;
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
    // The Town Hall is the one building whose level *is* the Town Hall number,
    // so while you're at TH N it's maxed at level N by definition. (Its data
    // lists level N+1 as available at TH N — that's the next-TH transition, not
    // a within-TH upgrade, and it's accounted for separately in the timing.)
    const isTownHall = id === TOWN_HALL_ID;
    const cap = isTownHall ? th : (capOverride ?? maxLevelAtTH(name, th));
    const prevCap = isTownHall
      ? th > 1
        ? th - 1
        : null
      : capOverride ?? (th > 1 ? maxLevelAtTH(name, th - 1) : null);

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

  // Reconcile against the full building roster this TH grants: any copies you
  // haven't placed yet (a brand-new type, or an extra copy of one you have)
  // show up as grayed "to build" work. Traps aren't in the TH unlock data, and
  // walls/huts are handled elsewhere, so we only reconcile the leveled building
  // categories. (This is a name/category routing detail, not a data mismatch.)
  const RECONCILED = new Set(["defense", "resource", "army"]);
  for (const [name, expected] of buildingRosterAtTH(th)) {
    const entity = getEntity(name);
    if (!entity || !RECONCILED.has(entity.category)) continue;
    const category = displayCategory(entity.category);
    const rows = rowsByCategory.get(category) ?? [];
    const existing = rows.find((r) => r.name === name);
    const present = existing?.total ?? 0;
    const unbuilt = Math.max(0, expected - present);
    if (unbuilt === 0) continue;
    if (existing) {
      existing.toBuild = unbuilt;
    } else {
      const cap = maxLevelAtTH(name, th);
      const prevCap = th > 1 ? maxLevelAtTH(name, th - 1) : null;
      rows.push({
        id: entity.id,
        name,
        category,
        cap,
        prevCap,
        total: 0,
        maxedCount: 0,
        byLevel: [],
        toBuild: unbuilt,
      });
      rowsByCategory.set(category, rows);
    }
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
