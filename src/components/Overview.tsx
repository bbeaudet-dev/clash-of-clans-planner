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
  VillageExport,
} from "@/lib/villageExport";
import { pendingUpgrades } from "@/lib/tracks";
import { buildingSkipCapacity, getSkipCount } from "@/lib/skipModel";
import { SkipIcon } from "@/components/icons";
import { StepHelpTooltip } from "@/components/StepHelpTooltip";
import { ArmyRow, BuildingRowItem } from "@/components/overview/Rows";
import {
  LoadingSectionCard,
  SectionCard,
} from "@/components/overview/SectionCard";

const SKIPPABLE_ARMY_CATEGORIES = new Set<Category>([
  "hero",
  "equipment",
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

export function Overview({
  playerName,
  playerTag,
  fallbackTownHallLevel = null,
  loading = false,
  stats,
  village,
  activeSkips,
  skipMode,
  builderCount,
  onBuilderCount,
  goldPass,
  onGoldPass,
  maxBuilderCount,
  onEnterSkipMode,
  onSaveSkips,
  onDiscardSkipDraft,
  skipDraftDirty,
  onSetSkipCount,
}: {
  playerName: string | null;
  playerTag: string | null;
  fallbackTownHallLevel?: number | null;
  loading?: boolean;
  stats: VillageStats | null;
  village: VillageExport | null;
  activeSkips: string[];
  skipMode: boolean;
  builderCount: number;
  onBuilderCount: (builderCount: number) => void;
  goldPass: boolean;
  onGoldPass: (goldPass: boolean) => void;
  maxBuilderCount: number;
  onEnterSkipMode: () => void;
  onSaveSkips: () => void;
  onDiscardSkipDraft: () => void;
  skipDraftDirty: boolean;
  onSetSkipCount: (key: string, nextCount: number, maxCount: number) => void;
}) {
  const townHallLevel =
    stats?.townHallLevel ?? village?.townHallLevel ?? fallbackTownHallLevel ?? 0;
  const skipSet = new Set(activeSkips);
  // How many genuinely-active upgrades each item has (finished-since-export or
  // API-superseded timers excluded), so bars show as "active" and extend to the
  // level being worked toward.
  const inProgressCount = new Map<string, number>();
  for (const u of village ? pendingUpgrades(village, stats) : []) {
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
          const maxSkips = skippable ? row.remaining : 0;
          const skipCount = getSkipCount(skipSet, key, maxSkips);
          return (
            <ArmyRow
              key={row.name}
              row={row}
              skipMode={skipMode}
              skipCount={skipCount}
              maxSkips={maxSkips}
              onSkipCount={
                skippable
                  ? (next) => onSetSkipCount(key, next, maxSkips)
                  : undefined
              }
              active={inProgressCount.has(row.name)}
            />
          );
        })}
      </SectionCard>
    );
  };

  return (
    <div className="w-full" aria-busy={loading}>
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                {playerName ?? "Village"}
              </h2>
              {playerTag && (
                <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  {playerTag}
                </p>
              )}
            </div>
            {townHallLevel > 0 && (
              <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                TH{townHallLevel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-zinc-700 dark:text-zinc-300">
            <label className="flex items-center gap-2">
              Builders
              <input
                type="number"
                min={1}
                max={maxBuilderCount}
                value={builderCount}
                onChange={(e) =>
                  onBuilderCount(
                    Math.min(
                      maxBuilderCount,
                      Math.max(1, Number(e.target.value) || 1)
                    )
                  )
                }
                className="w-10 rounded-lg border border-zinc-300 bg-white px-1.5 py-1 text-right font-mono text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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

            {skipMode ? (
              <span className="flex items-start gap-1.5">
                <span className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={onSaveSkips}
                    disabled={!skipDraftDirty}
                    className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save Skips
                  </button>
                  <button
                    type="button"
                    onClick={onDiscardSkipDraft}
                    className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Exit Without Saving Skips
                  </button>
                </span>
                <StepHelpTooltip label="What Skip Mode does" align="right">
                  <p>
                    Skip Mode lets you mark upgrades you do not plan to finish
                    for this Town Hall. Skipped levels are removed from upgrade
                    counts and tracked separately.
                  </p>
                  <p className="mt-2">
                    Changes are drafts while Skip Mode is active. Use{" "}
                    <strong>Save Skips</strong> to keep them, or exit without
                    saving to discard the draft.
                  </p>
                </StepHelpTooltip>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onEnterSkipMode}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <SkipIcon className="h-3.5 w-3.5 text-amber-500" />
                  Enter Skip Mode
                </button>
                <StepHelpTooltip label="What Skip Mode does" align="right">
                  <p>
                    Skip Mode lets you mark upgrades you do not plan to finish
                    for this Town Hall. Skipped levels are removed from upgrade
                    counts and tracked separately.
                  </p>
                  <p className="mt-2">
                    Changes are drafts while Skip Mode is active. Use{" "}
                    <strong>Save Skips</strong> to keep them, or exit without
                    saving to discard the draft.
                  </p>
                </StepHelpTooltip>
              </span>
            )}
          </div>
        </div>

        {loading && !stats && !village ? (
          <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Loading account data...
          </p>
        ) : null}
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
                  const maxSkips = skippable ? buildingSkipCapacity(row) : 0;
                  const skipCount = getSkipCount(skipSet, key, maxSkips);
                  return (
                    <BuildingRowItem
                      key={row.id}
                      row={row}
                      skipMode={skipMode}
                      skipCount={skipCount}
                      maxSkips={maxSkips}
                      onSkipCount={
                        skippable
                          ? (next) => onSetSkipCount(key, next, maxSkips)
                          : undefined
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
