import {
  getEntity,
  upgradeTime,
  VillageStats,
} from "./gameData";
import { BuildingRow, InProgressUpgrade, VillageExport } from "./villageExport";
import { buildingSkipCapacity, getSkipCount } from "./skipModel";

// The three parallel "tracks" a player progresses through. Time-to-max for the
// whole base is the slowest (bottleneck) track.
export type TrackKey = "builder" | "lab" | "pets";

/** A sub-grouping of a track's work (e.g. Defenses within the Builders track). */
export interface TrackSub {
  key: string;
  label: string;
  seconds: number;
  levels: number;
  skippedLevels: number;
  /** False when this sub's data source isn't loaded yet (e.g. no village import). */
  available: boolean;
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
  /** Time remaining before the next Town Hall upgrade should begin. */
  beginTownHallUpgradeSeconds?: number;
  /** Duration of the next Town Hall upgrade, after applicable discounts. */
  townHallUpgradeSeconds?: number;
  /** Remaining upgrade levels on this track. */
  levels: number;
  /** Upgrade levels intentionally excluded from this track. */
  skippedLevels: number;
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

/**
 * Which track an item belongs to, by name. Army units map via ARMY_TRACK;
 * everything else (buildings, traps, walls, …) is Builders work.
 */
export function itemTrackKey(name: string): TrackKey {
  const cat = getEntity(name)?.category;
  return (cat && ARMY_TRACK[cat]) || "builder";
}

/**
 * The upgrades still genuinely in progress right now: the export's frozen
 * timers are re-based to the wall clock (finished-since-export ones drop off),
 * and army upgrades the API has already advanced past are excluded. Returned
 * items carry their live remaining seconds.
 */
export function pendingUpgrades(
  village: VillageExport,
  stats: VillageStats | null
): InProgressUpgrade[] {
  const nowSec = Date.now() / 1000;
  const statLevel = new Map<string, number>();
  if (stats) {
    for (const g of stats.groups)
      for (const r of g.rows) statLevel.set(r.name, r.level);
  }
  const out: InProgressUpgrade[] = [];
  for (const u of village.inProgress) {
    const cat = getEntity(u.name)?.category;
    if (cat && ARMY_TRACK[cat]) {
      const lvl = statLevel.get(u.name);
      if (lvl !== undefined && lvl !== u.level) continue; // API already advanced
    }
    const left =
      u.finishesAt !== null ? u.finishesAt - nowSec : u.secondsLeft;
    if (left <= 0) continue; // finished since the export
    out.push({ ...u, secondsLeft: Math.max(0, Math.round(left)) });
  }
  return out.sort((a, b) => a.secondsLeft - b.secondsLeft);
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
    skippedLevels: number;
  }
  const mk = (): Bucket => ({ disc: 0, fixed: 0, levels: 0, skippedLevels: 0 });
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
  const addSkipped = (t: TrackKey, subKey: string | null, levels: number) => {
    if (levels <= 0) return;
    track[t].skippedLevels += levels;
    if (subKey) {
      const b = subBucket(t, subKey);
      b.skippedLevels += levels;
    }
  };
  // Swap a live upgrade's committed step out of the discountable pool and into
  // the fixed pool (its real remaining timer): the started step can't be sped
  // up by the Gold Pass, and its actual time-left beats the full step time.
  const applyInProgress = (
    t: TrackKey,
    subKey: string | null,
    fullStep: number,
    secondsLeft: number
  ) => {
    track[t].disc -= fullStep;
    track[t].fixed += secondsLeft;
    if (subKey) {
      const b = subBucket(t, subKey);
      b.disc -= fullStep;
      b.fixed += secondsLeft;
    }
  };
  const factor = goldPass ? GOLD_PASS_FACTOR : 1;
  const secondsOf = (b: Bucket): number =>
    Math.max(0, b.disc) * factor + b.fixed;
  let builderCriticalSeconds = 0;
  let townHallUpgradeSeconds = 0;
  const recordBuilderChain = (disc: number, fixed = 0) => {
    builderCriticalSeconds = Math.max(
      builderCriticalSeconds,
      Math.max(0, disc) * factor + fixed
    );
  };
  const inProgressKey = (name: string, level: number) => `${name}\0${level}`;
  const includedStepCounts = new Map<string, number>();
  const recordIncludedSteps = (
    name: string,
    fromLevel: number,
    toLevel: number,
    count = 1
  ) => {
    for (let level = fromLevel; level < toLevel; level++) {
      const key = inProgressKey(name, level);
      includedStepCounts.set(key, (includedStepCounts.get(key) ?? 0) + count);
    }
  };
  const consumeIncludedStep = (name: string, level: number): boolean => {
    const key = inProgressKey(name, level);
    const count = includedStepCounts.get(key) ?? 0;
    if (count <= 0) return false;
    includedStepCounts.set(key, count - 1);
    return true;
  };
  const rangeAfterSkipped = (
    level: number,
    cap: number,
    prevCap: number | null,
    skippedLevels: number
  ) => {
    const catchUp = Math.max(0, (prevCap ?? 0) - level);
    const skippedCatchUp = Math.min(skippedLevels, catchUp);
    const skippedTop = Math.max(0, skippedLevels - skippedCatchUp);
    return {
      from: Math.min(cap, level + skippedCatchUp),
      to: Math.max(level + skippedCatchUp, cap - skippedTop),
    };
  };
  const addTimedChain = (
    t: TrackKey,
    subKey: string | null,
    name: string,
    fromLevel: number,
    toLevel: number,
    count = 1
  ) => {
    if (toLevel <= fromLevel || count <= 0) return;
    const seconds = upgradeTime(name, fromLevel, toLevel);
    addWork(t, subKey, seconds * count, (toLevel - fromLevel) * count);
    recordIncludedSteps(name, fromLevel, toLevel, count);
    if (t === "builder") recordBuilderChain(seconds);
  };
  const addBuildingWork = (
    row: BuildingRow,
    subKey: string | null,
    skippedLevels: number
  ) => {
    if (row.cap === null) return;
    const cap = row.cap;
    const prev = row.prevCap ?? 0;
    const instances: { from: number; to: number }[] = [];
    for (const bl of row.byLevel) {
      for (let i = 0; i < bl.count; i++) {
        if (bl.level < cap) instances.push({ from: bl.level, to: cap });
      }
    }
    for (let i = 0; i < (row.toBuild ?? 0); i++) {
      instances.push({ from: 0, to: cap });
    }

    let remainingSkips = skippedLevels;
    for (const instance of instances) {
      if (remainingSkips <= 0) break;
      const use = Math.min(remainingSkips, Math.max(0, prev - instance.from));
      instance.from += use;
      remainingSkips -= use;
    }
    for (const instance of instances) {
      if (remainingSkips <= 0) break;
      const use = Math.min(remainingSkips, Math.max(0, instance.to - instance.from));
      instance.to -= use;
      remainingSkips -= use;
    }

    for (const instance of instances) {
      addTimedChain("builder", subKey, row.name, instance.from, instance.to);
    }
  };

