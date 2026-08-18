import { CATEGORY_LABELS, StatRow, VillageStats } from "@/lib/gameData";

function StatRowItem({ row }: { row: StatRow }) {
  const isMaxed = row.thMax !== null && row.remaining === 0;
  const pct =
    row.thMax && row.thMax > 0
      ? Math.min(100, Math.round((row.level / row.thMax) * 100))
      : 0;

  return (
    <li className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {row.name}
          </span>
          <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {row.level}
            {row.thMax !== null ? ` / ${row.thMax}` : ""}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${
              isMaxed ? "bg-emerald-500" : "bg-amber-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={`w-16 shrink-0 text-right text-xs font-medium ${
          isMaxed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400"
        }`}
      >
        {row.thMax === null
          ? "—"
          : isMaxed
            ? "maxed"
            : `+${row.remaining}`}
      </span>
    </li>
  );
}

export function VillageStatsView({
  playerName,
  stats,
}: {
  playerName: string;
  stats: VillageStats;
}) {
  const allRows = stats.groups.flatMap((g) => g.rows);
  const totalRemaining = allRows.reduce((sum, r) => sum + r.remaining, 0);
  const maxedCount = allRows.filter(
    (r) => r.thMax !== null && r.remaining === 0
  ).length;

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {playerName}
        </h2>
        <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          TH{stats.townHallLevel}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {maxedCount}/{allRows.length} maxed · {totalRemaining} levels to go
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {stats.groups.map((group) => (
          <section
            key={group.category}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {CATEGORY_LABELS[group.category]}
              <span className="ml-2 font-normal normal-case text-zinc-400">
                ({group.rows.length})
              </span>
            </h3>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {group.rows.map((row) => (
                <StatRowItem key={row.name} row={row} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
