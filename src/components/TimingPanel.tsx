import { CATEGORY_UNLOCK_TH, VillageStats } from "@/lib/gameData";
import { SkipIcon } from "@/components/icons";
import { InProgressUpgrade, VillageExport } from "@/lib/villageExport";
import {
  computeTracks,
  formatDuration,
  itemTrackKey,
  pendingUpgrades,
} from "@/lib/tracks";
import {
  computeBaseSummary,
  computeEquipmentMetric,
  computeSkipSummary,
  computeWallMetric,
  WallStatus,
} from "@/lib/completionMetrics";
import { CompletionCard } from "@/components/timing/CompletionCard";
import { CountBadge } from "@/components/timing/CountBadge";
import { TrackCard } from "@/components/timing/TrackCard";

const BOTTLENECK_THRESHOLD_SECONDS = 5 * 24 * 60 * 60;

function rushColor(seconds: number): string {
  const days = seconds / 86400;
  if (days <= 0) return "text-emerald-600 dark:text-emerald-400";
  if (days < 60) return "text-yellow-600 dark:text-yellow-400";
  if (days <= 100) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function statusClass(status: WallStatus): string {
  if (status === "ahead") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (status === "behind") {
    return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
  }
  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function UpgradeList({ items }: { items: InProgressUpgrade[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((u, i) => (
        <li key={`${u.name}-${i}`} className="flex justify-between gap-3">
          <span className="truncate">
            {u.name} <span className="text-sky-500">L{u.level + 1}</span>
          </span>
          <span className="shrink-0 font-mono text-xs">
            {formatDuration(u.secondsLeft)} left
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TimingPanel({
  builderCount,
  goldPass,
  loading = false,
  stats,
  village,
  skips,
}: {
  builderCount: number;
  goldPass: boolean;
  loading?: boolean;
  stats: VillageStats | null;
  village: VillageExport | null;
  skips: string[];
}) {
  const townHallLevel = stats?.townHallLevel ?? village?.townHallLevel ?? 0;
  const allTracks = computeTracks(
    stats,
    village,
    builderCount,
    goldPass,
    new Set(skips)
  );
  // Hide tracks whose feature isn't unlocked yet (e.g. Pets before TH14).
  const tracks = allTracks.filter(
    (t) =>
      t.key !== "pets" ||
      townHallLevel === 0 ||
      townHallLevel >= CATEGORY_UNLOCK_TH.pet
  );
  const active = tracks.filter((t) => t.levels > 0);
  const activeByFinish = [...active].sort(
    (a, b) => b.finishSeconds - a.finishSeconds
  );
  const slowestTrack = activeByFinish[0] ?? null;
  const runnerUpTrack = activeByFinish[1] ?? null;
  const activeSpread =
    slowestTrack && runnerUpTrack
      ? slowestTrack.finishSeconds - runnerUpTrack.finishSeconds
      : 0;
  const balanced =
    active.length > 1 && activeSpread < BOTTLENECK_THRESHOLD_SECONDS;
  const bottleneck =
    slowestTrack &&
    active.length > 1 &&
    activeSpread >= BOTTLENECK_THRESHOLD_SECONDS
      ? slowestTrack
      : null;
  const builderTrack = tracks.find((t) => t.key === "builder");
  const beginTownHallUpgradeSeconds = builderTrack?.beginTownHallUpgradeSeconds;
  const summary = computeBaseSummary(stats, village);
  const totalSkipped = computeSkipSummary(stats, village, skips);
  const wallMetric = computeWallMetric(village, summary.pctToMax, skips);
  const equipmentMetric =
    townHallLevel === 0 || townHallLevel >= CATEGORY_UNLOCK_TH.equipment
      ? computeEquipmentMetric(stats, skips)
      : null;

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-1">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Town Hall Completion
        </h2>

        {!loading && (stats || village) && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                Maxed
              </p>
              <p
                className="font-mono text-base font-semibold text-zinc-900 dark:text-zinc-100"
                title="Progress through this Town Hall's new upgrades (previous TH cap to current TH cap)"
              >
                {summary.pctToMax}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                Rushed
              </p>
              <p
                className={`font-mono text-base font-semibold ${rushColor(summary.rushedSeconds)}`}
                title="Total upgrade time still owed below the previous Town Hall's caps"
              >
                {summary.rushedSeconds > 0
                  ? formatDuration(summary.rushedSeconds)
                  : "0d 0h"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                Skipped
              </p>
              <p className="inline-flex items-center font-mono text-base font-semibold text-amber-600 dark:text-amber-400">
                {totalSkipped}
                <SkipIcon className="h-4 w-4" />
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <div className="h-8 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-52 rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ) : slowestTrack ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {formatDuration(slowestTrack.finishSeconds)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              until fully maxed
            </span>
            {balanced && (
              <span
                className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                title="The slowest active tracks are within 5 days of each other."
              >
                balanced
              </span>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            {stats || village
              ? "Everything tracked is maxed. 🎉"
              : "Look up a player and import village data to see time-to-max."}
          </p>
        )}

        {!loading && beginTownHallUpgradeSeconds !== undefined && (
          <p
            className="mt-2 text-xs text-zinc-500 dark:text-zinc-400"
            title="Based on Builder work only: start when the remaining non-TH work can fill the other builders during the Town Hall upgrade."
          >
            Begin TH upgrade in:{" "}
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              {beginTownHallUpgradeSeconds === 0
                ? "now"
                : formatDuration(beginTownHallUpgradeSeconds)}
            </span>
          </p>
        )}

        {loading ? (
          <ul className="mt-3 flex flex-col gap-2" aria-label="Loading tracks">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-2 h-3 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tracks.map((t) => (
              <TrackCard
                key={t.key}
                track={t}
                bottleneck={bottleneck?.key === t.key}
                defaultOpen={t.key === "builder" || t.key === "lab"}
              />
            ))}
          </ul>
        )}

        {!loading && (wallMetric || equipmentMetric) && (
          <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            {wallMetric && (
              <CompletionCard
                title="Walls"
                primary={`${wallMetric.pctComplete}%`}
                secondary={`${wallMetric.maxedWalls} / ${wallMetric.totalWalls} maxed`}
              >
                <span className="flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(wallMetric.status)}`}
                  >
                    {wallMetric.status}
                  </span>
                  {wallMetric.catchUpLevels > 0 && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                      {wallMetric.catchUpLevels} catch-up
                    </span>
                  )}
                  {wallMetric.skipped && (
                    <CountBadge
                      count={1}
                      icon={<SkipIcon className="h-3 w-3" />}
                      className="text-amber-600 dark:text-amber-400"
                      title="Walls skipped"
                    />
                  )}
                </span>
              </CompletionCard>
            )}
            {equipmentMetric && (
              <CompletionCard
                title="Hero Equipment"
                primary={`${equipmentMetric.pct}%`}
                secondary={`${equipmentMetric.done} / ${equipmentMetric.total} levels`}
              >
                <span className="flex flex-wrap items-center gap-1">
                  {equipmentMetric.skippedLevels > 0 && (
                    <span className="inline-flex items-center gap-px font-mono text-[11px] text-amber-600 dark:text-amber-400">
                      {equipmentMetric.skippedLevels}
                      <SkipIcon className="h-3 w-3" />
                    </span>
                  )}
                  {equipmentMetric.skippedItems > 0 && (
                    <span className="text-[10px] text-zinc-400">
                      {equipmentMetric.skippedItems} item
                      {equipmentMetric.skippedItems === 1 ? "" : "s"} skipped
                    </span>
                  )}
                </span>
              </CompletionCard>
            )}
          </div>
        )}

        {!loading && stats && !village && (
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            Import village data to include defenses, traps &amp; buildings in the
            Builder track.
          </p>
        )}
      </div>

      {!loading &&
        village &&
        (() => {
          const upgrading = pendingUpgrades(village, stats);
          if (upgrading.length === 0) return null;
          const builders = upgrading.filter(
            (u) => itemTrackKey(u.name) === "builder"
          );
          const labPets = upgrading.filter(
            (u) => itemTrackKey(u.name) !== "builder"
          );
          return (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
              <h3 className="mb-2 text-sm font-semibold text-sky-800 dark:text-sky-300">
                Currently upgrading ({upgrading.length})
              </h3>
              <div className="flex flex-col gap-2 text-sm text-sky-900 dark:text-sky-200">
                {builders.length > 0 && <UpgradeList items={builders} />}
                {builders.length > 0 && labPets.length > 0 && (
                  <div className="border-t border-sky-200/70 dark:border-sky-900" />
                )}
                {labPets.length > 0 && <UpgradeList items={labPets} />}
              </div>
            </div>
          );
        })()}
    </aside>
  );
}
