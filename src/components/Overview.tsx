import { CATEGORY_LABELS, StatRow, VillageStats } from "@/lib/gameData";
import {
  BASE_CATEGORY_LABELS,
  BASE_CATEGORY_ORDER,
  BuildingRow,
  buildingProgress,
  rowLevelsToGo,
  VillageExport,
} from "@/lib/villageExport";

function Bar({ pct, maxed }: { pct: number; maxed: boolean }) {
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full ${
          maxed ? "bg-emerald-500" : "bg-amber-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ArmyRow({ row }: { row: StatRow }) {
  const isMaxed = row.thMax !== null && row.level >= row.thMax;
  const pct =
    row.thMax && row.thMax > 0
      ? Math.min(100, Math.round((row.level / row.thMax) * 100))
      : 0;
  const showPrev =
    row.prevThMax !== null && row.prevThMax > 0 && row.prevThMax < (row.thMax ?? 0);
  const showNext =
    row.nextThMax !== null && row.thMax !== null && row.nextThMax > row.thMax;

  return (
    <li className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {row.name}
        </span>
        <span className="shrink-0 font-mono text-xs">
          <span
            className={
              isMaxed
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-900 dark:text-zinc-100"
            }
          >
            {row.level}
          </span>
          <span className="text-zinc-400">
            {row.thMax !== null ? ` / ${row.thMax}` : ""}
          </span>
        </span>
      </div>
      <Bar pct={pct} maxed={isMaxed} />
      <div className="mt-1 flex justify-end gap-3 text-[11px] text-zinc-400">
        {showPrev && <span>prev {row.prevThMax}</span>}
        {row.thMax !== null && (
          <span className="text-emerald-600 dark:text-emerald-400">
            {isMaxed ? "maxed" : `+${row.remaining} to max`}
          </span>
        )}
        {showNext && (
          <span className="text-sky-600 dark:text-sky-400">
            next {row.nextThMax}
          </span>
        )}
      </div>
    </li>
  );
}

function BuildingRowItem({ row }: { row: BuildingRow }) {
  const breakdown = row.byLevel.map((l) => `${l.count}×L${l.level}`).join(", ");
  const multiple = row.total > 1;

  // Untracked buildings (no cap known: B.O.B, Helper Hut, etc.) are never
  // upgraded, so show them as complete rather than "not maxed".
  if (row.cap === null) {
    return (
      <li className="py-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {row.name}
          </span>
          <span className="shrink-0 font-mono text-xs text-zinc-400">
            {breakdown}
          </span>
        </div>
        <Bar pct={100} maxed />
      </li>
    );
  }

  const { catchUp, remaining } = buildingProgress(row);
  const isMaxed = remaining === 0;
  const sumLevels = row.byLevel.reduce((s, l) => s + l.level * l.count, 0);
  const sumCap = row.cap * row.total;
  const pct = sumCap > 0 ? Math.min(100, (sumLevels / sumCap) * 100) : 0;
  // A single number that reads like a troop level: exact when all instances
  // share a level, otherwise the average across instances.
  const avg = sumLevels / row.total;
  const avgStr = row.byLevel.length === 1 ? String(avg) : avg.toFixed(1);

  return (
    <li className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {row.name}
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
          {catchUp > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              {catchUp} catch-up
            </span>
          )}
          <span>
            <span
              className={
                isMaxed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-900 dark:text-zinc-100"
              }
            >
              {avgStr}
            </span>
            <span className="text-zinc-400"> / {row.cap}</span>
          </span>
        </span>
      </div>
      <Bar pct={pct} maxed={isMaxed} />
      {(!isMaxed || multiple) && (
        <div className="mt-1 flex justify-end gap-3 text-[11px] text-zinc-400">
          {!isMaxed && (
            <span className="text-emerald-600 dark:text-emerald-400">
              +{remaining} to max
            </span>
          )}
          {multiple && <span>{breakdown}</span>}
        </div>
      )}
    </li>
  );
}

function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
        <span className="ml-2 font-normal normal-case text-zinc-400">
          ({count})
        </span>
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

export function Overview({
  playerName,
  stats,
  village,
}: {
  playerName: string | null;
  stats: VillageStats | null;
  village: VillageExport | null;
}) {
  const armyRows = stats?.groups.flatMap((g) => g.rows) ?? [];
  const buildingRows = village?.groups.flatMap((g) => g.rows) ?? [];

  const armyMaxed = armyRows.filter(
    (r) => r.thMax !== null && r.remaining === 0
  ).length;
  const armyLevelsToGo = armyRows.reduce((s, r) => s + r.remaining, 0);

  const buildingInstances = buildingRows.reduce((s, r) => s + r.total, 0);
  // Untracked buildings (no cap) can't be upgraded, so count them as maxed.
  const buildingMaxed = buildingRows.reduce(
    (s, r) => s + (r.cap === null ? r.total : r.maxedCount),
    0
  );
  const buildingLevelsToGo = buildingRows.reduce(
    (s, r) => s + rowLevelsToGo(r),
    0
  );

  const totalThings = armyRows.length + buildingInstances;
  const totalMaxed = armyMaxed + buildingMaxed;
  const totalLevelsToGo = armyLevelsToGo + buildingLevelsToGo;

  const townHallLevel = stats?.townHallLevel ?? village?.townHallLevel ?? 0;

  const buildingOrder = (c: string) => {
    const i = (BASE_CATEGORY_ORDER as readonly string[]).indexOf(c);
    return i === -1 ? 99 : i;
  };
  const buildingGroups = village
    ? [...village.groups].sort(
        (a, b) => buildingOrder(a.category) - buildingOrder(b.category)
      )
    : [];

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {playerName ?? "Village"}
        </h2>
        {townHallLevel > 0 && (
          <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            TH{townHallLevel}
          </span>
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {totalMaxed}/{totalThings} maxed · {totalLevelsToGo} levels to go
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {stats?.groups.map((group) => (
          <SectionCard
            key={`army-${group.category}`}
            title={CATEGORY_LABELS[group.category]}
            count={group.rows.length}
          >
            {group.rows.map((row) => (
              <ArmyRow key={row.name} row={row} />
            ))}
          </SectionCard>
        ))}

        {buildingGroups.map((group) => (
          <SectionCard
            key={`base-${group.category}`}
            title={BASE_CATEGORY_LABELS[group.category] ?? group.category}
            count={group.rows.length}
          >
            {group.rows.map((row) => (
              <BuildingRowItem key={row.id} row={row} />
            ))}
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
