import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Resolve a path relative to repo root (cwd-independent when absolute). */
export function resolveRepoPath(repoRoot, relativeOrAbsolute) {
  if (!relativeOrAbsolute) throw new Error("path is required");
  if (resolve(relativeOrAbsolute) === relativeOrAbsolute) return relativeOrAbsolute;
  return resolve(repoRoot, relativeOrAbsolute);
}

export function sha256File(filePath) {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256Text(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

export function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
