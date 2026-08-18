import { getEntity, upgradeTime, VillageStats } from "./gameData";
import { VillageExport } from "./villageExport";

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
  goldPass = false
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

  if (stats) {
    for (const g of stats.groups) {
      const t = ARMY_TRACK[g.category];
      if (!t) continue;
      for (const r of g.rows) {
        if (r.thMax === null || r.remaining <= 0) continue;
        const seconds = upgradeTime(r.name, r.level, r.thMax);
        let subKey: string | null = null;
        if (t === "builder") subKey = "hero";
        else if (t === "lab")
          subKey = labSubKey(g.category, getEntity(r.name)?.resource ?? null);
        addWork(t, subKey, seconds, r.remaining);
      }
    }
  }

  if (village) {
    for (const g of village.groups) {
      if (g.category === "helper") continue; // gold-only, no build time
      for (const r of g.rows) {
        if (r.cap === null) continue;
        const cap = r.cap;
        for (const bl of r.byLevel) {
          if (bl.level >= cap) continue;
          addWork(
            "builder",
            g.category,
            upgradeTime(r.name, bl.level, cap) * bl.count,
            (cap - bl.level) * bl.count
          );
        }
      }
    }
    // Replace the current level's full upgrade time with the live in-progress
    // timer: the committed step is fixed (no discount), the rest stays future.
    for (const u of village.inProgress) {
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

  const factor = goldPass ? GOLD_PASS_FACTOR : 1;
  const secondsOf = (b: Bucket): number =>
    Math.max(0, b.disc) * factor + b.fixed;

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
  const labWork = secondsOf(track.lab);
  const petWork = secondsOf(track.pets);
  return [
    {
      key: "builder",
      label: "Builders",
      workSeconds: builderWork,
      finishSeconds: Math.round(builderWork / builders),
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
