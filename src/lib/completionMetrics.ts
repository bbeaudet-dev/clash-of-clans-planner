import {
  buildingRosterAtTH,
  getEntity,
  maxLevelAtTH,
  upgradeTime,
  VillageStats,
} from "./gameData";
import { BuildingRow, buildingProgress, VillageExport } from "./villageExport";
import { buildingSkipCapacity, getSkipCount } from "./skipModel";

// Walls are treated as one flat block of "levels" in the % (weighted only by
// how many of your walls are at the current cap), rather than tracking each
// wall segment's level.
const WALL_BAND_LEVELS = 15;

export interface BaseSummary {
  /** New-band levels completed this TH (previous TH cap -> current TH cap). */
  bandDone: number;
  /** Total new-band levels this TH unlocked, across everything. */
  bandTotal: number;
  /** Progress through this TH's new band, 0..100 (100 only when truly done). */
  pctToMax: number;
  /** Upgrade time still owed below the *previous* TH caps (how "rushed" the base is). */
  rushedSeconds: number;
}

/**
 * Overall base progress, scoped to the *current* Town Hall's work:
 *   - "% to max" measures only the new band of levels between the previous TH
 *     cap and the current TH cap.
 *   - "rushed" is the upgrade time still owed *below* the previous TH cap.
 * The Town Hall itself is excluded; its next-level upgrade is the next TH.
 */
export function computeBaseSummary(
  stats: VillageStats | null,
  village: VillageExport | null
): BaseSummary {
  let bandDone = 0;
  let bandTotal = 0;
  let rushedSeconds = 0;

  if (stats) {
    for (const g of stats.groups) {
      if (g.category === "equipment") continue;
      for (const r of g.rows) {
        if (r.thMax === null) continue;
        const prev = r.prevThMax ?? 0;
        const band = Math.max(0, r.thMax - prev);
        bandTotal += band;
        bandDone += Math.min(band, Math.max(0, r.level - prev));
        if (r.level < prev) {
          rushedSeconds += upgradeTime(r.name, r.level, prev);
        }
      }
    }
  }

  if (village) {
    const th = village.townHallLevel;
    const presentByName = new Map<string, number>();
    let wallRow: BuildingRow | null = null;

    for (const g of village.groups) {
      for (const r of g.rows) {
        presentByName.set(r.name, r.total);
        const cat = getEntity(r.name)?.category;
        if (cat === "wall") {
          wallRow = r;
          continue;
        }
        if (r.cap === null || cat === "town hall") continue;
        const progress = buildingProgress(r);
        bandTotal += progress.bandTotal;
        bandDone += progress.doneInBand;
        const prev = r.prevCap ?? 0;
        for (const bl of r.byLevel) {
          if (bl.level < prev) {
            rushedSeconds += upgradeTime(r.name, bl.level, prev) * bl.count;
          }
        }
      }
    }

    for (const [name, expected] of buildingRosterAtTH(th)) {
      const cat = getEntity(name)?.category;
      if (cat !== "defense" && cat !== "resource" && cat !== "army") continue;
      const unbuilt = Math.max(0, expected - (presentByName.get(name) ?? 0));
      if (unbuilt === 0) continue;
      const cap = maxLevelAtTH(name, th);
      if (cap !== null) bandTotal += cap * unbuilt;
    }

    if (wallRow) {
      const wallCap = maxLevelAtTH("Wall", th);
      const totalWalls = wallRow.total;
      const maxedWalls =
        wallCap === null
          ? 0
          : wallRow.byLevel
              .filter((l) => l.level >= wallCap)
              .reduce((s, l) => s + l.count, 0);
      bandTotal += WALL_BAND_LEVELS;
      bandDone +=
        totalWalls > 0 ? WALL_BAND_LEVELS * (maxedWalls / totalWalls) : 0;
    }
  }

  const pctToMax =
    bandTotal === 0
      ? 0
      : bandDone >= bandTotal
        ? 100
        : Math.min(99, Math.round((bandDone / bandTotal) * 100));

  return { bandDone, bandTotal, pctToMax, rushedSeconds };
}

export function computeSkipSummary(
  stats: VillageStats | null,
  village: VillageExport | null,
  skips: Iterable<string>
): number {
  let total = 0;
  if (stats) {
    for (const g of stats.groups) {
      for (const r of g.rows) {
        const skipped = getSkipCount(skips, `army:${r.name}`, r.remaining);
        if (skipped <= 0) continue;
        total += g.category === "equipment" ? 1 : skipped;
      }
    }
  }
  if (village) {
    for (const g of village.groups) {
      for (const r of g.rows) {
        const maxSkips = buildingSkipCapacity(r);
        const skipped = getSkipCount(skips, `building:${r.name}`, maxSkips);
        if (skipped <= 0) continue;
        total += getEntity(r.name)?.category === "wall" ? 1 : skipped;
      }
    }
  }
  return total;
}

export type WallStatus = "ahead" | "on-track" | "behind";

export interface WallMetric {
  pctComplete: number;
  totalWalls: number;
  maxedWalls: number;
  catchUpLevels: number;
  status: WallStatus;
  skipped: boolean;
}

export function computeWallMetric(
  village: VillageExport | null,
  pctToMax: number,
  skips: Iterable<string> = []
): WallMetric | null {
  if (!village) return null;
  const wallRow =
    village.groups
      .flatMap((g) => g.rows)
      .find((r) => getEntity(r.name)?.category === "wall") ?? null;
  if (!wallRow) return null;

  const wallCap = maxLevelAtTH("Wall", village.townHallLevel);
  const totalWalls = wallRow.total;
  const maxedWalls =
    wallCap === null
      ? 0
      : wallRow.byLevel
          .filter((l) => l.level >= wallCap)
          .reduce((s, l) => s + l.count, 0);
  const pctComplete =
    totalWalls > 0 ? Math.round((maxedWalls / totalWalls) * 100) : 0;
  const prevWallCap =
    wallRow.prevCap ?? maxLevelAtTH("Wall", village.townHallLevel - 1) ?? 0;
  const catchUpLevels = wallRow.byLevel.reduce(
    (sum, l) => sum + Math.max(0, prevWallCap - l.level) * l.count,
    0
  );
  const delta = pctComplete - pctToMax;
  const status: WallStatus =
    Math.abs(delta) <= 15 ? "on-track" : delta > 0 ? "ahead" : "behind";

  return {
    pctComplete,
    totalWalls,
    maxedWalls,
    catchUpLevels,
    status,
    skipped: getSkipCount(skips, `building:${wallRow.name}`, 1) > 0,
  };
}

export interface EquipmentMetric {
  done: number;
  total: number;
  pct: number;
  skippedLevels: number;
  skippedItems: number;
}

export function computeEquipmentMetric(
  stats: VillageStats | null,
  skips: Iterable<string>
): EquipmentMetric | null {
  const group = stats?.groups.find((g) => g.category === "equipment") ?? null;
  if (!group) return null;

  let done = 0;
  let total = 0;
  let skippedLevels = 0;
  let skippedItems = 0;
  for (const r of group.rows) {
    const cap = r.thMax ?? r.gameMax;
    const skipped = getSkipCount(skips, `army:${r.name}`, r.remaining);
    if (skipped > 0) skippedItems++;
    skippedLevels += skipped;
    const adjustedCap = Math.max(0, cap - skipped);
    total += adjustedCap;
    done += Math.min(r.level, adjustedCap);
  }

  return {
    done,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    skippedLevels,
    skippedItems,
  };
}
