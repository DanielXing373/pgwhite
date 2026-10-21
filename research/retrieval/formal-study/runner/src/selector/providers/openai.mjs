import { buildOpenAIBody } from "../instruction.mjs";
import { extractOpenAICompatibleUsage, postJson, requireEnv } from "../http.mjs";

export function createOpenAISelector({ env = process.env, fetchImpl, baseUrl } = {}) {
  const root = (baseUrl || env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  return {
    provider_id: "openai",
    async complete({ model, prompt, candidates, timeoutMs }) {
      const apiKey = requireEnv(env, "OPENAI_API_KEY");
      const body = buildOpenAIBody({
        model,
        prompt,
        candidateIds: candidates.map((candidate) => candidate.id),
      });
      const response = await postJson({
        url: `${root}/chat/completions`,
        headers: { authorization: `Bearer ${apiKey}` },
        body,
        timeoutMs,
        fetchImpl,
        provider: "openai",
      });
      const text = response.body?.choices?.[0]?.message?.content ?? "";
      return {
        provider_id: "openai",
        model_id: response.body?.model ?? model,
        request_body: body,
        raw_response: response.body,
        response_text: text,
        usage: extractOpenAICompatibleUsage(response.body),
        local_runtime: null,
        http_status: response.status,
      };
    },
  };
}
