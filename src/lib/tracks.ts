import {
  buildingRosterAtTH,
  getEntity,
  maxLevelAtTH,
  upgradeTime,
  VillageStats,
} from "./gameData";
import { BuildingRow, buildingProgress, VillageExport } from "./villageExport";

// Walls are treated as one flat block of "levels" in the % (weighted only by
// how many of your walls are at the current cap), rather than tracking each
// wall segment's level.
const WALL_BAND_LEVELS = 15;

// The three parallel "tracks" a player progresses through. Time-to-max for the
// whole base is the slowest (bottleneck) track.
export type TrackKey = "builder" | "lab" | "pets";

/** A sub-grouping of a track's work (e.g. Defenses within the Builders track). */
export interface TrackSub {
  key: string;
  label: string;
  seconds: number;
  levels: number;
}

export interface Track {
  key: TrackKey;
  label: string;
  /** Total remaining upgrade seconds of work on this track. */
  workSeconds: number;
  /** Wall-clock estimate: builder work is shared across builders. */
  finishSeconds: number;
  /** Longest sequential item chain, used as a floor for parallel tracks. */
  criticalPathSeconds?: number;
  /** Remaining upgrade levels on this track. */
  levels: number;
  /** How many workers share the track (builders for Builders, else 1). */
  parallel: number;
  subs: TrackSub[];
}

// Army categories (from the API) map onto tracks. Buildings/traps (from the
// export) are all Builders work except helpers, which cost gold but no time.
const ARMY_TRACK: Record<string, TrackKey> = {
  hero: "builder",
  troop: "lab",
  spell: "lab",
  siege: "lab",
  pet: "pets",
};

// Ordered sub-group definitions per track.
const BUILDER_SUB_ORDER: { key: string; label: string }[] = [
  { key: "hero", label: "Heroes" },
  { key: "defense", label: "Defenses" },
  { key: "trap", label: "Traps" },
  { key: "resource", label: "Resources" },
  { key: "army", label: "Army Buildings" },
  { key: "village", label: "Village" },
];
const LAB_SUB_ORDER: { key: string; label: string }[] = [
  { key: "el-troop", label: "Troops - Elixir" },
  { key: "de-troop", label: "Troops - Dark Elixir" },
  { key: "el-spell", label: "Spells - Elixir" },
  { key: "de-spell", label: "Spells - Dark Elixir" },
  { key: "siege", label: "Siege Machines" },
];

function labSubKey(category: string, resource: string | null): string {
  if (category === "siege") return "siege";
  const dark = resource === "Dark Elixir";
  if (category === "troop") return dark ? "de-troop" : "el-troop";
  return dark ? "de-spell" : "el-spell"; // spell
}

// Fold a raw building category (from the entity lookup) into the Builders
// sub-group it belongs to, matching how the export groups them.
function builderSubForCategory(category: string): string | null {
  if (
    category === "defense" ||
    category === "trap" ||
    category === "resource" ||
    category === "army"
  ) {
    return category;
  }
  if (category === "helper") return null; // gold-only, no build time
  return "village"; // town hall, walls, builder/helper huts, etc.
}

// Full Gold Pass gives up to 20% off both Builder Boost (Builders + Pets) and
// Research Boost (Laboratory) time. We model the toggle as the full discount.
const GOLD_PASS_FACTOR = 0.8;

