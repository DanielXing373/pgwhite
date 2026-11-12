export function createEmbeddingTop2Selector() {
  return {
    provider_id: "embedding-top2",
    async complete({ model, candidates }) {
      if (!Array.isArray(candidates) || candidates.length < 2) {
        throw new Error("STOP: embedding-top2 requires at least two ranked candidates.");
      }
      const ranked = [...candidates].sort((a, b) => {
        const ra = Number(a.retrieval_rank);
        const rb = Number(b.retrieval_rank);
        if (ra !== rb) return ra - rb;
        return 0;
      });
      const top = ranked.slice(0, 2);
      if (top.length !== 2 || top.some((row) => !row?.id)) {
        throw new Error("STOP: embedding-top2 could not resolve two ranked Theme IDs.");
      }
      const selected = top.map((row) => row.id);
      const payload = {
        selected_theme_ids: selected,
        ranks: top.map((row) => ({
          id: row.id,
          retrieval_rank: row.retrieval_rank,
          similarity: row.similarity ?? null,
        })),
      };
      return {
        provider_id: "embedding-top2",
        model_id: model ?? "qwen3-embedding-0.6b-rank-top2",
        request_body: { method: "frozen_retrieval_rank_top2", selected_theme_ids: selected },
        raw_response: payload,
        response_text: JSON.stringify({ selected_theme_ids: selected }),
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          reasoning_tokens: 0,
          cached_tokens: 0,
        },
        local_runtime: { method: "frozen_retrieval_rank_top2", no_new_embedding_inference: true },
        http_status: null,
      };
    },
  };
}
