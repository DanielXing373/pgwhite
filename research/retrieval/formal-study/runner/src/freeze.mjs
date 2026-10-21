import { resolveRepoPath, sha256File } from "../../../runner/src/io.mjs";

export const FROZEN = Object.freeze({
  ontology: Object.freeze({
    version: "atomic-tag-library.v1.43",
    path: "research/retrieval/formal-study/ontology/atomic-tag-library.v1.43.freeze.json",
    sha256: "a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7",
    active_themes: 185,
  }),
  benchmark: Object.freeze({
    version: "formal-benchmark.v1.frozen",
    path: "research/retrieval/formal-study/benchmark/formal-benchmark.v1.frozen.json",
    sha256: "5ad71ae64886fa09a52b8c51e93b8304da3553d09c9dabe9186b03360b5c70da",
    quotes: 58,
  }),
  pilot: Object.freeze({
    version: "formal-pilot-10.v1.frozen",
    path: "research/retrieval/formal-study/benchmark/formal-pilot-10.v1.frozen.json",
    sha256: "855fd0c338daf008259f8ae1886300a02cc1e9b02bc25d5a01dd611faba09f06",
    quotes: 10,
  }),
  embedding_model: "Qwen/Qwen3-Embedding-0.6B",
});

export function assertSha256(filePath, expected, label) {
  const actual = sha256File(filePath);
  if (actual !== expected) {
    throw new Error(
      `STOP: ${label} SHA-256 mismatch. expected=${expected} actual=${actual} path=${filePath}`,
    );
  }
  return actual;
}

/**
 * Check a declared asset. Official freeze paths must match the study constants
 * even if a config file claims a different expected hash.
 */
export function verifyDeclaredAsset(repoRoot, relativePath, expectedSha, label) {
  const abs = resolveRepoPath(repoRoot, relativePath);
  const actual = assertSha256(abs, expectedSha, label);
  for (const asset of [FROZEN.ontology, FROZEN.benchmark, FROZEN.pilot]) {
    if (asset.path !== relativePath) continue;
    if (expectedSha !== asset.sha256 || actual !== asset.sha256) {
      throw new Error(
        `STOP: official ${label} hash does not match the study freeze (${asset.sha256}).`,
      );
    }
  }
  return { path: abs, sha256: actual };
}
