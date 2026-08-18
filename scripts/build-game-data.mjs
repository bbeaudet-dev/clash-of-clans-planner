// Transforms the vendored coc.py static data into a slim, normalized dataset
// the app bundles. Run with: npm run build:data
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, "..", "data", "coc-static-data.json");
const OUT = join(__dirname, "..", "src", "data", "gameData.generated.json");

const raw = JSON.parse(readFileSync(RAW, "utf8"));

/**
 * Normalize a source `levels` array into rows of { level, time, cost, th } where
 * each row holds the time/cost of the level N -> N+1 upgrade.
 *
 * The source uses two opposite conventions: troops/heroes/spells/pets store the
 * N -> N+1 step in `upgrade_time`/`upgrade_cost` on level N, while buildings and
 * traps store the (N-1) -> N step in `build_time`/`build_cost` on level N. For
 * the build-style entities we shift the value back one level so all entities end
 * up on the single "N -> N+1 on row N" convention the app assumes.
 */
function normalizeLevels(rawLevels) {
  const buildStyle = rawLevels.some(
    (l) => "build_time" in l || "build_cost" in l
  );
  return rawLevels.map((lv, i) => {
    const th = lv.required_townhall ?? null;
    if (buildStyle) {
      const next = rawLevels[i + 1];
      return {
        level: lv.level,
        time: next?.build_time ?? 0,
        cost: next?.build_cost ?? 0,
        th,
      };
    }
    return {
      level: lv.level,
      time: lv.upgrade_time ?? 0,
      cost: lv.upgrade_cost ?? 0,
      th,
    };
  });
}

function categoryFor(sourceKey, entity) {
  switch (sourceKey) {
    case "heroes":
      return "hero";
    case "pets":
      return "pet";
    case "spells":
      return "spell";
    case "traps":
      return "trap";
    case "troops":
      return entity.production_building === "Workshop" ? "siege" : "troop";
    case "helpers":
      return "helper";
    case "equipment":
      return "equipment";
    case "guardians":
      return "guardian";
    case "buildings":
      // Normalize to lowercase so grouping is predictable: defense, resource,
      // army, wall, town hall, worker (+ builder-base "town hall2"/"worker2").
      return (entity.type ?? "building").toLowerCase();
    default:
      return sourceKey;
  }
}

const SOURCE_KEYS = [
  "heroes",
  "pets",
  "spells",
  "troops",
  "helpers",
  "equipment",
  "guardians",
  "traps",
  "buildings",
];

const entities = {};
const idToName = {};

for (const key of SOURCE_KEYS) {
  for (const e of raw[key] ?? []) {
    const name = e.name;
    const village = e.village ?? "home";
    if (typeof e._id === "number") idToName[e._id] = name;

    const normalized = {
      id: e._id,
      name,
      category: categoryFor(key, e),
      village,
      resource: e.upgrade_resource ?? null,
      // Super troops (marked by a `super_troop` block in the source) are boosted
      // variants with no independent upgrade level, so we flag and exclude them.
      ...(e.super_troop ? { isSuper: true } : {}),
      // Hero equipment carries its owning hero and rarity.
      ...(e.hero ? { hero: e.hero } : {}),
      ...(e.rarity ? { rarity: e.rarity } : {}),
      levels: normalizeLevels(e.levels ?? []),
    };

    // Prefer the home-village entity when a name exists in both villages
    // (e.g. Baby Dragon). Never let a builderBase entry clobber a home one.
    const existing = entities[name];
    if (!existing || (existing.village !== "home" && village === "home")) {
      entities[name] = normalized;
    }
  }
}

// Town Hall unlocks: each Town Hall level's `unlocks` array lists the buildings
// (and how many) newly granted at that TH. We keep it verbatim, keyed by TH
// level, so the app can derive full building rosters + per-TH counts. This is a
// reusable resource (rosters, "what's new this TH", un-built building tracking).
const townHall = (raw.buildings ?? []).find((b) => b.name === "Town Hall");
const townHallUnlocks = {};
for (const lv of townHall?.levels ?? []) {
  const unlocks = (lv.unlocks ?? []).map((u) => ({
    id: u._id,
    name: u.name,
    quantity: u.quantity,
  }));
  if (unlocks.length > 0) townHallUnlocks[lv.level] = unlocks;
}

const out = {
  source: "coc.py static_data.json (github.com/mathsman5133/coc.py)",
  generatedAt: new Date().toISOString(),
  entities,
  idToName,
  townHallUnlocks,
};

writeFileSync(OUT, JSON.stringify(out));
console.log(
  `Wrote ${OUT}: ${Object.keys(entities).length} entities, ${
    Object.keys(idToName).length
  } id mappings, ${Object.keys(townHallUnlocks).length} TH unlock levels.`
);