/** Compute remaining work per track (with sub-breakdowns) from army + buildings. */
export function computeTracks(
  stats: VillageStats | null,
  village: VillageExport | null,
  builderCount: number,
  goldPass = false,
  skips: Set<string> = new Set()
): Track[] {
  // Each bucket splits work into `disc` (future upgrades, eligible for the Gold
  // Pass discount) and `fixed` (live in-progress timers, already committed).
  interface Bucket {
    disc: number;
    fixed: number;
    levels: number;
  }
  const mk = (): Bucket => ({ disc: 0, fixed: 0, levels: 0 });
  const track: Record<TrackKey, Bucket> = { builder: mk(), lab: mk(), pets: mk() };
  const subs: Record<TrackKey, Map<string, Bucket>> = {
    builder: new Map(),
    lab: new Map(),
    pets: new Map(),
  };
  const subBucket = (t: TrackKey, key: string): Bucket => {
    let b = subs[t].get(key);
    if (!b) {
      b = mk();
      subs[t].set(key, b);
    }
    return b;
  };
  const addWork = (
    t: TrackKey,
    subKey: string | null,
    seconds: number,
    levels: number
  ) => {
    track[t].disc += seconds;
    track[t].levels += levels;
    if (subKey) {
      const b = subBucket(t, subKey);
      b.disc += seconds;
      b.levels += levels;
    }
  };
  const factor = goldPass ? GOLD_PASS_FACTOR : 1;
  const secondsOf = (b: Bucket): number =>
    Math.max(0, b.disc) * factor + b.fixed;
  let builderCriticalSeconds = 0;
  const recordBuilderChain = (disc: number, fixed = 0) => {
    builderCriticalSeconds = Math.max(
      builderCriticalSeconds,
      Math.max(0, disc) * factor + fixed
    );
  };
  const inProgressKey = (name: string, level: number) => `${name}\0${level}`;

  if (stats) {
    for (const g of stats.groups) {
      const t = ARMY_TRACK[g.category];
      if (!t) continue;
      for (const r of g.rows) {
        if (skips.has(`army:${r.name}`)) continue;
        if (r.thMax === null || r.remaining <= 0) continue;
        const seconds = upgradeTime(r.name, r.level, r.thMax);
        let subKey: string | null = null;
        if (t === "builder") subKey = "hero";
        else if (t === "lab")
          subKey = labSubKey(g.category, getEntity(r.name)?.resource ?? null);
        addWork(t, subKey, seconds, r.remaining);
        if (t === "builder") recordBuilderChain(seconds);
      }
    }
  }

  if (village) {
    const inProgressByNameLevel = new Map<string, number[]>();
    for (const u of village.inProgress) {
      if (skips.has(`building:${u.name}`)) continue;
      const key = inProgressKey(u.name, u.level);
      const timers = inProgressByNameLevel.get(key) ?? [];
      timers.push(u.secondsLeft);
      inProgressByNameLevel.set(key, timers);
    }

    for (const g of village.groups) {
      if (g.category === "helper") continue; // gold-only, no build time
      for (const r of g.rows) {
        if (skips.has(`building:${r.name}`)) continue;
        if (r.cap === null) continue;
        const cap = r.cap;
        for (const bl of r.byLevel) {
          if (bl.level >= cap) continue;
          const chainSeconds = upgradeTime(r.name, bl.level, cap);
          const liveTimers = inProgressByNameLevel.get(
            inProgressKey(r.name, bl.level)
          );
          const liveCount = Math.min(bl.count, liveTimers?.length ?? 0);
          for (let i = 0; i < liveCount; i++) {
            recordBuilderChain(
              upgradeTime(r.name, bl.level + 1, cap),
              liveTimers?.[i] ?? 0
            );
          }
          if (bl.count > liveCount) recordBuilderChain(chainSeconds);
          addWork(
            "builder",
            g.category,
            chainSeconds * bl.count,
            (cap - bl.level) * bl.count
          );
        }
        // Copies this TH grants that aren't placed yet: built from scratch
        // (placement is instant, so 0 -> cap is the full construction time).
        const toBuild = r.toBuild ?? 0;
        if (toBuild > 0) {
          const chainSeconds = upgradeTime(r.name, 0, cap);
          recordBuilderChain(chainSeconds);
          addWork(
            "builder",
            g.category,
            chainSeconds * toBuild,
            cap * toBuild
          );
        }
      }
    }
    // Replace the current level's full upgrade time with the live in-progress
    // timer: the committed step is fixed (no discount), the rest stays future.
    for (const u of village.inProgress) {
      if (skips.has(`building:${u.name}`)) continue;
      const cat = getEntity(u.name)?.category;
      const subKey = cat ? builderSubForCategory(cat) : null;
      if (!subKey) continue;
      const fullStep = upgradeTime(u.name, u.level, u.level + 1);
      track.builder.disc -= fullStep;
      track.builder.fixed += u.secondsLeft;
      const b = subBucket("builder", subKey);
      b.disc -= fullStep;
      b.fixed += u.secondsLeft;
    }
  }

  // Show every applicable sub-group (even maxed/0), but only ones whose data
  // source is loaded: heroes need the army lookup, buildings need the export.
  const orderedSubs = (
    t: TrackKey,
    order: { key: string; label: string }[],
    available: (key: string) => boolean
  ): TrackSub[] =>
    order
      .filter(({ key }) => available(key))
      .map(({ key, label }) => {
        const b = subs[t].get(key);
        return {
          key,
          label,
          seconds: b ? secondsOf(b) : 0,
          levels: b?.levels ?? 0,
        };
      });

  const hasArmy = stats !== null;
  const hasVillage = village !== null;
  const builders = Math.max(1, builderCount);
  const builderWork = secondsOf(track.builder);
  const distributedBuilderFinish = Math.round(builderWork / builders);
  const builderCriticalFinish = Math.round(builderCriticalSeconds);
  const labWork = secondsOf(track.lab);
  const petWork = secondsOf(track.pets);
  return [
    {
      key: "builder",
      label: "Builders",
      workSeconds: builderWork,
      finishSeconds: Math.max(distributedBuilderFinish, builderCriticalFinish),
      criticalPathSeconds: builderCriticalFinish,
      levels: track.builder.levels,
      parallel: builders,
      subs: orderedSubs("builder", BUILDER_SUB_ORDER, (key) =>
        key === "hero" ? hasArmy : hasVillage
      ),
    },
    {
      key: "lab",
      label: "Laboratory",
      workSeconds: labWork,
      finishSeconds: labWork,
      levels: track.lab.levels,
      parallel: 1,
      subs: orderedSubs("lab", LAB_SUB_ORDER, () => hasArmy),
    },
    {
      key: "pets",
      label: "Pets",
      workSeconds: petWork,
      finishSeconds: petWork,
      levels: track.pets.levels,
      parallel: 1,
      subs: [],
    },
  ];
}

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
 *     cap and the current TH cap (so a fresh TH reads ~0% and a maxed one 100%).
 *     Brand-new items (a hero/troop first unlocked this TH, a newly placed
 *     building) count their whole 0 -> cap range, including being built.
 *   - "rushed" is the upgrade time still owed *below* the previous TH cap — work
 *     you skipped past by advancing early. The two bands never overlap.
 * The Town Hall itself is excluded (its next-level upgrade is the transition to
 * the next TH, tracked separately, not part of maxing the current one).
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
      if (g.category === "equipment") continue; // ore-upgraded, not in the TH band
      for (const r of g.rows) {
        if (r.thMax === null) continue;
        const prev = r.prevThMax ?? 0; // new-this-TH items start their band at 0
        bandTotal += Math.max(0, r.thMax - prev);
        bandDone += Math.min(Math.max(0, r.thMax - prev), Math.max(0, r.level - prev));
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
          wallRow = r; // flat-weighted below
          continue;
        }
        if (r.cap === null) continue; // untracked (B.O.B, Helper Hut, …)
        // The Town Hall's next level is the next-TH transition, not current work.
        if (cat === "town hall") continue;
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

    // Buildings this TH grants that you haven't placed yet (a new Eagle, an
    // extra Cannon, …). Each is built from scratch, so its full 0 -> cap range
    // is new work toward maxing (never counted as rushed).
    for (const [name, expected] of buildingRosterAtTH(th)) {
      const cat = getEntity(name)?.category;
      if (cat !== "defense" && cat !== "resource" && cat !== "army") continue;
      const unbuilt = Math.max(0, expected - (presentByName.get(name) ?? 0));
      if (unbuilt === 0) continue;
      const cap = maxLevelAtTH(name, th);
      if (cap !== null) bandTotal += cap * unbuilt;
    }

    // Walls: a flat block of "levels" weighted only by how many of your walls
    // are already at the current cap (individual wall levels aren't tracked,
    // and walls never count toward rushed time).
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

/** Format a duration in seconds as a compact "Xd Yh" / "Yh Zm" / "Zm" string. */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
