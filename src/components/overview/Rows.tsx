import { StatRow } from "@/lib/gameData";
import { BuildingRow, buildingProgress } from "@/lib/villageExport";

function SkipCountControl({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label={`Decrease skipped ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
      >
        -
      </button>
      <span className="min-w-4 text-center font-mono text-xs text-zinc-500 dark:text-zinc-400">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Increase skipped ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
      >
        +
      </button>
    </span>
  );
}

function Bar({
  pct,
  maxed,
  active = false,
}: {
  pct: number;
  maxed: boolean;
  /** Currently being upgraded: shown in blue regardless of progress. */
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

export function ArmyRow({
  row,
  skipMode,
  skipCount,
  maxSkips,
  onSkipCount,
  active = false,
}: {
  row: StatRow;
  skipMode: boolean;
  skipCount: number;
  maxSkips: number;
  onSkipCount?: (next: number) => void;
  active?: boolean;
}) {
  const skipped = skipCount > 0;
  const isMaxed = row.thMax !== null && row.level >= row.thMax;
  const pct =
    row.thMax && row.thMax > 0
      ? Math.min(100, Math.round((row.level / row.thMax) * 100))
      : 0;
  const catchUp =
    row.prevThMax !== null && row.level < row.prevThMax
      ? row.prevThMax - row.level
      : 0;
  const showPrev =
    row.prevThMax !== null && row.prevThMax > 0 && row.prevThMax < (row.thMax ?? 0);
  const showNext =
    row.nextThMax !== null && row.thMax !== null && row.nextThMax > row.thMax;
  const activeUpgrade = active && !isMaxed;
  const barPct =
    activeUpgrade && row.thMax && row.thMax > 0
      ? Math.min(100, Math.round(((row.level + 1) / row.thMax) * 100))
      : pct;

  return (
    <li className={`py-1.5 ${skipped ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {skipMode && onSkipCount && maxSkips > 0 && (
            <SkipCountControl
              value={skipCount}
              max={maxSkips}
              label={row.name}
              onChange={onSkipCount}
            />
          )}
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {row.name}
          </span>
          {skipped && (
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {skipCount} skipped
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

export function BuildingRowItem({
  row,
  skipMode,
  skipCount,
  maxSkips,
  onSkipCount,
  activeCount = 0,
}: {
  row: BuildingRow;
  skipMode: boolean;
  skipCount: number;
  maxSkips: number;
  onSkipCount?: (next: number) => void;
  /** How many instances of this building are currently upgrading. */
  activeCount?: number;
}) {
  const skipped = skipCount > 0;
  const breakdown = row.byLevel.map((l) => `${l.count}×L${l.level}`).join(", ");
  const multiple = row.total > 1;

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
  const effectiveTotal = row.total + toBuild;
  const { catchUp } = buildingProgress(row);
  const remaining = buildingProgress(row).remaining + row.cap * toBuild;
  const isMaxed = remaining === 0;
  const sumLevels = row.byLevel.reduce((s, l) => s + l.level * l.count, 0);
  const sumCap = row.cap * effectiveTotal;
  const pct = sumCap > 0 ? Math.min(100, (sumLevels / sumCap) * 100) : 0;
  const notBuilt = row.total === 0;
  const avg = effectiveTotal > 0 ? sumLevels / effectiveTotal : 0;
  const avgStr = Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
  const activeUpgrade = activeCount > 0 && !isMaxed;
  const barPct =
    activeUpgrade && sumCap > 0
      ? Math.min(100, ((sumLevels + activeCount) / sumCap) * 100)
      : pct;

  return (
    <li className={`py-1.5 ${skipped ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {skipMode && onSkipCount && maxSkips > 0 && (
            <SkipCountControl
              value={skipCount}
              max={maxSkips}
              label={row.name}
              onChange={onSkipCount}
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
              {skipCount} skipped
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
