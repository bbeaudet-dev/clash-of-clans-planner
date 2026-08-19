import { CheckIcon, SkipIcon, UpgradeIcon } from "@/components/icons";
import { formatDuration, Track } from "@/lib/tracks";
import { CountBadge } from "./CountBadge";

function finishDate(seconds: number): string {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function TrackCard({
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
  const showDetailRow = !done || track.skippedLevels > 0;
  const countBadges = (
    <span className="inline-flex items-center gap-2 align-middle">
      <CountBadge
        count={track.levels}
        icon={<UpgradeIcon className="h-3 w-3" />}
        className="text-sky-600 dark:text-sky-400"
        title="Included upgrade levels"
      />
      <CountBadge
        count={track.skippedLevels}
        icon={<SkipIcon className="h-3 w-3" />}
        className="text-amber-600 dark:text-amber-400"
        title="Skipped upgrade levels"
      />
    </span>
  );

  const header = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {expandable && (
            <span className="mr-1 inline-block text-zinc-400 transition-transform group-open:rotate-90">
              {"›"}
            </span>
          )}
          {track.label}
          {bottleneck && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              bottleneck
            </span>
          )}
        </span>
        <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {done ? (
            <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            formatDuration(track.finishSeconds)
          )}
        </span>
      </div>
      {showDetailRow && (
        <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            {countBadges}
            {track.parallel > 1
              ? ` · ${formatDuration(track.workSeconds)} ÷ ${track.parallel}`
              : ""}
            {criticalLimited ? ` · max item ${formatDuration(criticalPath)}` : ""}
          </span>
          {!done && <span>done ~ {finishDate(track.finishSeconds)}</span>}
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
    return <li className={cardClass}>{header}</li>;
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
                {s.available && (
                  <span className="ml-1 inline-flex items-center gap-2 align-middle">
                    <CountBadge
                      count={s.levels}
                      icon={<UpgradeIcon className="h-3 w-3" />}
                      className="text-sky-600 dark:text-sky-400"
                      title="Included upgrade levels"
                    />
                    <CountBadge
                      count={s.skippedLevels}
                      icon={<SkipIcon className="h-3 w-3" />}
                      className="text-amber-600 dark:text-amber-400"
                      title="Skipped upgrade levels"
                    />
                  </span>
                )}
              </span>
              <span className="font-mono">
                {!s.available ? (
                  <span className="italic">import data</span>
                ) : s.levels === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    <CheckIcon className="h-3.5 w-3.5" />
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
