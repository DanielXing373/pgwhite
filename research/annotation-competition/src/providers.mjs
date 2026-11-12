// 复用 formal-study runner 的 HTTP / 脱敏 / 计价工具（只 import，不修改）。
import {
  extractOpenAICompatibleUsage,
  postJson,
  requireEnv,
} from "../../retrieval/formal-study/runner/src/selector/http.mjs";

export const PAID_PROVIDERS = new Set(["openai", "deepseek"]);

function openAiProvider({ env, fetchImpl }) {
  const root = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  return {
    provider_id: "openai",
    async complete({ model, system, user, schema, timeoutMs, request = {} }) {
      const apiKey = requireEnv(env, "OPENAI_API_KEY");
      const body = {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "quote_annotation", strict: true, schema },
        },
      };
      if (request.omit_temperature !== true) body.temperature = request.temperature ?? 0;
      if (request.reasoning_effort) body.reasoning_effort = request.reasoning_effort;
      const response = await postJson({
        url: `${root}/chat/completions`,
        headers: { authorization: `Bearer ${apiKey}` },
        body,
        timeoutMs,
        fetchImpl,
        provider: "openai",
      });
      return {
        model_id: response.body?.model ?? model,
        request_body: body,
        raw_response: response.body,
        response_text: response.body?.choices?.[0]?.message?.content ?? "",
        usage: extractOpenAICompatibleUsage(response.body),
        http_status: response.status,
      };
    },
  };
}

function deepSeekProvider({ env, fetchImpl }) {
  const root = (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  return {
    provider_id: "deepseek",
    async complete({ model, system, user, timeoutMs, request = {}, quoteCount = 1 }) {
      const apiKey = requireEnv(env, "DEEPSEEK_API_KEY");
      // json_object only: codes and evidence are validated locally by parse.mjs.
      const body = {
        model,
        temperature: request.temperature ?? 0,
        max_tokens: request.max_tokens ?? 256 + 220 * quoteCount,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        thinking: { type: request.thinking?.type ?? "disabled" },
        reasoning_effort: request.reasoning_effort ?? "none",
      };
      const response = await postJson({
        url: `${root}/chat/completions`,
        headers: { authorization: `Bearer ${apiKey}` },
        body,
        timeoutMs,
        fetchImpl,
        provider: "deepseek",
      });
      return {
        model_id: response.body?.model ?? model,
        request_body: body,
        raw_response: response.body,
        response_text: response.body?.choices?.[0]?.message?.content ?? "",
        usage: extractOpenAICompatibleUsage(response.body),
        http_status: response.status,
      };
    },
  };
}

/**
 * Offline provider for tests and plumbing checks. It "selects" a tag when the tag's label
 * literally appears in the quotation, so outputs are deterministic and evidence is valid.
 * It says nothing about real model quality.
 */
export function fakeProvider({ scripted = null } = {}) {
  let call = 0;
  return {
    provider_id: "fake",
    async complete({ system, user, context }) {
      call += 1;
      let text;
      if (scripted) {
        text = scripted[(call - 1) % scripted.length];
      } else {
        const results = context.quotes.map((quote, index) => {
          const row = { n: index + 1 };
          for (const dimension of context.dimensions) {
            const allowed = dimension === "theme" && context.themeScope !== "full"
              ? new Set(context.candidatesByQuote.get(quote.quote_id))
              : null;
            row[dimension] = context.library.dimensions[dimension]
              .filter((tag) => quote.text_zh.includes(tag.label) && (!allowed || allowed.has(tag.code)))
              .map((tag) => (context.evidence ? { c: tag.code, e: tag.label } : { c: tag.code }));
          }
          return row;
        });
        text = JSON.stringify({ results });
      }
      const inputTokens = Math.ceil((system.length + user.length) * 0.7);
      return {
        model_id: "fake",
        request_body: { system_chars: system.length, user_chars: user.length },
        raw_response: null,
        response_text: text,
        usage: {
          input_tokens: inputTokens,
          output_tokens: Math.ceil(text.length * 0.5),
          reasoning_tokens: 0,
          cached_tokens: 0,
        },
        http_status: 200,
      };
    },
  };
}

export function createProvider(providerId, { env = process.env, fetchImpl } = {}) {
  if (providerId === "openai") return openAiProvider({ env, fetchImpl });
  if (providerId === "deepseek") return deepSeekProvider({ env, fetchImpl });
  if (providerId === "fake") return fakeProvider();
  throw new Error(`STOP: unknown provider ${providerId}. No fallback provider will be used.`);
}
