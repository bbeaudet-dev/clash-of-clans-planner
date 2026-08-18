import {
  BASE_CATEGORY_LABELS,
  BASE_CATEGORY_ORDER,
  BuildingRow,
  VillageExport,
} from "@/lib/villageExport";

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function BuildingRowItem({ row }: { row: BuildingRow }) {
  const allMaxed = row.cap !== null && row.maxedCount === row.total;

  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-sm text-zinc-800 dark:text-zinc-200">
        {row.name}
        {row.cap !== null && (
          <span className="ml-1 text-xs text-zinc-400">cap {row.cap}</span>
        )}
      </span>
      <span className="shrink-0 text-right text-xs">
        <span className="font-mono text-zinc-600 dark:text-zinc-300">
          {row.byLevel
            .map((l) => `${l.count}×L${l.level}`)
            .join(", ")}
        </span>
        <span
          className={`ml-2 font-medium ${
            allMaxed
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {row.cap === null
            ? ""
            : allMaxed
              ? "maxed"
              : `${row.maxedCount}/${row.total}`}
        </span>
      </span>
    </li>
  );
}

export function BaseBuildingsView({ village }: { village: VillageExport }) {
  const orderIndex = (c: string) => {
    const i = (BASE_CATEGORY_ORDER as readonly string[]).indexOf(c);
    return i === -1 ? 99 : i;
  };
  const groups = [...village.groups].sort(
    (a, b) => orderIndex(a.category) - orderIndex(b.category)
  );

  return (
    <div className="mt-10 w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Base buildings
        </h2>
        {village.tag && (
          <span className="font-mono text-xs text-zinc-500">{village.tag}</span>
        )}
        {village.timestamp && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            as of {new Date(village.timestamp * 1000).toLocaleString()}
          </span>
        )}
      </div>

      {village.inProgress.length > 0 && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <h3 className="mb-2 text-sm font-semibold text-sky-800 dark:text-sky-300">
            Currently upgrading ({village.inProgress.length})
          </h3>
          <ul className="space-y-1 text-sm text-sky-900 dark:text-sky-200">
            {village.inProgress.map((u, i) => (
              <li key={`${u.name}-${i}`} className="flex justify-between gap-3">
                <span>
                  {u.name} <span className="text-sky-500">L{u.level}</span>
                </span>
                <span className="font-mono text-xs">
                  {formatDuration(u.secondsLeft)} left
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.category}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {BASE_CATEGORY_LABELS[group.category] ?? group.category}
              <span className="ml-2 font-normal normal-case text-zinc-400">
                ({group.rows.length})
              </span>
            </h3>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {group.rows.map((row) => (
                <BuildingRowItem key={row.id} row={row} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
