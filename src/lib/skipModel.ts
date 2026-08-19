import { getEntity } from "./gameData";
import { BuildingRow, buildingProgress } from "./villageExport";

interface ParsedSkip {
  key: string;
  count: number | null;
}

export function parseSkipEntry(skip: string): ParsedSkip {
  const match = /^(.*):(\d+)$/.exec(skip);
  if (!match) return { key: skip, count: null };
  return { key: match[1], count: Number(match[2]) };
}

export function skipKeyOf(skip: string): string {
  return parseSkipEntry(skip).key;
}

export function getSkipCount(
  skips: Iterable<string>,
  key: string,
  maxCount: number
): number {
  if (maxCount <= 0) return 0;
  let count = 0;
  for (const skip of skips) {
    const parsed = parseSkipEntry(skip);
    if (parsed.key !== key) continue;
    count += parsed.count ?? maxCount;
  }
  return Math.min(maxCount, count);
}

export function setSkipCount(
  skips: string[],
  key: string,
  nextCount: number,
  maxCount: number
): string[] {
  const clamped = Math.min(Math.max(0, Math.floor(nextCount)), maxCount);
  const next = skips.filter((skip) => skipKeyOf(skip) !== key);
  if (clamped === 0 || maxCount <= 0) return next;
  return [...next, clamped >= maxCount ? key : `${key}:${clamped}`];
}

export function buildingSkipCapacity(row: BuildingRow): number {
  if (row.cap === null) return 0;
  if (getEntity(row.name)?.category === "wall") return 1;
  return buildingProgress(row).remaining + row.cap * (row.toBuild ?? 0);
}
