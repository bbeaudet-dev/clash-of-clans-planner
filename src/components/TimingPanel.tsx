import { CATEGORY_UNLOCK_TH, VillageStats } from "@/lib/gameData";
import { InProgressUpgrade, VillageExport } from "@/lib/villageExport";
import {
  computeTracks,
  formatDuration,
  itemTrackKey,
  pendingUpgrades,
  Track,
} from "@/lib/tracks";

const MAX_BUILDERS = 7;
const BOTTLENECK_THRESHOLD_SECONDS = 5 * 24 * 60 * 60;

function finishDate(seconds: number): string {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function TrackCard({
  track,
  bottleneck,
  defaultOpen = false,
}: {
  track: Track;
  bottleneck: boolean;
  defaultOpen?: boolean;
}) {
  const done = track.levels === 0;
  const expandable = !done && track.subs.length > 0;
  const distributedFinish =
    track.parallel > 1
      ? Math.round(track.workSeconds / track.parallel)
      : track.finishSeconds;
  const criticalPath = track.criticalPathSeconds ?? 0;
  const criticalLimited = criticalPath > distributedFinish;

  const header = (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {expandable && <span className="mr-1 text-zinc-400 transition-transform group-open:rotate-90 inline-block">›</span>}
          {track.label}
          {bottleneck && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              bottleneck
            </span>
          )}
        </span>
        <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {done ? "maxed" : formatDuration(track.finishSeconds)}
        </span>
      </div>
      {!done && (
        <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>
            {track.levels} levels
            {track.parallel > 1
              ? ` · ${formatDuration(track.workSeconds)} ÷ ${track.parallel}`
              : ""}
            {criticalLimited ? ` · max item ${formatDuration(criticalPath)}` : ""}
          </span>
          <span>done ~ {finishDate(track.finishSeconds)}</span>
        </div>
      )}
    </>
  );

  const cardClass = `rounded-lg border p-3 ${
    bottleneck
      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
  }`;

  if (!expandable) {
    return (
      <li className={cardClass}>{header}</li>
    );
  }

  return (
    <li>
      <details open={defaultOpen} className={`group ${cardClass}`}>
        <summary className="cursor-pointer list-none">{header}</summary>
        <ul className="mt-2 flex flex-col gap-1 border-t border-zinc-200/70 pt-2 dark:border-zinc-800">
          {track.subs.map((s) => (
            <li
              key={s.key}
              className={`flex items-baseline justify-between text-[11px] ${
                s.available
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-400 dark:text-zinc-600"
              }`}
            >
              <span>
                {s.label}
                {s.available && s.levels > 0 && (
                  <span className="text-zinc-400 dark:text-zinc-600">
                    {" "}
                    ({s.levels})
                  </span>
                )}
              </span>
              <span className="font-mono">
                {!s.available ? (
                  <span className="italic">import data</span>
                ) : s.levels === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    maxed
                  </span>
                ) : (
                  formatDuration(s.seconds)
                )}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
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
  onBuilderCount,
  goldPass,
  onGoldPass,
  loading = false,
  stats,
  village,
  skips,
  skipMode,
  onSkipMode,
}: {
  builderCount: number;
  onBuilderCount: (n: number) => void;
  goldPass: boolean;
  onGoldPass: (v: boolean) => void;
  loading?: boolean;
  stats: VillageStats | null;
  village: VillageExport | null;
  skips: string[];
  skipMode: boolean;
  onSkipMode: (enabled: boolean) => void;
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

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-fit">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Time to max
        </h2>

        <div className="mt-3 flex items-center justify-between gap-4 text-sm text-zinc-700 dark:text-zinc-300">
          <label className="flex items-center gap-2">
            Builders
            <input
              type="number"
              min={1}
              max={MAX_BUILDERS}
              value={builderCount}
              onChange={(e) =>
                onBuilderCount(
                  Math.min(MAX_BUILDERS, Math.max(1, Number(e.target.value) || 1))
                )
              }
              className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-right font-mono text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            Gold Pass
            <input
              type="checkbox"
              checked={goldPass}
              onChange={(e) => onGoldPass(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
          </label>
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={() => onSkipMode(!skipMode)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              skipMode
                ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            {skipMode ? "Done" : "Skip Mode"}
          </button>
        </div>

        {loading ? (
          <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <div className="h-8 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-52 rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ) : slowestTrack ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {formatDuration(slowestTrack.finishSeconds)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              until fully maxed
              {skips.length > 0 && ` (${skips.length} skipped)`}
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
          <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-900 dark:text-zinc-400">
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
