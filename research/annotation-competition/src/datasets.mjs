import fs from "node:fs";
import {
  FROZEN_BENCHMARK,
  FROZEN_BENCHMARK_SHA256,
  FROZEN_RETRIEVAL,
  fromRepo,
} from "./paths.mjs";
import { readJson, sha256File } from "./util.mjs";

/**
 * Datasets hand the runner quote_id + text only. Gold labels never travel with them,
 * so they cannot leak into a prompt.
 */
export function loadDataset(spec) {
  if (spec.id === "dev58") {
    const file = fromRepo(FROZEN_BENCHMARK);
    const sha = sha256File(file);
    if (sha !== FROZEN_BENCHMARK_SHA256) throw new Error("STOP: frozen benchmark hash mismatch.");
    const quotes = readJson(file).quotes.map((quote) => ({
      quote_id: quote.quote_id,
      text_zh: quote.text_zh,
    }));
    return { id: "dev58", path: FROZEN_BENCHMARK, sha256: sha, quotes };
  }
  const file = fromRepo(spec.path);
  const data = readJson(file);
  if (spec.expected_sha256 && sha256File(file) !== spec.expected_sha256) {
    throw new Error(`STOP: dataset ${spec.id} hash mismatch.`);
  }
  const quotes = data.quotes.map((quote) => ({ quote_id: quote.quote_id, text_zh: quote.text_zh }));
  return { id: spec.id, path: spec.path, sha256: sha256File(file), quotes };
}

/** Top-K Theme candidates per quote from the frozen Qwen retrieval artifact (dev58 only). */
export function loadThemeCandidates(library, { k = 20, artifact = FROZEN_RETRIEVAL } = {}) {
  const file = fromRepo(artifact);
  if (!fs.existsSync(file)) {
    throw new Error(`STOP: retrieval artifact not found (${artifact}). Top-K arms need it.`);
  }
  const byQuote = new Map();
  for (const row of readJson(file).results) {
    const codes = row.ranking.slice(0, k).map((entry) => {
      const tag = library.byId.get(entry.tag_id);
      if (!tag) throw new Error(`STOP: retrieval tag ${entry.tag_id} is not in the AC library.`);
      return tag.code;
    });
    byQuote.set(row.quote_id, codes);
  }
  return byQuote;
}
