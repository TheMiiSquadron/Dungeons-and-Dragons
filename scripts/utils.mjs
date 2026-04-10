import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..");

export function projectPath(...segments) {
  return path.join(projectRoot, ...segments);
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(relativePath, data) {
  const outputPath = projectPath(relativePath);
  await ensureDir(path.dirname(outputPath));
  await writeFile(outputPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return outputPath;
}

export async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchCollection(url) {
  const records = [];
  let nextUrl = url;

  while (nextUrl) {
    const payload = await fetchJson(nextUrl);

    if (Array.isArray(payload)) {
      records.push(...payload);
      break;
    }

    if (Array.isArray(payload.results)) {
      records.push(...payload.results);
      nextUrl = payload.next || null;
      continue;
    }

    throw new Error(`Unexpected collection payload for ${nextUrl}`);
  }

  return records;
}

export function titleCase(value) {
  return String(value || "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function cleanText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function joinParagraphs(value) {
  if (Array.isArray(value)) {
    return cleanText(value.filter(Boolean).join("\n\n"));
  }
  return cleanText(value);
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "record";
}

export function formatComponentList(components, material) {
  const list = Array.isArray(components) ? components : [];

  return list
    .map(function (entry) {
      const code = String(entry || "").trim().toUpperCase();
      if (code === "M" && material) {
        return "M";
      }
      return code;
    })
    .filter(Boolean);
}

export function normalizeClasses(classes) {
  if (!Array.isArray(classes)) {
    return [];
  }

  return classes
    .map(function (entry) {
      if (entry && typeof entry === "object") {
        return cleanText(entry.name);
      }
      return cleanText(entry);
    })
    .filter(Boolean);
}

export async function mapWithConcurrency(items, mapper, concurrency = 12) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, worker);
  await Promise.all(workers);
  return results;
}

export function logSkip(kind, key, error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`Skipping ${kind} "${key}": ${reason}`);
}
