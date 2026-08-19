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

const SKIPPABLE_ARMY_CATEGORIES = new Set<Category>([
  "hero",
  "pet",
  "troop",
  "siege",
  "spell",
]);

function armySkipKey(row: StatRow): string {
  return `army:${row.name}`;
}

function buildingSkipKey(row: BuildingRow): string {
  return `building:${row.name}`;
}

// Rushed thresholds, in days of total upgrade work still owed below the
// previous TH caps. Below 60d is a light rush, 60–100d moderate, >100d heavy.
function rushColor(seconds: number): string {
  const days = seconds / 86400;
  if (days <= 0) return "text-emerald-600 dark:text-emerald-400";
  if (days < 60) return "text-yellow-600 dark:text-yellow-400";
  if (days <= 100) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function Bar({
  pct,
  maxed,
  active = false,
}: {
  pct: number;
  maxed: boolean;
  /** Currently being upgraded — shown in blue regardless of progress. */
  active?: boolean;
}) {
  const color = active ? "bg-sky-400" : maxed ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ArmyRow({
  row,
  skipMode,
  skipped,
  onToggleSkip,
  active = false,
}: {
  row: StatRow;
  skipMode: boolean;
  skipped: boolean;
  onToggleSkip?: () => void;
  active?: boolean;
}) {
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

  // While upgrading, fill the bar to the level being worked toward (level + 1)
  // and color it blue; it becomes green once the finished level is maxed.
  const activeUpgrade = active && !isMaxed;
  const barPct =
    activeUpgrade && row.thMax && row.thMax > 0
      ? Math.min(100, Math.round(((row.level + 1) / row.thMax) * 100))
      : pct;

  return (
    <li className={`py-1.5 ${skipped ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {skipMode && onToggleSkip && (
            <input
              type="checkbox"
              checked={skipped}
              onChange={onToggleSkip}
              aria-label={`Skip ${row.name}`}
              className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
            />
          )}
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {row.name}
          </span>
          {skipped && (
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              skipped
            </span>
          )}
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
      <Bar pct={barPct} maxed={isMaxed} active={activeUpgrade} />
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

function BuildingRowItem({
  row,
  skipMode,
  skipped,
  onToggleSkip,
  activeCount = 0,
}: {
  row: BuildingRow;
  skipMode: boolean;
  skipped: boolean;
  onToggleSkip?: () => void;
  /** How many instances of this building are currently upgrading. */
  activeCount?: number;
}) {
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

  // While upgrading, extend the bar to the levels being worked toward (one per
  // in-progress instance) and color it blue until those finish.
  const activeUpgrade = activeCount > 0 && !isMaxed;
  const barPct =
    activeUpgrade && sumCap > 0
      ? Math.min(100, ((sumLevels + activeCount) / sumCap) * 100)
      : pct;

  return (
    <li className={`py-1.5 ${skipped ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {skipMode && onToggleSkip && (
            <input
              type="checkbox"
              checked={skipped}
              onChange={onToggleSkip}
              aria-label={`Skip ${row.name}`}
              className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
            />
          )}
          <span
            className={`truncate text-sm font-medium ${
              notBuilt
                ? "text-zinc-400 dark:text-zinc-600"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {row.name}
          </span>
          {skipped && (
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              skipped
            </span>
          )}
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
      <Bar pct={barPct} maxed={isMaxed} active={activeUpgrade} />
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
      className={`mb-6 break-inside-avoid rounded-xl border p-4 ${
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

function LoadingSectionCard({ title }: { title: string }) {
  return (
    <section className="mb-6 break-inside-avoid rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <div className="space-y-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Overview({
  playerName,
  playerTag,
  fallbackTownHallLevel = null,
  loading = false,
  stats,
  village,
  skips,
  skipMode,
  onToggleSkip,
}: {
  playerName: string | null;
  playerTag: string | null;
  fallbackTownHallLevel?: number | null;
  loading?: boolean;
  stats: VillageStats | null;
  village: VillageExport | null;
  skips: string[];
  skipMode: boolean;
  onToggleSkip: (key: string) => void;
}) {
  const summary = computeBaseSummary(stats, village);
  const townHallLevel =
    stats?.townHallLevel ?? village?.townHallLevel ?? fallbackTownHallLevel ?? 0;
  const skipSet = new Set(skips);
  // How many live upgrade timers each item has, so bars can show as "active"
  // and extend to the level being worked toward.
  const inProgressCount = new Map<string, number>();
  for (const u of village?.inProgress ?? []) {
    inProgressCount.set(u.name, (inProgressCount.get(u.name) ?? 0) + 1);
  }

  const armyGroup = (c: Category) =>
    stats?.groups.find((g) => g.category === c) ?? null;
  const buildingGroup = (c: string) =>
    village?.groups.find((g) => g.category === c) ?? null;

  const renderArmySection = (category: Category) => {
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
        {group?.rows.map((row) => {
          const skippable = SKIPPABLE_ARMY_CATEGORIES.has(category);
          const key = armySkipKey(row);
          return (
            <ArmyRow
              key={row.name}
              row={row}
              skipMode={skipMode}
              skipped={skippable && skipSet.has(key)}
              onToggleSkip={skippable ? () => onToggleSkip(key) : undefined}
              active={inProgressCount.has(row.name)}
            />
          );
        })}
      </SectionCard>
    );
  };

  return (
    <div className="w-full" aria-busy={loading}>
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
        {loading && !stats && !village ? (
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Loading account data...
          </span>
        ) : (
          <>
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
          </>
        )}
      </div>

      {loading && !stats && !village ? (
        <div className="gap-6 sm:columns-2">
          <LoadingSectionCard title="Army" />
          <LoadingSectionCard title="Base" />
          <LoadingSectionCard title="Laboratory" />
          <LoadingSectionCard title="Builders" />
        </div>
      ) : (
        <div className="gap-6 sm:columns-2">
          {/* Hero Equipment is rendered last (after buildings); it's ore-upgraded
              and less of a planning concern than the rest of the army. */}
          {CATEGORY_ORDER.filter((c) => c !== "equipment").map(
            renderArmySection
          )}

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
                {group?.rows.map((row) => {
                  const skippable = category !== "helper" && row.cap !== null;
                  const key = buildingSkipKey(row);
                  return (
                  <BuildingRowItem
                    key={row.id}
                    row={row}
                    skipMode={skipMode}
                    skipped={skippable && skipSet.has(key)}
                    onToggleSkip={
                      skippable ? () => onToggleSkip(key) : undefined
                    }
                    activeCount={inProgressCount.get(row.name) ?? 0}
                  />
                  );
                })}
              </SectionCard>
            );
          })}

          {renderArmySection("equipment")}
        </div>
      )}
    </div>
  );
}