  if (stats) {
    for (const g of stats.groups) {
      const t = ARMY_TRACK[g.category];
      if (!t) continue;
      for (const r of g.rows) {
        if (r.thMax === null || r.remaining <= 0) continue;
        let subKey: string | null = null;
        if (t === "builder") subKey = "hero";
        else if (t === "lab")
          subKey = labSubKey(g.category, getEntity(r.name)?.resource ?? null);
        const skippedLevels = getSkipCount(skips, `army:${r.name}`, r.remaining);
        addSkipped(t, subKey, skippedLevels);
        if (skippedLevels >= r.remaining) continue;
        const { from, to } = rangeAfterSkipped(
          r.level,
          r.thMax,
          r.prevThMax,
          skippedLevels
        );
        addTimedChain(t, subKey, r.name, from, to);
      }
    }
  }

  if (village) {
    for (const g of village.groups) {
      if (g.category === "helper") continue; // gold-only, no build time
      for (const r of g.rows) {
        if (r.cap === null) continue;
        const category = getEntity(r.name)?.category;
        if (category === "wall") continue; // instant, tracked separately below.
        const subKey = builderSubForCategory(category ?? g.category);
        const maxSkips = buildingSkipCapacity(r);
        const skippedLevels = getSkipCount(skips, `building:${r.name}`, maxSkips);
        addSkipped("builder", subKey, skippedLevels);
        addBuildingWork(r, subKey, skippedLevels);
      }
    }

    // The Town Hall reads as maxed at its current level (its level *is* the TH
    // number), so the loop above skips it. Upgrading to the next Town Hall is
    // still the final Builders step, so add that transition here as one level.
    const townHallSkipped = getSkipCount(skips, "building:Town Hall", 1);
    addSkipped("builder", "village", townHallSkipped);
    if (townHallSkipped === 0) {
      const thStep = upgradeTime(
        "Town Hall",
        village.townHallLevel,
        village.townHallLevel + 1
      );
      if (thStep > 0) {
        recordBuilderChain(thStep);
        townHallUpgradeSeconds = thStep * factor;
        addWork("builder", "village", thStep, 1);
      }
    }

    // Replace each live upgrade's current step with its REAL remaining timer,
    // recomputed against the wall clock (the export froze secondsLeft at its
    // timestamp). A finished-since-export timer contributes 0, so it no longer
    // inflates the track. Building timers adjust the Builders track; army timers
    // adjust whichever track the API-derived work landed on.
    const nowSec = Date.now() / 1000;
    const statLevel = new Map<string, number>();
    if (stats) {
      for (const g of stats.groups)
        for (const r of g.rows) statLevel.set(r.name, r.level);
    }
    for (const u of village.inProgress) {
      const cat = getEntity(u.name)?.category;
      if (!cat) continue;
      const fullStep = upgradeTime(u.name, u.level, u.level + 1);
      const left =
        u.finishesAt !== null
          ? Math.max(0, u.finishesAt - nowSec)
          : u.secondsLeft;
      const armyTrack = ARMY_TRACK[cat];
      if (armyTrack) {
        // Only adjust army work the stats loop actually added.
        if (!stats || !consumeIncludedStep(u.name, u.level)) continue;
        // If the API level already moved past this step, the upgrade completed
        // and is fully reflected in stats — don't double-remove it.
        const lvl = statLevel.get(u.name);
        if (lvl !== undefined && lvl !== u.level) continue;
        const subKey =
          armyTrack === "lab"
            ? labSubKey(cat, getEntity(u.name)?.resource ?? null)
            : armyTrack === "builder"
              ? "hero"
              : null; // pets have no sub-group
        applyInProgress(armyTrack, subKey, fullStep, left);
      } else {
        if (!consumeIncludedStep(u.name, u.level)) continue;
        const subKey = builderSubForCategory(cat);
        if (!subKey) continue; // helper (gold-only, no build time)
        applyInProgress("builder", subKey, fullStep, left);
      }
    }
  }

