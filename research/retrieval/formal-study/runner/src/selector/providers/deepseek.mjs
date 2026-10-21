import { buildDeepSeekBody } from "../instruction.mjs";
import { extractOpenAICompatibleUsage, postJson, requireEnv } from "../http.mjs";

export function createDeepSeekSelector({ env = process.env, fetchImpl, baseUrl } = {}) {
  const root = (baseUrl || env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  return {
    provider_id: "deepseek",
    async complete({ model, prompt, candidates, timeoutMs }) {
      const apiKey = requireEnv(env, "DEEPSEEK_API_KEY");
      const body = buildDeepSeekBody({
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
        provider: "deepseek",
      });
      const text = response.body?.choices?.[0]?.message?.content ?? "";
      return {
        provider_id: "deepseek",
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
