import { upgradeTime, VillageStats } from "./gameData";
import { VillageExport } from "./villageExport";

// The three parallel "tracks" a player progresses through. Time-to-max for the
// whole base is the slowest (bottleneck) track.
export type TrackKey = "builder" | "lab" | "pets";

export interface Track {
  key: TrackKey;
  label: string;
  /** Total remaining upgrade seconds of work on this track. */
  workSeconds: number;
  /** Wall-clock estimate: builder work is shared across builders. */
  finishSeconds: number;
  /** Remaining upgrade levels on this track. */
  levels: number;
  /** How many workers share the track (builders for Builder, else 1). */
  parallel: number;
}

// Army categories (from the API) map onto tracks. Buildings/traps (from the
// export) are all Builder work except helpers, which cost gold but no time.
const ARMY_TRACK: Record<string, TrackKey> = {
  hero: "builder",
  troop: "lab",
  spell: "lab",
  siege: "lab",
  pet: "pets",
};

/** Compute remaining work per track from army (API) + buildings (export). */
export function computeTracks(
  stats: VillageStats | null,
  village: VillageExport | null,
  builderCount: number
): Track[] {
  const sec: Record<TrackKey, number> = { builder: 0, lab: 0, pets: 0 };
  const lv: Record<TrackKey, number> = { builder: 0, lab: 0, pets: 0 };

  if (stats) {
    for (const g of stats.groups) {
      const track = ARMY_TRACK[g.category];
      if (!track) continue;
      for (const r of g.rows) {
        if (r.thMax === null || r.remaining <= 0) continue;
        sec[track] += upgradeTime(r.name, r.level, r.thMax);
        lv[track] += r.remaining;
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
          sec.builder += upgradeTime(r.name, bl.level, cap) * bl.count;
          lv.builder += (cap - bl.level) * bl.count;
        }
      }
    }
  }

  const builders = Math.max(1, builderCount);
  return [
    {
      key: "builder",
      label: "Builder",
      workSeconds: sec.builder,
      finishSeconds: Math.round(sec.builder / builders),
      levels: lv.builder,
      parallel: builders,
    },
    {
      key: "lab",
      label: "Laboratory",
      workSeconds: sec.lab,
      finishSeconds: sec.lab,
      levels: lv.lab,
      parallel: 1,
    },
    {
      key: "pets",
      label: "Pets",
      workSeconds: sec.pets,
      finishSeconds: sec.pets,
      levels: lv.pets,
      parallel: 1,
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
