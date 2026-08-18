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

/** Compute remaining work per track (with sub-breakdowns) from army + buildings. */
export function computeTracks(
  stats: VillageStats | null,
  village: VillageExport | null,
  builderCount: number
): Track[] {
  const sec: Record<TrackKey, number> = { builder: 0, lab: 0, pets: 0 };
  const lv: Record<TrackKey, number> = { builder: 0, lab: 0, pets: 0 };
  // Per-track sub accumulation: subKey -> { seconds, levels }.
  const subs: Record<TrackKey, Map<string, { seconds: number; levels: number }>> = {
    builder: new Map(),
    lab: new Map(),
    pets: new Map(),
  };
  const addSub = (
    track: TrackKey,
    key: string,
    seconds: number,
    levels: number
  ) => {
    const cur = subs[track].get(key) ?? { seconds: 0, levels: 0 };
    cur.seconds += seconds;
    cur.levels += levels;
    subs[track].set(key, cur);
  };

  if (stats) {
    for (const g of stats.groups) {
      const track = ARMY_TRACK[g.category];
      if (!track) continue;
      for (const r of g.rows) {
        if (r.thMax === null || r.remaining <= 0) continue;
        const seconds = upgradeTime(r.name, r.level, r.thMax);
        sec[track] += seconds;
        lv[track] += r.remaining;
        if (track === "builder") {
          addSub("builder", "hero", seconds, r.remaining);
        } else if (track === "lab") {
          const resource = getEntity(r.name)?.resource ?? null;
          addSub("lab", labSubKey(g.category, resource), seconds, r.remaining);
        }
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
          const seconds = upgradeTime(r.name, bl.level, cap) * bl.count;
          const levels = (cap - bl.level) * bl.count;
          sec.builder += seconds;
          lv.builder += levels;
          addSub("builder", g.category, seconds, levels);
        }
      }
    }
  }

  // Show every applicable sub-group (even maxed/0), but only ones whose data
  // source is loaded: heroes need the army lookup, buildings need the export.
  const orderedSubs = (
    track: TrackKey,
    order: { key: string; label: string }[],
    available: (key: string) => boolean
  ): TrackSub[] =>
    order
      .filter(({ key }) => available(key))
      .map(({ key, label }) => {
        const s = subs[track].get(key);
        return { key, label, seconds: s?.seconds ?? 0, levels: s?.levels ?? 0 };
      });

  const hasArmy = stats !== null;
  const hasVillage = village !== null;
  const builders = Math.max(1, builderCount);
  return [
    {
      key: "builder",
      label: "Builders",
      workSeconds: sec.builder,
      finishSeconds: Math.round(sec.builder / builders),
      levels: lv.builder,
      parallel: builders,
      subs: orderedSubs("builder", BUILDER_SUB_ORDER, (key) =>
        key === "hero" ? hasArmy : hasVillage
      ),
    },
    {
      key: "lab",
      label: "Laboratory",
      workSeconds: sec.lab,
      finishSeconds: sec.lab,
      levels: lv.lab,
      parallel: 1,
      subs: orderedSubs("lab", LAB_SUB_ORDER, () => hasArmy),
    },
    {
      key: "pets",
      label: "Pets",
      workSeconds: sec.pets,
      finishSeconds: sec.pets,
      levels: lv.pets,
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
