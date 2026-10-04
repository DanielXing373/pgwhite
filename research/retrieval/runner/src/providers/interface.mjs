/**
 * Embedding provider contract (documentation + helpers).
 *
 * A provider must expose:
 *   async embed(texts: string[]) => number[][]
 *   getMetadata() => { provider_id, model_name, model_revision?, dimensions?, device?, ... }
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
    if (!Array.isArray(v) && !(v instanceof Float64Array) && !(v instanceof Float32Array)) {
      throw new Error(`embed() vector[${i}] is not an array`);
    }
    if (expectedDim != null && v.length !== expectedDim) {
      throw new Error(
        `embed() vector[${i}] dim ${v.length} != expected ${expectedDim}`,
      );
    }
  }
}

/**
 * Future real provider placeholder.
 * Calling embed without a real implementation fails loudly (no silent stub vectors).
 */
export function createQwen3EmbeddingProviderStub(options = {}) {
  const model = options.model ?? "Qwen/Qwen3-Embedding-0.6B";
  return {
    getMetadata() {
      return {
        provider_id: "qwen3-embedding",
        model_name: model,
        model_revision: options.model_revision ?? null,
        dimensions: options.dimensions ?? null,
        device: options.device ?? null,
        status: "not_implemented_in_1.42_foundation",
        notes:
          "Real Qwen embedding runs on the experiment machine later. Use provider=fake for infrastructure tests.",
      };
    },
    async embed() {
      throw new Error(
        `Qwen embedding provider is not implemented in the 1.42 foundation. ` +
          `Configure provider.id=fake for tests, or implement the real provider later for ${model}.`,
      );
    },
  };
}
