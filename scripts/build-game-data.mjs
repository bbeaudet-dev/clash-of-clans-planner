// Transforms the vendored coc.py static data into a slim, normalized dataset
// the app bundles. Run with: npm run build:data
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, "..", "data", "coc-static-data.json");
const OUT = join(__dirname, "..", "src", "data", "gameData.generated.json");

const raw = JSON.parse(readFileSync(RAW, "utf8"));

/** Normalize one source level row into { level, time, cost, th }. */
function levelRow(lv) {
  return {
    level: lv.level,
    time: lv.upgrade_time ?? lv.build_time ?? 0,
    cost: lv.upgrade_cost ?? lv.build_cost ?? 0,
    th: lv.required_townhall ?? null,
  };
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
    case "buildings":
      return entity.type ?? "building";
    default:
      return sourceKey;
  }
}

const SOURCE_KEYS = ["heroes", "pets", "spells", "troops", "traps", "buildings"];

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
      levels: (e.levels ?? []).map(levelRow),
    };

    // Prefer the home-village entity when a name exists in both villages
    // (e.g. Baby Dragon). Never let a builderBase entry clobber a home one.
    const existing = entities[name];
    if (!existing || (existing.village !== "home" && village === "home")) {
      entities[name] = normalized;
    }
  }
}

const out = {
  source: "coc.py static_data.json (github.com/mathsman5133/coc.py)",
  generatedAt: new Date().toISOString(),
  entities,
  idToName,
};

writeFileSync(OUT, JSON.stringify(out));
console.log(
  `Wrote ${OUT}: ${Object.keys(entities).length} entities, ${
    Object.keys(idToName).length
  } id mappings.`
);
