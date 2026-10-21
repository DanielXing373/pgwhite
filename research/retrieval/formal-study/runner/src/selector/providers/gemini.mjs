import { buildGeminiBody } from "../instruction.mjs";
import { extractGeminiUsage, geminiText, postJson, requireEnv } from "../http.mjs";

export function createGeminiSelector({ env = process.env, fetchImpl, baseUrl } = {}) {
  const root = (
    baseUrl
    || env.GEMINI_BASE_URL
    || "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");
  return {
    provider_id: "gemini",
    async complete({ model, prompt, candidates, timeoutMs }) {
      const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
      if (!apiKey) requireEnv(env, "GEMINI_API_KEY");
      const body = buildGeminiBody({
        prompt,
        candidateIds: candidates.map((candidate) => candidate.id),
      });
      const response = await postJson({
        url: `${root}/models/${encodeURIComponent(model)}:generateContent`,
        headers: { "x-goog-api-key": apiKey },
        body,
        timeoutMs,
        fetchImpl,
        provider: "gemini",
      });
      return {
        provider_id: "gemini",
        model_id: model,
        request_body: body,
        raw_response: response.body,
        response_text: geminiText(response.body),
        usage: extractGeminiUsage(response.body),
        local_runtime: null,
        http_status: response.status,
      };
    },
  };
}
