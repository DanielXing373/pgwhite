import { buildOllamaBody } from "../instruction.mjs";
import { finiteOrNull, postJson } from "../http.mjs";
import { redactSecrets } from "../../safety.mjs";

async function probeOllama({ root, model, fetchImpl, timeoutMs }) {
  const probe = { quantization: null, vram_bytes: null, warnings: [] };
  try {
    const shown = await postJson({
      url: `${root}/api/show`,
      headers: {},
      body: { model },
      timeoutMs,
      fetchImpl,
      provider: "ollama",
    });
    probe.quantization = shown.body?.details?.quantization_level ?? null;
  } catch (error) {
    probe.warnings.push(redactSecrets(error.message));
  }
  try {
    const fetchFn = fetchImpl ?? globalThis.fetch;
    const response = await fetchFn(`${root}/api/ps`, { method: "GET" });
    if (response.ok) {
      const body = await response.json();
      const match = (body.models ?? []).find((item) => item.name === model || item.model === model);
      probe.vram_bytes = finiteOrNull(match?.size_vram);
    }
  } catch (error) {
    probe.warnings.push(redactSecrets(error.message));
  }
  return probe;
}

export function createOllamaSelector({ env = process.env, fetchImpl, baseUrl, probe = true } = {}) {
  const root = (baseUrl || env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  let runtimeProbe = null;
  return {
    provider_id: "ollama",
    async prepare({ model, timeoutMs }) {
      if (!probe) return null;
      runtimeProbe = await probeOllama({ root, model, fetchImpl, timeoutMs });
      return runtimeProbe;
    },
    async complete({ model, prompt, candidates, timeoutMs }) {
      const body = buildOllamaBody({
        model,
        prompt,
        candidateIds: candidates.map((candidate) => candidate.id),
      });
      const response = await postJson({
        url: `${root}/api/chat`,
        headers: {},
        body,
        timeoutMs,
        fetchImpl,
        provider: "ollama",
      });
      const evalCount = finiteOrNull(response.body?.eval_count);
      const evalDuration = finiteOrNull(response.body?.eval_duration);
      const tokensPerSecond = evalCount != null && evalDuration != null && evalDuration > 0
        ? evalCount / (evalDuration / 1e9)
        : null;
      return {
        provider_id: "ollama",
        model_id: response.body?.model ?? model,
        request_body: body,
        raw_response: response.body,
        response_text: response.body?.message?.content ?? "",
        usage: {
          input_tokens: finiteOrNull(response.body?.prompt_eval_count),
          output_tokens: evalCount,
          reasoning_tokens: null,
          cached_tokens: null,
        },
        local_runtime: {
          runtime: "ollama",
          model_identifier: response.body?.model ?? model,
          quantization: runtimeProbe?.quantization ?? null,
          tokens_per_second: tokensPerSecond,
          inference_latency_ms: finiteOrNull(response.body?.total_duration) == null
            ? null
            : response.body.total_duration / 1e6,
          vram_bytes: runtimeProbe?.vram_bytes ?? null,
        },
        http_status: response.status,
      };
    },
  };
}
