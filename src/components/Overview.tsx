import {
  Category,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_UNLOCK_TH,
  StatRow,
  VillageStats,
} from "@/lib/gameData";
import {
  BASE_CATEGORY_LABELS,
  BASE_CATEGORY_ORDER,
  BuildingRow,
  buildingProgress,
  VillageExport,
} from "@/lib/villageExport";
import { computeBaseSummary, formatDuration } from "@/lib/tracks";

// Rushed thresholds, in days of total upgrade work still owed below the
// previous TH caps. Below 60d is a light rush, 60–100d moderate, >100d heavy.
function rushColor(seconds: number): string {
  const days = seconds / 86400;
  if (days <= 0) return "text-emerald-600 dark:text-emerald-400";
  if (days < 60) return "text-yellow-600 dark:text-yellow-400";
  if (days <= 100) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

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
  // Levels still owed below the previous TH cap (i.e. this unit is "rushed").
  const catchUp =
    row.prevThMax !== null && row.level < row.prevThMax
      ? row.prevThMax - row.level
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
              {row.level}
            </span>
            <span className="text-zinc-400">
              {row.thMax !== null ? ` / ${row.thMax}` : ""}
            </span>
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

  const toBuild = row.toBuild ?? 0;
  // Un-built copies are counted as level-0 instances built from scratch, so they
  // drag the bar and add their full cap to the remaining work.
  const effectiveTotal = row.total + toBuild;
  const { catchUp } = buildingProgress(row);
  const remaining = buildingProgress(row).remaining + row.cap * toBuild;
  const isMaxed = remaining === 0;
  const sumLevels = row.byLevel.reduce((s, l) => s + l.level * l.count, 0);
  const sumCap = row.cap * effectiveTotal;
  const pct = sumCap > 0 ? Math.min(100, (sumLevels / sumCap) * 100) : 0;
  const notBuilt = row.total === 0; // nothing placed yet
  // A single number that reads like a troop level: exact when all instances
  // share a level, otherwise the average across instances.
  const avg = effectiveTotal > 0 ? sumLevels / effectiveTotal : 0;
  const avgStr = Number.isInteger(avg) ? String(avg) : avg.toFixed(1);

  return (
    <li className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`truncate text-sm font-medium ${
            notBuilt
              ? "text-zinc-400 dark:text-zinc-600"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {row.name}
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
          {catchUp > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              {catchUp} catch-up
            </span>
          )}
          {toBuild > 0 && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {toBuild} to build
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
          {multiple && breakdown && <span>{breakdown}</span>}
        </div>
      )}
    </li>
  );
}

function SectionCard({
  title,
  count,
  locked = false,
  note,
  children,
}: {
  title: string;
  count?: number;
  /** Renders the whole section muted (e.g. not yet unlocked at this TH). */
  locked?: boolean;
  /** A muted line to show in place of rows (locked reason, empty state, …). */
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-4 ${
        locked
          ? "border-zinc-200/70 bg-zinc-50/50 dark:border-zinc-800/60 dark:bg-zinc-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <h3
        className={`mb-1 text-sm font-semibold uppercase tracking-wide ${
          locked
            ? "text-zinc-400 dark:text-zinc-600"
            : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {title}
        {count !== undefined && !locked && (
          <span className="ml-2 font-normal normal-case text-zinc-400">
            ({count})
          </span>
        )}
      </h3>
      {note ? (
        <p className="py-1 text-xs italic text-zinc-400 dark:text-zinc-600">
          {note}
        </p>
      ) : (
        <ul>{children}</ul>
      )}
    </section>
  );
}

export function Overview({
  playerName,
  playerTag,
  stats,
  village,
}: {
  playerName: string | null;
  playerTag: string | null;
  stats: VillageStats | null;
  village: VillageExport | null;
}) {
  const summary = computeBaseSummary(stats, village);
  const townHallLevel = stats?.townHallLevel ?? village?.townHallLevel ?? 0;

  const armyGroup = (c: Category) =>
    stats?.groups.find((g) => g.category === c) ?? null;
  const buildingGroup = (c: string) =>
    village?.groups.find((g) => g.category === c) ?? null;

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div>
          <h2 className="text-xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
            {playerName ?? "Village"}
          </h2>
          {playerTag && (
            <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
              {playerTag}
            </p>
          )}
        </div>
        {townHallLevel > 0 && (
          <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            TH{townHallLevel}
          </span>
        )}
        <span
          className="text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          title="Progress through this Town Hall's new upgrades (previous TH cap → current TH cap)"
        >
          {summary.pctToMax}% to max
        </span>
        <span
          className={`text-sm font-semibold ${rushColor(summary.rushedSeconds)}`}
          title="Total upgrade time still owed below the previous Town Hall's caps"
        >
          {summary.rushedSeconds > 0
            ? `${formatDuration(summary.rushedSeconds)} rushed`
            : "0d 0h rushed"}
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const unlockTH = CATEGORY_UNLOCK_TH[category];
          // Only show a category once it's unlocked at this TH; not-yet-unlocked
          // categories (e.g. Pets, Guardians) simply appear when reached.
          if (townHallLevel > 0 && unlockTH > townHallLevel) return null;
          const group = armyGroup(category);
          return (
            <SectionCard
              key={`army-${category}`}
              title={CATEGORY_LABELS[category]}
              count={group?.rows.length ?? 0}
              note={group && group.rows.length > 0 ? undefined : "None yet"}
            >
              {group?.rows.map((row) => (
                <ArmyRow key={row.name} row={row} />
              ))}
            </SectionCard>
          );
        })}

        {BASE_CATEGORY_ORDER.map((category) => {
          const group = buildingGroup(category);
          return (
            <SectionCard
              key={`base-${category}`}
              title={BASE_CATEGORY_LABELS[category] ?? category}
              count={group?.rows.length ?? 0}
              note={
                group && group.rows.length > 0
                  ? undefined
                  : village
                    ? "None"
                    : "Import village data to view"
              }
            >
              {group?.rows.map((row) => (
                <BuildingRowItem key={row.id} row={row} />
              ))}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
