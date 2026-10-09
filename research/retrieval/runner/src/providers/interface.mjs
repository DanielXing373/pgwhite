/**
 * Embedding provider contract (documentation + helpers).
 *
 * A provider must expose:
 *   async embed(texts: string[]) => number[][]
 *   getMetadata() => { provider_id, model_name, model_revision?, dimensions?, device?, ... }
 *   optional async close()
 *
 * Benchmark logic must not depend on CUDA / HF / PyTorch internals.
 */

export function assertEmbeddingBatch(texts, vectors, expectedDim) {
  if (!Array.isArray(texts) || !Array.isArray(vectors)) {
    throw new Error("embed() must return an array of vectors matching texts");
  }
  if (texts.length !== vectors.length) {
    throw new Error(
      `embed() length mismatch: ${texts.length} texts vs ${vectors.length} vectors`,
    );
  }
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    if (
      !Array.isArray(v) &&
      !(v instanceof Float64Array) &&
      !(v instanceof Float32Array)
    ) {
      throw new Error(`embed() vector[${i}] is not an array`);
    }
    if (expectedDim != null && v.length !== expectedDim) {
      throw new Error(
        `embed() vector[${i}] dim ${v.length} != expected ${expectedDim}`,
      );
    }
  }
}
