import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { sha256File } from "../../../runner/src/io.mjs";
import { redactSecrets } from "./safety.mjs";

const SECRET_HINTS = [
  /sk-[A-Za-z0-9_-]{8,}/,
  /OPENAI_API_KEY/i,
  /DEEPSEEK_API_KEY/i,
  /GEMINI_API_KEY/i,
  /Bearer\s+[A-Za-z0-9._-]{8,}/,
];

function listFiles(root) {
  const out = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, name.name);
    if (name.isDirectory()) out.push(...listFiles(abs));
    else out.push(abs);
  }
  return out;
}

function assertNoSecrets(filePath, text) {
  for (const pattern of SECRET_HINTS) {
    if (pattern.test(text)) {
      throw new Error(`STOP: archive source ${filePath} looks like it contains a secret. Refusing to copy.`);
    }
  }
}

export function assertArchiveDirAvailable(archiveDir) {
  if (!existsSync(archiveDir)) return;
  const entries = readdirSync(archiveDir);
  if (entries.length > 0) {
    throw new Error(
      `Refusing to overwrite existing archive directory ${archiveDir}. Choose a new archive_id.`,
    );
  }
}

export function archiveFormalRun({
  runDir,
  archiveDir,
  experimentId,
  extraFiles = [],
}) {
  const source = resolve(runDir);
  const dest = resolve(archiveDir);
  if (!existsSync(source)) {
    throw new Error(`STOP: run directory does not exist: ${source}`);
  }
  assertArchiveDirAvailable(dest);
  mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const abs of listFiles(source)) {
    const rel = relative(source, abs).replaceAll("\\", "/");
    const text = readFileSync(abs, "utf8");
    assertNoSecrets(rel, text);
    const target = join(dest, "run", rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(abs, target);
    copied.push(`run/${rel}`);
  }
  for (const extra of extraFiles) {
    const abs = resolve(extra.path);
    const rel = extra.archivePath.replaceAll("\\", "/");
    const text = readFileSync(abs, "utf8");
    assertNoSecrets(rel, text);
    const target = join(dest, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(abs, target);
    copied.push(rel);
  }
  const checksums = {};
  for (const rel of copied) {
    checksums[rel] = sha256File(join(dest, rel));
  }
  const manifest = {
    schema_version: "el-archive.v1",
    experiment_id: experimentId,
    created_at: new Date().toISOString(),
    source_run_dir: source,
    archive_dir: dest,
    files: checksums,
    notes: [
      "Original run artifacts were copied, not modified.",
      "Verify integrity by hashing each archived file against files in this manifest.",
      "Do not upload research archives without explicit authorization.",
    ],
  };
  writeFileSync(join(dest, "archive-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const validated = validateArchive(dest);
  if (!validated.ok) {
    throw new Error(`STOP: archive validation failed: ${validated.reason}`);
  }
  return { archiveDir: dest, manifest, validated };
}

export function validateArchive(archiveDir) {
  const manifestPath = join(archiveDir, "archive-manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: "missing archive-manifest.json" };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [rel, expected] of Object.entries(manifest.files ?? {})) {
    const abs = join(archiveDir, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      return { ok: false, reason: `missing archived file ${rel}` };
    }
    const actual = sha256File(abs);
    if (actual !== expected) {
      return { ok: false, reason: `checksum mismatch for ${rel}` };
    }
    const text = readFileSync(abs, "utf8");
    for (const pattern of SECRET_HINTS) {
      if (pattern.test(text)) {
        return { ok: false, reason: `secret-like content in ${rel}` };
      }
    }
  }
  return { ok: true, reason: null, file_count: Object.keys(manifest.files ?? {}).length };
}

export function redactForLog(value) {
  return redactSecrets(String(value ?? ""));
}
