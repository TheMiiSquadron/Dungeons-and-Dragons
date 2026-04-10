import {
  cleanText,
  fetchCollection,
  fetchJson,
  joinParagraphs,
  logSkip,
  mapWithConcurrency,
  projectPath,
  slugify,
  titleCase,
  writeJson
} from "./utils.mjs";

const API_ROOT = "https://www.dnd5eapi.co";
const MONSTER_INDEX_URL = `${API_ROOT}/api/2014/monsters`;
const OUTPUT_PATH = "data/dnd/DndMonsters5e.json";
const SOURCE_LABEL = "5e SRD";

function formatSpeed(speed) {
  if (!speed) {
    return "-";
  }

  if (typeof speed === "string") {
    return cleanText(speed);
  }

  const order = ["walk", "burrow", "climb", "fly", "swim"];
  const labels = {
    walk: "",
    burrow: "burrow",
    climb: "climb",
    fly: "fly",
    swim: "swim"
  };
  const parts = [];

  for (const key of order) {
    const value = speed[key];
    if (!value) {
      continue;
    }
    parts.push(labels[key] ? `${labels[key]} ${value}` : String(value));
  }

  for (const [key, value] of Object.entries(speed)) {
    if (!value || order.includes(key)) {
      continue;
    }
    parts.push(`${key.replace(/_/g, " ")} ${value}`);
  }

  return parts.length ? parts.join(", ") : "-";
}

function formatArmorClass(armorClass) {
  if (typeof armorClass === "number") {
    return armorClass;
  }

  if (Array.isArray(armorClass) && armorClass.length) {
    const first = armorClass.find(function (entry) {
      return entry && typeof entry.value === "number";
    });
    return first ? first.value : 0;
  }

  return 0;
}

function formatChallengeRating(value) {
  const text = String(value ?? "0").trim();

  switch (text) {
    case "0.125":
      return "1/8";
    case "0.25":
      return "1/4";
    case "0.5":
      return "1/2";
    default:
      return text || "0";
  }
}

function formatAbilityBlock(monster) {
  return {
    strength: Number(monster.strength || 0),
    dexterity: Number(monster.dexterity || 0),
    constitution: Number(monster.constitution || 0),
    intelligence: Number(monster.intelligence || 0),
    wisdom: Number(monster.wisdom || 0),
    charisma: Number(monster.charisma || 0)
  };
}

function formatEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map(function (entry) {
      const name = cleanText(entry?.name);
      const description = joinParagraphs(entry?.desc);
      if (!name && !description) {
        return "";
      }
      if (!name) {
        return description;
      }
      if (!description) {
        return name;
      }
      return `${name}. ${description}`;
    })
    .filter(Boolean);
}

function formatLegendaryActions(monster) {
  const entries = [];

  if (monster.legendary_desc) {
    entries.push(cleanText(monster.legendary_desc));
  }

  if (Array.isArray(monster.legendary_actions)) {
    entries.push(...formatEntries(monster.legendary_actions));
  }

  if (Array.isArray(monster.reactions)) {
    entries.push(...formatEntries(monster.reactions).map(function (entry) {
      return `Reaction. ${entry}`;
    }));
  }

  return entries.filter(Boolean);
}

function normalizeMonster(monster) {
  const actions = [
    ...formatEntries(monster.actions),
    ...formatLegendaryActions(monster)
  ];

  return {
    id: String(monster.index || slugify(monster.name)),
    name: cleanText(monster.name) || "Unnamed Monster",
    size: titleCase(monster.size) || "-",
    type: titleCase(monster.type) || "-",
    alignment: titleCase(monster.alignment) || "-",
    armorClass: formatArmorClass(monster.armor_class),
    hitPoints: Number(monster.hit_points || 0),
    hitDie: cleanText(monster.hit_points_roll || monster.hit_dice || ""),
    speed: formatSpeed(monster.speed),
    abilities: formatAbilityBlock(monster),
    challengeRating: formatChallengeRating(monster.challenge_rating),
    traits: formatEntries(monster.special_abilities),
    actions: actions,
    source: SOURCE_LABEL,
    sourcePage: ""
  };
}

async function main() {
  console.log("Fetching monster index...");
  const monsterIndex = await fetchCollection(MONSTER_INDEX_URL);
  console.log(`Found ${monsterIndex.length} monster references.`);

  const normalizedMonsters = [];

  const detailedMonsters = await mapWithConcurrency(
    monsterIndex,
    async function (entry) {
      const id = entry.index || slugify(entry.name);
      try {
        return await fetchJson(`${API_ROOT}/api/2014/monsters/${id}`);
      } catch (error) {
        logSkip("monster", id, error);
        return null;
      }
    },
    16
  );

  for (const monster of detailedMonsters) {
    if (!monster) {
      continue;
    }

    try {
      normalizedMonsters.push(normalizeMonster(monster));
    } catch (error) {
      logSkip("monster", monster.index || monster.name || "unknown", error);
    }
  }

  normalizedMonsters.sort(function (left, right) {
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
  });

  const outputPath = await writeJson(OUTPUT_PATH, normalizedMonsters);
  console.log(`Wrote ${normalizedMonsters.length} monsters to ${projectPath(OUTPUT_PATH)}`);
  console.log(`Output file: ${outputPath}`);
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
