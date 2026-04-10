import {
  cleanText,
  fetchCollection,
  fetchJson,
  formatComponentList,
  joinParagraphs,
  logSkip,
  mapWithConcurrency,
  normalizeClasses,
  projectPath,
  slugify,
  writeJson
} from "./utils.mjs";

const API_ROOT = "https://www.dnd5eapi.co";
const SPELL_INDEX_URL = `${API_ROOT}/api/2014/spells`;
const OUTPUT_PATH = "data/dnd/DndSpells5e.json";
const SOURCE_LABEL = "5e SRD";

function normalizeSchool(school) {
  if (school && typeof school === "object") {
    return cleanText(school.name) || "-";
  }
  return cleanText(school) || "-";
}

function normalizeSpell(spell) {
  return {
    id: String(spell.index || slugify(spell.name)),
    name: cleanText(spell.name) || "Unnamed Spell",
    level: Number(spell.level || 0),
    school: normalizeSchool(spell.school),
    castingTime: cleanText(spell.casting_time || spell.castingTime) || "-",
    range: cleanText(spell.range) || "-",
    components: formatComponentList(spell.components, spell.material),
    duration: cleanText(spell.duration) || "-",
    description: joinParagraphs(spell.desc),
    classes: normalizeClasses(spell.classes),
    ritual: Boolean(spell.ritual),
    concentration: Boolean(spell.concentration),
    higherLevels: joinParagraphs(spell.higher_level || spell.higherLevels),
    source: SOURCE_LABEL,
    sourcePage: ""
  };
}

async function main() {
  console.log("Fetching spell index...");
  const spellIndex = await fetchCollection(SPELL_INDEX_URL);
  console.log(`Found ${spellIndex.length} spell references.`);

  const normalizedSpells = [];

  const detailedSpells = await mapWithConcurrency(
    spellIndex,
    async function (entry) {
      const id = entry.index || slugify(entry.name);
      try {
        return await fetchJson(`${API_ROOT}/api/2014/spells/${id}`);
      } catch (error) {
        logSkip("spell", id, error);
        return null;
      }
    },
    16
  );

  for (const spell of detailedSpells) {
    if (!spell) {
      continue;
    }

    try {
      normalizedSpells.push(normalizeSpell(spell));
    } catch (error) {
      logSkip("spell", spell.index || spell.name || "unknown", error);
    }
  }

  normalizedSpells.sort(function (left, right) {
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
  });

  const outputPath = await writeJson(OUTPUT_PATH, normalizedSpells);
  console.log(`Wrote ${normalizedSpells.length} spells to ${projectPath(OUTPUT_PATH)}`);
  console.log(`Output file: ${outputPath}`);
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
