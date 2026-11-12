import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const AC_ROOT = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(AC_ROOT, "..", "..");

export function fromRepo(relative) {
  return path.isAbsolute(relative) ? relative : path.join(REPO_ROOT, relative);
}

export const FROZEN_ONTOLOGY = "research/retrieval/formal-study/ontology/atomic-tag-library.v1.43.freeze.json";
export const FROZEN_ONTOLOGY_SHA256 = "a71db8ba7e34ea5c2db33b53a6c1583d8ac8bbf3e11871198bf0deedc0ed39b7";
export const FROZEN_BENCHMARK = "research/retrieval/formal-study/benchmark/formal-benchmark.v1.frozen.json";
export const FROZEN_BENCHMARK_SHA256 = "5ad71ae64886fa09a52b8c51e93b8304da3553d09c9dabe9186b03360b5c70da";
export const FROZEN_RETRIEVAL = "research/retrieval/formal-study/runs/formal-p1-c-task-20261021/run.json";
export const PRICING_CATALOG = "research/retrieval/formal-study/pricing/pricing-catalog.v1.json";
export const AC_LIBRARY = "research/annotation-competition/library/tag-library.ac1.json";
