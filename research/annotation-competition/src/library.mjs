import { AC_LIBRARY, fromRepo } from "./paths.mjs";
import { readJson, sha256File } from "./util.mjs";

export const DIMENSIONS = ["theme", "rhetoric", "technique"];
export const DIMENSION_ZH = { theme: "主题", rhetoric: "修辞", technique: "描写手法" };

export function loadLibrary(file = fromRepo(AC_LIBRARY)) {
  const raw = readJson(file);
  const byCode = new Map();
  const byId = new Map();
  for (const dimension of DIMENSIONS) {
    for (const tag of raw.dimensions[dimension]) {
      if (byCode.has(tag.code)) throw new Error(`duplicate tag code ${tag.code}`);
      if (byId.has(tag.id)) throw new Error(`duplicate tag id ${tag.id}`);
      byCode.set(tag.code, tag);
      byId.set(tag.id, tag);
    }
  }
  return {
    version: raw.library_version,
    sha256: sha256File(file),
    dimensions: raw.dimensions,
    byCode,
    byId,
  };
}
