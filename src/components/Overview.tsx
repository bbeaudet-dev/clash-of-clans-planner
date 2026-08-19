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
  skips,
  skipMode,
  onSetSkipCount,
}: {
  playerName: string | null;
  playerTag: string | null;
  fallbackTownHallLevel?: number | null;
  loading?: boolean;
  stats: VillageStats | null;
  village: VillageExport | null;
  skips: string[];
  skipMode: boolean;
  onSetSkipCount: (key: string, nextCount: number, maxCount: number) => void;
}) {
  const townHallLevel =
    stats?.townHallLevel ?? village?.townHallLevel ?? fallbackTownHallLevel ?? 0;
  const skipSet = new Set(skips);
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
