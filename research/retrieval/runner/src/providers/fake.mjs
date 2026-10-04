import { createHash } from "node:crypto";
import { assertEmbeddingBatch } from "./interface.mjs";

/**
 * Deterministic fake embedding provider for infrastructure tests only.
 * Does NOT represent semantic quality.
 */
export function createFakeEmbeddingProvider(options = {}) {
  const dimensions = Number(options.dimensions ?? 32);
  if (!Number.isInteger(dimensions) || dimensions < 4) {
    throw new Error("fake provider dimensions must be an integer >= 4");
  }

  function embedOne(text) {
    const input = String(text ?? "");
    const out = new Array(dimensions);
    // Multiple independent hash streams for coverage across dims
    for (let i = 0; i < dimensions; i++) {
      const h = createHash("sha256")
        .update(`${i}\0${input}`, "utf8")
        .digest();
      // Map byte pair to [-1, 1]
      const n = (h[0] << 8) | h[1];
      out[i] = n / 32767.5 - 1;
    }
    // Ensure non-zero
    let sumSq = 0;
    for (const x of out) sumSq += x * x;
    if (sumSq === 0) out[0] = 1;
    return out;
  }

  return {
    getMetadata() {
      return {
        provider_id: "fake",
        model_name: "fake-deterministic-sha256",
        model_revision: "v1",
        dimensions,
        device: "cpu",
        notes: "Infrastructure-only fake vectors; not semantic retrieval quality.",
      };
    },
    async embed(texts) {
      const list = Array.isArray(texts) ? texts : [texts];
      const vectors = list.map(embedOne);
      assertEmbeddingBatch(list, vectors, dimensions);
      return vectors;
    },
  };
}