  // Always list every sub-group (even maxed/0 or not-yet-loaded). Subs whose
  // data source isn't loaded (heroes need the army lookup, buildings need the
  // export) are flagged unavailable so the UI can prompt for an import.
  const orderedSubs = (
    t: TrackKey,
    order: { key: string; label: string }[],
    available: (key: string) => boolean
  ): TrackSub[] =>
    order.map(({ key, label }) => {
      const b = subs[t].get(key);
      return {
        key,
        label,
        seconds: b ? secondsOf(b) : 0,
        levels: b?.levels ?? 0,
        skippedLevels: b?.skippedLevels ?? 0,
        available: available(key),
      };
    });

  const hasArmy = stats !== null;
  const hasVillage = village !== null;
  const builders = Math.max(1, builderCount);
  const builderWork = secondsOf(track.builder);
  const distributedBuilderFinish = Math.round(builderWork / builders);
  const builderCriticalFinish = Math.round(builderCriticalSeconds);
  const beginTownHallUpgradeSeconds =
    townHallUpgradeSeconds > 0
      ? Math.max(
          0,
          Math.round((builderWork - builders * townHallUpgradeSeconds) / builders)
        )
      : undefined;
  const labWork = secondsOf(track.lab);
  const petWork = secondsOf(track.pets);
  return [
    {
      key: "builder",
      label: "Builders",
      workSeconds: builderWork,
      finishSeconds: Math.max(distributedBuilderFinish, builderCriticalFinish),
      criticalPathSeconds: builderCriticalFinish,
      beginTownHallUpgradeSeconds,
      townHallUpgradeSeconds,
      levels: track.builder.levels,
      skippedLevels: track.builder.skippedLevels,
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
      skippedLevels: track.lab.skippedLevels,
      parallel: 1,
      subs: orderedSubs("lab", LAB_SUB_ORDER, () => hasArmy),
    },
    {
      key: "pets",
      label: "Pets",
      workSeconds: petWork,
      finishSeconds: petWork,
      levels: track.pets.levels,
      skippedLevels: track.pets.skippedLevels,
      parallel: 1,
      subs: [],
    },
  ];
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
