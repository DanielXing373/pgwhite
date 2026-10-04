import { readJsonFile, resolveRepoPath, sha256File } from "./io.mjs";

const REQUIRED_FIELDS = [
  "id",
  "canonical_zh",
  "dimension",
  "definition",
  "aliases",
  "related",
  "provenance",
  "status",
];

/**
 * Load the accepted 1.41 Atomic Tag Library and return active Theme candidates.
 * Does not silently repair malformed records.
 */
export function loadTagLibrary(repoRoot, relativePath) {
  const path = resolveRepoPath(repoRoot, relativePath);
  const library = readJsonFile(path);

  if (library.schema_version !== "atomic-tag-library.v1") {
    throw new Error(
      `Unexpected tag library schema_version: ${library.schema_version}`,
    );
  }
  if (!Array.isArray(library.themes)) {
    throw new Error("Tag library missing themes[]");
  }
  if (!Array.isArray(library.devices)) {
    throw new Error("Tag library missing devices[]");
  }

  for (const tag of [...library.themes, ...library.devices]) {
    assertTagShape(tag);
  }

  return {
    path,
    hash: sha256File(path),
    library_version: library.library_version,
    schema_version: library.schema_version,
    library,
  };
}

export function assertTagShape(tag) {
  if (!tag || typeof tag !== "object") {
    throw new Error("Tag record must be an object");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in tag)) {
      throw new Error(
        `Malformed tag ${tag.id ?? tag.canonical_zh ?? "(unknown)"}: missing ${field}`,
      );
    }
  }
  if (typeof tag.id !== "string" || !tag.id.trim()) {
    throw new Error("Tag id must be a non-empty string");
  }
  if (typeof tag.canonical_zh !== "string" || !tag.canonical_zh.trim()) {
    throw new Error(`Tag ${tag.id}: canonical_zh must be non-empty`);
  }
  if (typeof tag.definition !== "string" || !tag.definition.trim()) {
    throw new Error(`Tag ${tag.id}: definition must be non-empty`);
  }
  if (!Array.isArray(tag.aliases)) {
    throw new Error(`Tag ${tag.id}: aliases must be an array`);
  }
  if (!Array.isArray(tag.related)) {
    throw new Error(`Tag ${tag.id}: related must be an array`);
  }
  if (!Array.isArray(tag.provenance) || tag.provenance.length < 1) {
    throw new Error(`Tag ${tag.id}: provenance must be a non-empty array`);
  }
  if (typeof tag.status !== "string" || !tag.status.trim()) {
    throw new Error(`Tag ${tag.id}: status must be a non-empty string`);
  }
  if (tag.dimension !== "theme" && tag.dimension !== "device") {
    throw new Error(`Tag ${tag.id}: invalid dimension ${tag.dimension}`);
  }
}

/**
 * Active Theme candidates for 1.42 Theme retrieval.
 * Devices and non-active Themes are excluded.
 */
export function selectActiveThemes(
  library,
  { activeStatus = "active_candidate" } = {},
) {
  return library.themes
    .filter((t) => t.dimension === "theme" && t.status === activeStatus)
    .map((t) => ({
      id: t.id,
      canonical_zh: t.canonical_zh,
      label_en: t.label_en ?? null,
      dimension: t.dimension,
      definition: t.definition,
      aliases: [...t.aliases],
      related: [...t.related],
      provenance: [...t.provenance],
      status: t.status,
      category: t.category ?? null,
      source_refs: [...(t.source_refs ?? [])],
    }));
}

export function indexThemesById(themes) {
  const byId = new Map();
  for (const t of themes) {
    if (byId.has(t.id)) throw new Error(`Duplicate theme id: ${t.id}`);
    byId.set(t.id, t);
  }
  return byId;
}

export function indexThemesByCanonical(themes) {
  const byLabel = new Map();
  for (const t of themes) {
    if (byLabel.has(t.canonical_zh)) {
      throw new Error(`Duplicate canonical_zh among active themes: ${t.canonical_zh}`);
    }
    byLabel.set(t.canonical_zh, t);
  }
  return byLabel;
}
